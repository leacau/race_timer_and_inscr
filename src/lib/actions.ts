
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getParticipants as dbGetParticipants,
  getCategories as dbGetCategories,
  addParticipant as dbAddParticipant,
  updateParticipant as dbUpdateParticipant,
  deleteParticipant as dbDeleteParticipant,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  updateParticipantTime as dbUpdateParticipantTime,
  bulkDeleteCategories as dbBulkDeleteCategories
} from "./data";
import type { Participant, Category, ParticipantInput, CategoryInput, AgeCalculationMethod } from "./types";
import { calculateAge, generateChipNumber } from "./utils";

const assignCategory = (participant: Omit<Participant, "id" | "chipNumber">, categories: Category[], raceDate: Date, ageCalculationMethod: AgeCalculationMethod): string | undefined => {
    const age = participant.age ?? calculateAge(participant.birthDate, raceDate, ageCalculationMethod);
    if (age === null) return undefined;

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
export async function addParticipant(participantData: ParticipantInput & { raceDate: Date, ageCalculationMethod: AgeCalculationMethod }) {
    const { raceDate, ageCalculationMethod, ...pData } = participantData;
    const categories = await dbGetCategories();
    const categoryId = assignCategory(pData, categories, raceDate, ageCalculationMethod);
    const chipNumber = generateChipNumber(pData.bibNumber);
    await dbAddParticipant({ ...pData, categoryId, chipNumber });
    revalidatePath("/");
}

export async function updateParticipant(participant: Participant & { raceDate: Date, ageCalculationMethod: AgeCalculationMethod }) {
    const { raceDate, ageCalculationMethod, ...pData } = participant;
    const categories = await dbGetCategories();
    const categoryId = assignCategory(pData, categories, raceDate, ageCalculationMethod);
    const chipNumber = generateChipNumber(pData.bibNumber);
    await dbUpdateParticipant({ ...pData, categoryId, chipNumber });
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

export async function bulkDeleteCategories(ids: string[]) {
    await dbBulkDeleteCategories(ids);
    revalidatePath("/categories");
    revalidatePath("/");
}

const bulkCategorySchema = z.object({
  ageRanges: z.array(z.object({
    min: z.coerce.number().int().min(0),
    max: z.coerce.number().int().min(0),
  })).min(1).refine(
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

export async function bulkAddCategories(data: z.infer<typeof bulkCategorySchema>) {
    const validatedData = bulkCategorySchema.parse(data);
    const { ageRanges, distances } = validatedData;
    let { genders } = validatedData;
    
    if (genders.length === 0) {
        genders = ['Any'];
    }

    const genderMap: Record<string, string> = {
        'Male': 'Masculino',
        'Female': 'Femenino',
        'Any': 'General'
    };

    for (const ageRange of ageRanges) {
        for (const distance of distances) {
            for (const gender of genders) {
                const genderName = genderMap[gender] || 'General';
                const name = `${genderName} ${ageRange.min}-${ageRange.max} ${distance}`;
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
const serverImportParticipantSchema = z.object({
  bibNumber: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  dni: z.string().min(1),
  birthDate: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  gender: z.enum(['Male', 'Female', 'Other']),
  distance: z.enum(['5k', '10k', '21k', '42k']),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
});


export async function importParticipants(participants: z.infer<typeof serverImportParticipantSchema>[], raceDate: Date, ageCalculationMethod: AgeCalculationMethod) {
  const categories = await dbGetCategories();
  let count = 0;
  
  for (const p of participants) {
    try {
      // Data is pre-validated on client, here we just ensure type safety for the action's scope
      const validatedParticipant = serverImportParticipantSchema.parse(p);
      const categoryId = assignCategory(validatedParticipant, categories, raceDate, ageCalculationMethod);
      const chipNumber = generateChipNumber(validatedParticipant.bibNumber);

      await dbAddParticipant({
        ...validatedParticipant,
        categoryId,
        chipNumber,
      });
      count++;
    } catch (error) {
      console.error("Failed to import participant:", p, error);
      // Optionally, you could collect and return errors
    }
  }

  revalidatePath("/");
  return { count };
}
