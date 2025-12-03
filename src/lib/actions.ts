
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as db from "./data";
import { assignCategory } from "./logic";
import { calculateAge, generateChipNumber } from "./utils";
import type {
  AgeCalculationMethod,
  Category,
  CategoryInput,
  Participant,
  ParticipantFirestoreData,
  ParticipantInput,
  ParticipantSnapshot,
  Race,
  RaceInput,
  Role,
} from "./types";

type SelectionTarget = { type: "selection"; ids: string[] };
type RangeTarget = { type: "range"; fromBib: string; toBib: string };
type AllTarget = { type: "all" };

export type CategoryAssignmentTarget = SelectionTarget | RangeTarget | AllTarget;

export type CategoryAssignmentOptions =
  | { strategy: "auto"; target: CategoryAssignmentTarget; distanceOverride?: Participant["distance"] }
  | { strategy: "manual"; target: SelectionTarget; categoryId: string | null };

export type TimingMode = 'general' | 'distance' | 'category';

type BibAssignmentFilters = {
  distance?: Participant["distance"];
  gender?: Participant["gender"];
  minAge?: number;
  maxAge?: number;
};

export type BibAssignmentOptions =
  | { mode: "single"; participantId: string; bibNumber: string }
  | { mode: "bulk"; fromBib: string; toBib: string; filters?: BibAssignmentFilters; includeAssigned?: boolean };

