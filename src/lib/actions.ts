"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  db,
  getParticipants as dbGetParticipants,
  getCategories as dbGetCategories,
  addParticipant as dbAddParticipant,
  updateParticipant as dbUpdateParticipant,
  deleteParticipant as dbDeleteParticipant,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  updateParticipantTime as dbUpdateParticipantTime
} from "./data";
import type { Participant, Category, ParticipantInput, CategoryInput } from "./types";
import { calculateAge } from "./utils";

const assignCategory = (participant: Omit<Participant, "id">, categories: Category[]): string | undefined => {
    const age = calculateAge(participant.birthDate);
    for (const category of categories) {
        if (
            participant.distance === category.distance &&
            (category.gender === 'Any' || category.gender === participant.gender) &&
            age >= category.minAge &&
            age <= category.maxAge
        ) {
            return category.id;
        }
    }
    return undefined;
};


// Participant Actions
export async function addParticipant(participantData: ParticipantInput) {
    const categories = await dbGetCategories();
    const categoryId = assignCategory(participantData, categories);
    await dbAddParticipant({ ...participantData, categoryId });
    revalidatePath("/");
}

export async function updateParticipant(participant: Participant) {
    const categories = await dbGetCategories();
    const categoryId = assignCategory(participant, categories);
    await dbUpdateParticipant({ ...participant, categoryId });
    revalidatePath("/");
}

export async function deleteParticipant(id: string) {
    await dbDeleteParticipant(id);
    revalidatePath("/");
}

export async function updateParticipantTime(id: string, startTime: number, finishTime: number) {
    await dbUpdateParticipantTime(id, startTime, finishTime);
    revalidatePath("/");
}

// Category Actions
const categorySchema = z.object({
  name: z.string().min(1),
  minAge: z.coerce.number().int(),
  maxAge: z.coerce.number().int(),
  gender: z.enum(["Any", "Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
});

export async function addCategory(categoryData: z.infer<typeof categorySchema>) {
    const validatedData = categorySchema.parse(categoryData);
    await dbAddCategory(validatedData);
    revalidatePath("/categories");
    revalidatePath("/"); // Also revalidate participants page in case categories change
}

export async function updateCategory(category: Category) {
    const validatedData = categorySchema.parse(category);
    await dbUpdateCategory({id: category.id, ...validatedData});
    revalidatePath("/categories");
    revalidatePath("/");
}

export async function deleteCategory(id: string) {
    await dbDeleteCategory(id);
    revalidatePath("/categories");
    revalidatePath("/");
}

const bulkCategorySchema = z.object({
  ageRanges: z.array(z.object({
    min: z.coerce.number().int().min(0),
    max: z.coerce.number().int().min(0),
  })).min(1),
  distances: z.array(z.string()).min(1),
  genders: z.array(z.string()).min(1),
});

export async function bulkAddCategories(data: z.infer<typeof bulkCategorySchema>) {
    const validatedData = bulkCategorySchema.parse(data);
    const { ageRanges, distances, genders } = validatedData;
    
    const genderMap = {
        'Male': 'Masculino',
        'Female': 'Femenino',
    } as Record<string, string>;

    for (const ageRange of ageRanges) {
        for (const distance of distances) {
            for (const gender of genders) {
                const name = `${genderMap[gender]} ${ageRange.min}-${ageRange.max} ${distance}`;
                const newCategory: CategoryInput = {
                    name,
                    minAge: ageRange.min,
                    maxAge: ageRange.max,
                    distance: distance as Category['distance'],
                    gender: gender as Category['gender'],
                };
                await dbAddCategory(newCategory);
            }
        }
    }

    revalidatePath("/categories");
    revalidatePath("/");
}


// Excel Import Action
export async function importFromExcel(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file uploaded");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet) as any[];

  const categories = await dbGetCategories();
  let count = 0;

  for (const row of data) {
    // Handle different column name variations
    const name = String(row.name || row.Name || row.Nombre || '');
    const surname = String(row.surname || row.Surname || row.Apellido || '');
    const dni = String(row.dni || row.DNI || '');
    const birthDate = String(row.birthDate || row['Birth Date'] || row['Fecha de Nacimiento'] || '');
    const genderRaw = String(row.gender || row.Gender || row.Género || '').toLowerCase();
    const distanceRaw = String(row.distance || row.Distance || row.Distancia || '').toLowerCase();

    // Normalize gender
    let gender: Participant['gender'] = 'Other';
    if (genderRaw.startsWith('m') || genderRaw === 'male' || genderRaw === 'masculino') {
        gender = 'Male';
    } else if (genderRaw.startsWith('f') || genderRaw === 'female' || genderRaw === 'femenino') {
        gender = 'Female';
    }

    // Normalize distance
    let distance: Participant['distance'] = '5k';
    if (distanceRaw.includes('10')) distance = '10k';
    else if (distanceRaw.includes('21')) distance = '21k';
    else if (distanceRaw.includes('42')) distance = '42k';

    const participantData = {
        name,
        surname,
        dni,
        birthDate, // Should be YYYY-MM-DD or a format Date can parse
        gender,
        distance,
    };

    // Basic validation
    if (participantData.name && participantData.surname && participantData.dni && participantData.birthDate) {
        const categoryId = assignCategory(participantData, categories);
        await dbAddParticipant({ ...participantData, categoryId });
        count++;
    }
  }
  
  revalidatePath("/");
  return { count };
}
