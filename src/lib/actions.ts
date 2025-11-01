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
import type { Participant, Category, ParticipantInput } from "./types";
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
    const participantData = {
        name: String(row.name || row.Name || ''),
        surname: String(row.surname || row.Surname || ''),
        dni: String(row.dni || row.DNI || ''),
        birthDate: String(row.birthDate || row.BirthDate || ''), // Should be YYYY-MM-DD
        gender: String(row.gender || row.Gender || '') as Participant['gender'],
        distance: String(row.distance || row.Distance || '') as Participant['distance'],
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