// Participant Actions
export async function addParticipant(
  participantData: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const categories = await db.getCategories(raceId);
  const categoryId = assignCategory(participantData, categories, raceDate, ageCalculationMethod);
  const bibNumber = participantData.bibNumber ?? "";
  const chipNumber = generateChipNumber(bibNumber);

  const participantToSave: ParticipantFirestoreData = {
    raceId,
    ...participantData,
    bibNumber,
    city: participantData.city || null,
    province: participantData.province || null,
    country: participantData.country || null,
    shirtSize: participantData.shirtSize || null,
    isSpecial: Boolean(participantData.isSpecial),
    categoryId,
    chipNumber,
    startTime: null,
    finishTime: null,
    kitDelivered: false,
    replacedFromId: null,
    replacedById: null,
    teamId: participantData.teamId || null,
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
  const bibNumber = participantData.bibNumber ?? "";
  const chipNumber = generateChipNumber(bibNumber);

  const dataToUpdate: Partial<ParticipantFirestoreData> = {
    ...participantData,
    bibNumber,
    isSpecial: Boolean(participantData.isSpecial),
    categoryId,
    chipNumber,
    city: participantData.city || null,
    province: participantData.province || null,
    country: participantData.country || null,
    shirtSize: participantData.shirtSize || null,
    teamId: participantData.teamId || null,
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

export async function toggleKitDelivered(participantId: string, delivered: boolean, raceId?: string) {
  await db.updateParticipant(participantId, { kitDelivered: delivered });
  revalidatePath("/");
  if (raceId) {
    revalidatePath(`/races/${raceId}`);
    revalidatePath(`/kits/${raceId}`);
  }
}

export async function replaceParticipant(
  participantId: string,
  replacement: ParticipantInput,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
): Promise<{ newParticipantId: string }> {
  const original = await db.getParticipant(participantId);
  if (!original) {
    throw new Error("Participante no encontrado para reemplazar.");
  }

  const categories = await db.getCategories(raceId);
  const categoryId = assignCategory(replacement, categories, raceDate, ageCalculationMethod);

  const previousSnapshot: ParticipantSnapshot = {
    id: original.id,
    bibNumber: original.bibNumber,
    chipNumber: original.chipNumber,
    name: original.name,
    surname: original.surname,
    dni: original.dni,
    gender: original.gender,
    distance: original.distance,
    birthDate: original.birthDate,
    categoryId: original.categoryId,
  };

  const newParticipantData: ParticipantFirestoreData = {
    raceId,
    ...replacement,
    categoryId,
    chipNumber: original.chipNumber,
    bibNumber: original.bibNumber,
    isSpecial: Boolean(replacement.isSpecial),
    city: replacement.city || null,
    province: replacement.province || null,
    country: replacement.country || null,
    shirtSize: replacement.shirtSize || original.shirtSize || null,
    teamId: replacement.teamId || original.teamId || null,
    kitDelivered: original.kitDelivered ?? false,
    replacedFromId: original.id,
    replacedById: null,
    startTime: original.startTime,
    finishTime: original.finishTime,
  };

  const newParticipantId = await db.addParticipant(newParticipantData);

  const nextSnapshot: ParticipantSnapshot = {
    id: newParticipantId,
    bibNumber: original.bibNumber,
    chipNumber: original.chipNumber,
    name: replacement.name,
    surname: replacement.surname,
    dni: replacement.dni,
    gender: replacement.gender,
    distance: replacement.distance,
    birthDate: replacement.birthDate,
    categoryId,
  };

  await db.updateParticipant(participantId, { replacedById: newParticipantId });
  await db.addRunnerChange({ raceId, participantId: newParticipantId, previous: previousSnapshot, next: nextSnapshot });

  revalidatePath("/");
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);

  return { newParticipantId };
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
  finishTime: number,
  instanceId?: string | null,
  nextInstanceId?: string | null
) {
  await db.updateParticipantTime(id, startTime, finishTime, instanceId, nextInstanceId);
  revalidatePath("/");
  revalidatePath("/competitors");
}

export async function startTimingGroup(
  raceId: string,
  mode: TimingMode,
  groupId?: string | null,
  instanceId?: string | null
) {
  const participants = await db.getParticipants(raceId);
  const activeParticipants = participants.filter((participant) => !participant.replacedById);
  let targets: Participant[] = [];

  if (mode === 'general') {
    targets = activeParticipants;
  } else if (mode === 'distance') {
    targets = activeParticipants.filter((p) => p.distance === groupId);
  } else {
    targets = activeParticipants.filter((p) => p.categoryId === (groupId ?? null));
  }

  if (targets.length === 0) {
    return { updated: 0 };
  }

  const missingFields = targets.filter((participant) => !participant.bibNumber || !participant.chipNumber);
  if (missingFields.length > 0) {
    throw new Error("No puedes iniciar la carrera: faltan dorsales o chips en algunos participantes.");
  }

  const startTime = Date.now();
  await db.bulkUpdateParticipants(
    targets.map((participant) => ({
      id: participant.id,
      data: instanceId
        ? {
            instanceTimes: {
              ...(participant.instanceTimes ?? {}),
              [instanceId]: { startTime, finishTime: null },
            },
          }
        : { startTime, finishTime: null },
    }))
  );

  revalidatePath("/");
  return { updated: targets.length, startTime };
}

export async function resetTimingGroup(
  raceId: string,
  mode: TimingMode,
  groupId?: string | null,
  instanceId?: string | null
) {
  const participants = await db.getParticipants(raceId);
  const activeParticipants = participants.filter((participant) => !participant.replacedById);
  let targets: Participant[] = [];

  if (mode === 'general') {
    targets = activeParticipants;
  } else if (mode === 'distance') {
    targets = activeParticipants.filter((p) => p.distance === groupId);
  } else {
    targets = activeParticipants.filter((p) => (p.categoryId ?? null) === (groupId ?? null));
  }

  if (targets.length === 0) {
    return { updated: 0 };
  }

  await db.bulkUpdateParticipants(
    targets.map((participant) => ({
      id: participant.id,
      data: instanceId
        ? {
            instanceTimes: {
              ...(participant.instanceTimes ?? {}),
              [instanceId]: { startTime: null, finishTime: null },
            },
          }
        : { startTime: null, finishTime: null },
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
    const chipNumber = generateChipNumber(p.bibNumber);

    const data: ParticipantFirestoreData = {
        raceId,
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
        isSpecial: Boolean(p.isSpecial),
        teamId: null,
        kitDelivered: false,
        replacedFromId: null,
        replacedById: null,
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

export async function addTeamToRace(raceId: string, name: string) {
  await db.addTeam({ raceId, name });
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);
  revalidatePath("/competitors");
}

export async function renameTeam(raceId: string, teamId: string, name: string) {
  await db.updateTeam(teamId, { name });
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);
  revalidatePath("/competitors");
}

export async function removeTeam(raceId: string, teamId: string) {
  await db.deleteTeam(teamId);
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);
  revalidatePath("/competitors");
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

const isBibWithinRange = (bib: string, fromBib: string, toBib: string) => {
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

export async function assignBibNumbers(
  options: BibAssignmentOptions,
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod,
  raceId: string
) {
  const participants = await db.getParticipants(raceId);

  const hasConflict = (bib: string, ignoreIds: Set<string>) => {
    const normalized = bib.trim();
    return participants.some((p) => !ignoreIds.has(p.id) && p.bibNumber.trim() === normalized);
  };

  if (options.mode === "single") {
    const target = participants.find((p) => p.id === options.participantId);
    if (!target) {
      throw new Error("Participante no encontrado para asignar dorsal.");
    }

    const bib = options.bibNumber.trim();
    if (!bib) {
      throw new Error("Debes indicar un dorsal válido.");
    }

    const ignoreIds = new Set<string>([target.id]);
    if (hasConflict(bib, ignoreIds)) {
      throw new Error(`El dorsal ${bib} ya está asignado a otro participante.`);
    }

    await db.updateParticipant(target.id, {
      bibNumber: bib,
      chipNumber: generateChipNumber(bib),
    });

    revalidatePath("/");
    revalidatePath("/competitors");
    return { updated: 1 };
  }

  const from = parseInt(options.fromBib, 10);
  const to = parseInt(options.toBib, 10);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error("Los dorsales de inicio y fin deben ser numéricos.");
  }

  const filters = options.filters ?? {};
  const includeAssigned = Boolean(options.includeAssigned);

  const targets = participants
    .filter((p) => {
      if (!includeAssigned && p.bibNumber) return false;
      if (filters.distance && p.distance !== filters.distance) return false;
      if (filters.gender && p.gender !== filters.gender) return false;
      const age = calculateAge(p.birthDate, raceDate, ageCalculationMethod);
      if (typeof filters.minAge === "number" && (age === null || age < filters.minAge)) return false;
      if (typeof filters.maxAge === "number" && (age === null || age > filters.maxAge)) return false;
      return true;
    })
    .sort((a, b) => {
      const surnameCompare = a.surname.localeCompare(b.surname, "es", { sensitivity: "base" });
      if (surnameCompare !== 0) return surnameCompare;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });

  if (targets.length === 0) {
    return { updated: 0 };
  }

  const start = from;
  const end = to;
  const step = start <= end ? 1 : -1;

  const reservedBibs = new Set<string>();
  const targetIds = new Set(targets.map((t) => t.id));
  participants.forEach((p) => {
    if (targetIds.has(p.id)) return;
    if (p.bibNumber) {
      reservedBibs.add(p.bibNumber.trim());
    }
  });

  const availableBibs: string[] = [];
  for (let current = start; step === 1 ? current <= end : current >= end; current += step) {
    const candidate = String(current);
    if (!reservedBibs.has(candidate)) {
      availableBibs.push(candidate);
    }
    if (availableBibs.length >= targets.length) {
      break;
    }
  }

  if (availableBibs.length < targets.length) {
    throw new Error("El rango no tiene suficientes dorsales libres para los participantes seleccionados.");
  }

  const updates = targets.map((participant, index) => {
    const bibNumber = availableBibs[index];
    return {
      id: participant.id,
      data: {
        bibNumber,
        chipNumber: generateChipNumber(bibNumber),
      },
    };
  });

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
  const previous = await db.getRace(id);
  await db.updateRace(id, data);

  if (previous && (previous.ageCalculationMethod !== data.ageCalculationMethod || previous.eventDate !== data.eventDate)) {
    const [participants, categories] = await Promise.all([db.getParticipants(id), db.getCategories(id)]);
    const raceDate = data.eventDate ? new Date(data.eventDate) : new Date();

    const updates = participants.map((participant) => ({
      id: participant.id,
      data: {
        categoryId: assignCategory(
          { distance: participant.distance, gender: participant.gender, birthDate: participant.birthDate },
          categories,
          raceDate,
          data.ageCalculationMethod
        ),
      },
    }));

    if (updates.length > 0) {
      await db.bulkUpdateParticipants(updates);
    }
  }
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

export async function finalizeRaceTiming(
  raceId: string,
  options?: { aggregateBy?: "time" | "points"; instanceIds?: string[]; sessionIds?: string[] }
) {
  const [race, participants] = await Promise.all([db.getRace(raceId), db.getParticipants(raceId)]);
  const activeParticipants = participants.filter((participant) => !participant.replacedById);
  const aggregateBy = options?.aggregateBy ?? race?.evaluationMethod ?? "time";
  const selectedInstanceIds =
    options?.instanceIds ??
    (race?.isMultiStage && race?.instances?.length
      ? (race.includeInstancesInResult
          ? race.instances.some((instance) => instance.includeInResult)
            ? race.instances.filter((instance) => instance.includeInResult)
            : race.instances
          : race.instances.filter((instance) => instance.includeInResult)
        ).map((instance) => instance.id)
      : []);
  const selectedSessionIds =
    options?.sessionIds ?? (race?.timingAggregation === "multiple" ? (race.sessions ?? []).map((session) => session.id) : []);
  const knownStarts = activeParticipants
    .flatMap((participant) => {
      const baseTimes: number[] = [];
      if (participant.startTime) baseTimes.push(participant.startTime);
      if (participant.instanceTimes) {
        Object.values(participant.instanceTimes).forEach((instance) => {
          if (instance?.startTime) baseTimes.push(instance.startTime);
        });
      }
      return baseTimes;
    })
    .filter(Boolean) as number[];

  const raceStartTime = race?.raceStartTime ?? (knownStarts.length > 0 ? Math.min(...knownStarts) : Date.now());
  const raceEndTime = Date.now();
  const sessions = Array.isArray(race?.sessions) ? [...race!.sessions] : [];
  const sessionEntry: Race["sessions"][number] = {
    id: `${raceEndTime}`,
    label: `Final ${sessions.length + 1}`,
    startTime: raceStartTime,
    endTime: raceEndTime,
  };

  const finalAggregation =
    race?.isMultiStage || race?.timingAggregation === "multiple"
      ? {
          aggregateBy,
          instanceIds: selectedInstanceIds ?? [],
          sessionIds: selectedSessionIds ?? [],
        }
      : null;

  await db.updateRaceFields(raceId, {
    raceStartTime,
    raceEndTime,
    finalized: true,
    sessions: race?.timingAggregation === "multiple" ? [...sessions, sessionEntry] : sessions,
    finalAggregation,
  });

  if (race?.isMultiStage && (race.instances?.length ?? 0) > 0 && selectedInstanceIds.length > 0) {
    const includedInstances = race.instances.filter((instance) => selectedInstanceIds.includes(instance.id));

    if (includedInstances.length > 0) {
      const instanceIds = includedInstances.map((instance) => instance.id);
      const updates = activeParticipants
        .map((participant) => {
          const times = participant.instanceTimes ?? {};
          let total = 0;
          let earliest: number | null = participant.startTime ?? null;
          if (aggregateBy === "time") {
            for (const id of instanceIds) {
              const record = times[id];
              if (!record?.startTime || !record?.finishTime) return null;
              if (earliest === null || record.startTime < earliest) {
                earliest = record.startTime;
              }
              total += record.finishTime - record.startTime;
            }
          } else {
            total = instanceIds.reduce((acc, id) => acc + (times[id]?.points ?? 0), 0);
          }

          const aggregationFields: Partial<ParticipantFirestoreData> = {
            aggregatedType: aggregateBy,
            aggregatedValue: aggregateBy === "time" ? total : total ?? 0,
            aggregatedInstanceIds: instanceIds,
            aggregatedSessionIds: selectedSessionIds ?? [],
          };

          if (aggregateBy === "time") {
            if (earliest === null) return null;
            return {
              id: participant.id,
              data: {
                startTime: earliest,
                finishTime: earliest + total,
                ...aggregationFields,
              },
            } as { id: string; data: Partial<ParticipantFirestoreData> };
          }

          return {
            id: participant.id,
            data: aggregationFields,
          } as { id: string; data: Partial<ParticipantFirestoreData> };
        })
        .filter(Boolean) as { id: string; data: Partial<ParticipantFirestoreData> }[];

      if (updates.length > 0) {
        await db.bulkUpdateParticipants(updates);
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);

  return { raceStartTime, raceEndTime };
}

export async function resetRaceTiming(raceId: string) {
  const race = await db.getRace(raceId);
  const participants = await db.getParticipants(raceId);
  const instanceDefaults = (race?.instances ?? []).reduce(
    (acc, instance) => {
      acc[instance.id] = { startTime: null, finishTime: null };
      return acc;
    },
    {} as Record<string, { startTime: null; finishTime: null }>
  );

  await db.bulkUpdateParticipants(
    participants.map((participant) => ({
      id: participant.id,
      data: {
        startTime: null,
        finishTime: null,
        instanceTimes:
          Object.keys(participant.instanceTimes ?? {}).length > 0 || Object.keys(instanceDefaults).length > 0
            ? instanceDefaults
            : undefined,
        aggregatedType: null,
        aggregatedValue: null,
        aggregatedInstanceIds: [],
        aggregatedSessionIds: [],
      },
    }))
  );

  await db.updateRaceFields(raceId, {
    raceStartTime: null,
    raceEndTime: null,
    finalized: false,
    sessions: race?.timingAggregation === "multiple" ? [] : race?.sessions ?? [],
    finalAggregation: null,
  });

  revalidatePath("/");
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/kits/${raceId}`);

  return { cleared: participants.length };
}

export async function updateUserRole(userId: string, role: Role) {
  await db.setUserRole(userId, role);
  revalidatePath("/admin/users");
}

export async function trackVisitorEmail(email: string) {
  await db.saveVisitorEmail(email);
}
