
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as db from "./data";
import { assignCategory } from "./logic";
import { generateChipNumber } from "./utils";
import type {
  AgeCalculationMethod,
  Category,
  CategoryInput,
  Participant,
  ParticipantFirestoreData,
  ParticipantInput,
  RaceInput,
} from "./types";

type SelectionTarget = { type: "selection"; ids: string[] };
type RangeTarget = { type: "range"; fromBib: string; toBib: string };
type AllTarget = { type: "all" };

export type CategoryAssignmentTarget = SelectionTarget | RangeTarget | AllTarget;

export type CategoryAssignmentOptions =
  | { strategy: "auto"; target: CategoryAssignmentTarget; distanceOverride?: Participant["distance"] }
  | { strategy: "manual"; target: SelectionTarget; categoryId: string | null };

export type TimingMode = 'general' | 'distance' | 'category';

// Participant Actions
export async function addParticipant(
  participantData: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const categories = await db.getCategories(raceId);
  const categoryId = assignCategory(participantData, categories, raceDate, ageCalculationMethod);
  const bibNumber = participantData.bibNumber?.toString().trim() || null;
  const chipNumber = bibNumber ? generateChipNumber(bibNumber) : "";

  const participantToSave: ParticipantFirestoreData = {
    raceId,
    ...participantData,
    bibNumber,
    city: participantData.city || null,
    province: participantData.province || null,
    country: participantData.country || null,
    isSpecial: Boolean(participantData.isSpecial),
    categoryId,
    chipNumber,
    startTime: null,
    finishTime: null,
  };
  
  await db.addParticipant(participantToSave);
  revalidatePath("/");
  revalidatePath("/competitors");
}

export async function updateParticipant(
  id: string,
  participantData: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const categories = await db.getCategories(raceId);
  const categoryId = assignCategory(participantData, categories, raceDate, ageCalculationMethod);
  const bibNumber = participantData.bibNumber?.toString().trim() || null;
  const chipNumber = bibNumber ? generateChipNumber(bibNumber) : "";

  const dataToUpdate: Partial<ParticipantFirestoreData> = {
    ...participantData,
    bibNumber,
    chipNumber,
    isSpecial: Boolean(participantData.isSpecial),
    categoryId,
  };

  await db.updateParticipant(id, dataToUpdate);
  revalidatePath("/");
  revalidatePath("/competitors");
}

export async function deleteParticipant(id: string) {
  await db.deleteParticipant(id);
  revalidatePath("/");
  revalidatePath("/competitors");
}

export async function bulkDeleteParticipants(ids: string[]) {
  if (ids.length === 0) return { deleted: 0 };
  await db.bulkDeleteParticipants(ids);
  revalidatePath("/");
  revalidatePath("/competitors");
  return { deleted: ids.length };
}

export async function updateParticipantTime(
  id: string,
  startTime: number,
  finishTime: number
) {
  await db.updateParticipantTime(id, startTime, finishTime);
  revalidatePath("/");
  revalidatePath("/competitors");
}

export async function startTimingGroup(raceId: string, mode: TimingMode, groupId?: string | null) {
  const participants = await db.getParticipants(raceId);
  let targets: Participant[] = [];

  if (mode === 'general') {
    targets = participants;
  } else if (mode === 'distance') {
    targets = participants.filter((p) => p.distance === groupId);
  } else {
    targets = participants.filter((p) => p.categoryId === (groupId ?? null));
  }

  if (targets.length === 0) {
    return { updated: 0 };
  }

  const startTime = Date.now();
  await db.bulkUpdateParticipants(
    targets.map((participant) => ({
      id: participant.id,
      data: { startTime, finishTime: null },
    }))
  );

  revalidatePath("/");
  return { updated: targets.length, startTime };
}

export async function resetTimingGroup(raceId: string, mode: TimingMode, groupId?: string | null) {
  const participants = await db.getParticipants(raceId);
  let targets: Participant[] = [];

  if (mode === 'general') {
    targets = participants;
  } else if (mode === 'distance') {
    targets = participants.filter((p) => p.distance === groupId);
  } else {
    targets = participants.filter((p) => (p.categoryId ?? null) === (groupId ?? null));
  }

  if (targets.length === 0) {
    return { updated: 0 };
  }

  await db.bulkUpdateParticipants(
    targets.map((participant) => ({
      id: participant.id,
      data: { startTime: null, finishTime: null },
    }))
  );

  revalidatePath("/");
  revalidatePath("/competitors");
  return { updated: targets.length };
}

