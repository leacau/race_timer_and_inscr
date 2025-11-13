
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as db from "./data";
import { assignCategory } from "./logic";
import { generateChipNumber } from "./utils";
import type { AgeCalculationMethod, Category, CategoryInput, ParticipantFirestoreData, ParticipantInput } from "./types";

// Participant Actions
export async function addParticipant(
  participantData: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod
) {
  const categories = await db.getCategories();
  const categoryId = assignCategory(participantData, categories, raceDate, ageCalculationMethod);
  const chipNumber = generateChipNumber(participantData.bibNumber);

  const participantToSave: ParticipantFirestoreData = {
    ...participantData,
    city: participantData.city || null,
    province: participantData.province || null,
    country: participantData.country || null,
    categoryId,
    chipNumber,
    startTime: null,
    finishTime: null,
  };
  
  await db.addParticipant(participantToSave);
  revalidatePath("/");
}

export async function updateParticipant(
  id: string,
  participantData: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod
) {
  const categories = await db.getCategories();
  const categoryId = assignCategory(participantData, categories, raceDate, ageCalculationMethod);
  
  const dataToUpdate: Partial<ParticipantFirestoreData> = {
    ...participantData,
    categoryId,
  };

  await db.updateParticipant(id, dataToUpdate);
  revalidatePath("/");
}

export async function deleteParticipant(id: string) {
  await db.deleteParticipant(id);
  revalidatePath("/");
}

export async function updateParticipantTime(
  id: string,
  startTime: number,
  finishTime: number
) {
  await db.updateParticipantTime(id, startTime, finishTime);
  revalidatePath("/");
}

export async function importParticipants(
  participants: z.infer<typeof serverImportParticipantSchema>[],
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod
) {
  const categories = await db.getCategories();

  const participantsToCreate = participants.map((p) => {
    const categoryId = assignCategory(p, categories, raceDate, ageCalculationMethod);
    const chipNumber = generateChipNumber(p.bibNumber);

    const data: ParticipantFirestoreData = {
        bibNumber: p.bibNumber,
        name: p.name,
        surname: p.surname,
        dni: p.dni,
        gender: p.gender,
        distance: p.distance,
        birthDate: p.birthDate,
        categoryId: categoryId,
        chipNumber: chipNumber,
        startTime: null,
        finishTime: null,
        city: p.city || null,
        province: p.province || null,
        country: p.country || null,
    };
    return data;
  });

  if (participantsToCreate.length === 0) {
    return { count: 0 };
  }

  await db.importParticipants(participantsToCreate);

  revalidatePath("/");
  return { count: participantsToCreate.length };
}


// Category Actions
const categorySchema = z.object({
  name: z.string().min(1),
  minAge: z.coerce.number().int(),
  maxAge: z.coerce.number().int(),
  gender: z.enum(["Any", "Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
});

export async function addCategory(
  categoryData: CategoryInput
) {
  const validatedData = categorySchema.parse(categoryData);
  await db.addCategory(validatedData);
  revalidatePath("/categories");
  revalidatePath("/");
}

export async function updateCategory(id: string, categoryData: CategoryInput) {
  const validatedData = categorySchema.parse(categoryData);
  await db.updateCategory(id, validatedData);
  revalidatePath("/categories");
  revalidatePath("/");
}

export async function deleteCategory(id: string) {
  await db.deleteCategory(id);
  revalidatePath("/categories");
  revalidatePath("/");
}

export async function bulkDeleteCategories(ids: string[]) {
  await db.bulkDeleteCategories(ids);
  revalidatePath("/categories");
  revalidatePath("/");
}

const bulkCategorySchema = z.object({
  ageRanges: z
    .array(
      z.object({
        min: z.coerce.number().int().min(0),
        max: z.coerce.number().int().min(0),
      })
    )
    .min(1)
    .refine(
      (ranges) => {
        const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);
        for (let i = 0; i < sortedRanges.length - 1; i++) {
          if (sortedRanges[i].max >= sortedRanges[i + 1].min) {
            return false; // Overlap detected
          }
        }
        return true;
      },
      {
        message: "Los rangos de edad no deben solaparse.",
      }
    ),
  distances: z.array(z.string()).min(1),
  genders: z.array(z.string()),
});

export async function bulkAddCategories(
  data: z.infer<typeof bulkCategorySchema>
) {
  const validatedData = bulkCategorySchema.parse(data);
  const { ageRanges, distances } = validatedData;
  let { genders } = validatedData;

  if (genders.length === 0) {
    genders = ["Any"];
  }

  const genderMap: Record<string, string> = {
    Male: "Masculino",
    Female: "Femenino",
    Any: "General",
  };

  for (const ageRange of ageRanges) {
    for (const distance of distances) {
      for (const gender of genders) {
        const genderName = genderMap[gender] || "General";
        const name = `${genderName} ${ageRange.min}-${ageRange.max} ${distance}`;
        const newCategory: CategoryInput = {
          name,
          minAge: ageRange.min,
          maxAge: ageRange.max,
          distance: distance as Category["distance"],
          gender: gender as Category["gender"],
        };
        await db.addCategory(newCategory);
      }
    }
  }

  revalidatePath("/categories");
  revalidatePath("/");
}

const serverImportParticipantSchema = z.object({
  bibNumber: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  dni: z.string().min(1),
  birthDate: z.string().min(1, "La fecha de nacimiento es requerida para la importación"),
  gender: z.enum(["Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
});