export async function importParticipants(
  participants: z.infer<typeof serverImportParticipantSchema>[],
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const categories = await db.getCategories(raceId);

  const participantsToCreate = participants.map((p) => {
    const categoryId = assignCategory(p, categories, raceDate, ageCalculationMethod);
    const bibNumber = p.bibNumber?.toString().trim() || null;
    const chipNumber = bibNumber ? generateChipNumber(bibNumber) : "";

    const data: ParticipantFirestoreData = {
        raceId,
        bibNumber,
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
        isSpecial: Boolean(p.isSpecial),
    };
    return data;
  });

  if (participantsToCreate.length === 0) {
    return { count: 0 };
  }

  await db.importParticipants(participantsToCreate);

  revalidatePath("/");
  revalidatePath("/competitors");
  return { count: participantsToCreate.length };
}

const toComparableBib = (value: string): string | number => {
  const numeric = parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  return value.trim().toLowerCase();
};

const compareComparable = (a: string | number, b: string | number) => {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

const isBibWithinRange = (bib: string | null, fromBib: string, toBib: string) => {
  if (!bib) return false;
  let min = toComparableBib(fromBib);
  let max = toComparableBib(toBib);
  if (compareComparable(min, max) > 0) {
    [min, max] = [max, min];
  }
  const current = toComparableBib(bib);
  return compareComparable(current, min) >= 0 && compareComparable(current, max) <= 0;
};

const resolveTargetParticipants = (
  target: CategoryAssignmentTarget,
  participants: Participant[]
): Participant[] => {
  if (target.type === "all") {
    return participants;
  }
  if (target.type === "selection") {
    const selected = new Set(target.ids);
    return participants.filter((p) => selected.has(p.id));
  }
  return participants.filter((p) => isBibWithinRange(p.bibNumber, target.fromBib, target.toBib));
};

type BibAssignmentFilters = {
  raceId: string;
  startBib: number;
  endBib: number;
  distance?: Participant["distance"];
  gender?: Participant["gender"];
  targetIds?: string[];
};

export async function bulkAssignBibNumbers(options: BibAssignmentFilters) {
  const participants = await db.getParticipants(options.raceId);
  const { distance, gender, targetIds } = options;
  const selectedIds = new Set(targetIds ?? []);

  const basePool = targetIds?.length
    ? participants.filter((p) => selectedIds.has(p.id))
    : participants.filter((p) => {
        if (distance && p.distance !== distance) return false;
        if (gender && p.gender !== gender) return false;
        return true;
      });

  const targets = basePool.filter((p) => !p.bibNumber);
  if (targets.length === 0) {
    return { assigned: 0, total: 0, skipped: basePool.length };
  }

  const sortedTargets = [...targets].sort((a, b) => {
    const bySurname = a.surname.localeCompare(b.surname, "es", { sensitivity: "base" });
    if (bySurname !== 0) return bySurname;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  const min = Math.min(options.startBib, options.endBib);
  const max = Math.max(options.startBib, options.endBib);
  const availableSlots = max - min + 1;
  const assignments = Math.min(availableSlots, sortedTargets.length);

  const updates: { id: string; data: Partial<ParticipantFirestoreData> }[] = [];
  for (let i = 0; i < assignments; i++) {
    const bibValue = (min + i).toString();
    updates.push({
      id: sortedTargets[i].id,
      data: { bibNumber: bibValue, chipNumber: generateChipNumber(bibValue) },
    });
  }

  if (updates.length > 0) {
    await db.bulkUpdateParticipants(updates);
    revalidatePath("/");
    revalidatePath("/competitors");
  }

  return { assigned: updates.length, total: targets.length, skipped: targets.length - updates.length };
}

export async function assignCategoriesToParticipants(
  options: CategoryAssignmentOptions,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const participants = await db.getParticipants(raceId);
  const targetParticipants = resolveTargetParticipants(options.target, participants);

  if (targetParticipants.length === 0) {
    return { updated: 0 };
  }

  if (options.strategy === "manual" && options.target.type !== "selection") {
    throw new Error("La asignación manual solo admite participantes seleccionados.");
  }

  const updates: { id: string; data: Partial<ParticipantFirestoreData> }[] = [];

  if (options.strategy === "manual") {
    targetParticipants.forEach((participant) => {
      updates.push({ id: participant.id, data: { categoryId: options.categoryId } });
    });
  } else {
    const categories = await db.getCategories(raceId);
    targetParticipants.forEach((participant) => {
      const distance = options.distanceOverride ?? participant.distance;
      const nextCategory = assignCategory(
        { ...participant, distance },
        categories,
        raceDate,
        ageCalculationMethod
      );
      const data: Partial<ParticipantFirestoreData> = { categoryId: nextCategory };
      if (options.distanceOverride) {
        data.distance = distance;
      }
      updates.push({ id: participant.id, data });
    });
  }

  await db.bulkUpdateParticipants(updates);
  revalidatePath("/");
  revalidatePath("/competitors");
  return { updated: updates.length };
}


// Category Actions
const categorySchema = z.object({
  raceId: z.string().min(1),
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
  nameTemplate: z.string().min(1),
  genderFormat: z.enum(['long', 'short']).default('long'),
});

export async function bulkAddCategories(
  data: z.infer<typeof bulkCategorySchema>,
  raceId: string
) {
  const validatedData = bulkCategorySchema.parse(data);
  const { ageRanges, distances, nameTemplate, genderFormat } = validatedData;
  let { genders } = validatedData;

  if (genders.length === 0) {
    genders = ["Any"];
  }

  const genderMap: Record<string, string> = {
    Male: "Masculino",
    Female: "Femenino",
    Any: "General",
    Other: "Otro",
  };

  const genderShortMap: Record<string, string> = {
    Male: 'M',
    Female: 'F',
    Any: 'G',
    Other: 'X',
  };

  const sanitizeSheetName = (value: string) => value.trim().replace(/\s+/g, ' ');

  const replaceInsensitive = (text: string, search: string, replacement: string) => {
    if (!search) return text;
    let cursor = 0;
    let output = "";
    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    while (cursor < text.length) {
      const index = lowerText.indexOf(lowerSearch, cursor);
      if (index === -1) {
        output += text.slice(cursor);
        break;
      }
      output += text.slice(cursor, index) + replacement;
      cursor = index + search.length;
    }
    return output;
  };

  const getDistanceValue = (distance: string) => {
    const numeric = distance.replace(/[^0-9]/g, '');
    return numeric || distance;
  };

  const buildCategoryName = (
    template: string,
    distance: string,
    gender: string,
    min: number,
    max: number
  ) => {
    const replacements: Record<string, string> = {
      '[[distancia]]': getDistanceValue(distance),
      '[[distancia_label]]': distance.toUpperCase(),
      '[[genero]]': (genderFormat === 'short' ? genderShortMap[gender] : genderMap[gender]) || gender,
      '[[genero_largo]]': genderMap[gender] || gender,
      '[[genero_corto]]': genderShortMap[gender] || gender,
      '[[edad min]]': String(min),
      '[[edad max]]': String(max),
    };

    let result = template;
    Object.entries(replacements).forEach(([key, value]) => {
      result = replaceInsensitive(result, key, value);
    });
    return sanitizeSheetName(result);
  };

  const creations: Promise<string>[] = [];
  for (const ageRange of ageRanges) {
    for (const distance of distances) {
      for (const gender of genders) {
        const name = buildCategoryName(nameTemplate, distance, gender, ageRange.min, ageRange.max);
        const newCategory: CategoryInput = {
          raceId,
          name,
          minAge: ageRange.min,
          maxAge: ageRange.max,
          distance: distance as Category['distance'],
          gender: gender as Category['gender'],
        };
        creations.push(db.addCategory(newCategory));
      }
    }
  }

  await Promise.all(creations);

  revalidatePath("/categories");
  revalidatePath("/");
}

const serverImportParticipantSchema = z.object({
  bibNumber: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.toString().trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }),
  name: z.string().min(1),
  surname: z.string().min(1),
  dni: z.string().min(1),
  birthDate: z.string().min(1, "La fecha de nacimiento es requerida para la importación"),
  gender: z.enum(["Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  isSpecial: z.boolean().optional(),
});

export async function addRace(data: RaceInput) {
  await db.addRace(data);
  revalidatePath("/");
  revalidatePath("/competitors");
  revalidatePath("/categories");
  revalidatePath("/races");
}

export async function updateRace(id: string, data: RaceInput) {
  await db.updateRace(id, data);
  revalidatePath("/");
  revalidatePath("/competitors");
  revalidatePath("/categories");
  revalidatePath("/races");
}

export async function deleteRace(id: string) {
  await db.deleteRace(id);
  revalidatePath("/");
  revalidatePath("/competitors");
  revalidatePath("/categories");
  revalidatePath("/races");
}
