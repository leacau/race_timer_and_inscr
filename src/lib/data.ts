
"use server";

import { db } from "./firebase";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    writeBatch,
    where,
    getDoc,
} from "firebase/firestore";
import type {
  Participant,
  Category,
  CategoryInput,
  ParticipantFirestoreData,
  Race,
  RaceInput,
  RunnerChange,
  Team,
} from "./types";

const normalizeRace = (data: Omit<Race, "id">): Omit<Race, "id"> => ({
    ageCalculationMethod: data.ageCalculationMethod ?? "raceDay",
    competitionMode: data.competitionMode ?? "individual",
    evaluationMethod: data.evaluationMethod ?? "time",
    timingAggregation: data.timingAggregation ?? "single",
    discipline: data.discipline ?? "otra",
    scoringCriteria: data.scoringCriteria ?? "",
    autoScoringRules: data.autoScoringRules ?? "",
    isRelay: data.isRelay ?? false,
    relayMeasurement: data.relayMeasurement ?? "total",
    isMultiStage: data.isMultiStage ?? false,
    includeInstancesInResult: data.includeInstancesInResult ?? false,
    instances: data.instances ?? [],
    raceStartTime: data.raceStartTime ?? null,
    raceEndTime: data.raceEndTime ?? null,
    finalized: data.finalized ?? false,
    sessions: data.sessions ?? [],
    finalAggregation: data.finalAggregation ?? null,
    name: data.name,
    eventDate: data.eventDate,
});

export async function getParticipants(raceId?: string | null): Promise<Participant[]> {
    const participantsCol = collection(db, "participants");
    const constraints = raceId
        ? [where("raceId", "==", raceId)]
        : [orderBy("bibNumber")];
    const q = query(participantsCol, ...constraints);
    const participantSnapshot = await getDocs(q);
    const participantList = participantSnapshot.docs.map(doc => {
        const data = doc.data() as ParticipantFirestoreData;
        return {
            id: doc.id,
            ...data,
        isSpecial: data.isSpecial ?? false,
        kitDelivered: data.kitDelivered ?? false,
        replacedFromId: data.replacedFromId ?? null,
        replacedById: data.replacedById ?? null,
        teamId: data.teamId ?? null,
        instanceTimes: data.instanceTimes ?? {},
        aggregatedType: data.aggregatedType ?? null,
        aggregatedValue: data.aggregatedValue ?? null,
        aggregatedInstanceIds: data.aggregatedInstanceIds ?? [],
        aggregatedSessionIds: data.aggregatedSessionIds ?? [],
    } satisfies Participant;
  });

    if (raceId) {
        participantList.sort((a, b) => a.bibNumber - b.bibNumber);
    }

    return participantList;
}

export async function getCategories(raceId?: string | null): Promise<Category[]> {
    const categoriesCol = collection(db, "categories");
    const constraints = raceId
        ? [where("raceId", "==", raceId)]
        : [orderBy("name")];
    const q = query(categoriesCol, ...constraints);
    const categorySnapshot = await getDocs(q);
    const categoryList = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

    if (raceId) {
        categoryList.sort((a, b) => a.name.localeCompare(b.name));
    }

    return categoryList;
}

export async function addParticipant(participantData: ParticipantFirestoreData): Promise<string> {
    const docRef = await addDoc(collection(db, "participants"), participantData);
    return docRef.id;
}

export async function updateParticipant(id: string, data: Partial<ParticipantFirestoreData>): Promise<void> {
    const participantRef = doc(db, "participants", id);
    await updateDoc(participantRef, data);
}

export async function getParticipant(id: string): Promise<Participant | null> {
    const participantRef = doc(db, "participants", id);
    const snapshot = await getDoc(participantRef);
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as ParticipantFirestoreData;
    return {
        id: snapshot.id,
        ...data,
        isSpecial: data.isSpecial ?? false,
        kitDelivered: data.kitDelivered ?? false,
        replacedFromId: data.replacedFromId ?? null,
        replacedById: data.replacedById ?? null,
        teamId: data.teamId ?? null,
    } satisfies Participant;
}

export async function deleteParticipant(id: string): Promise<void> {
    await deleteDoc(doc(db, "participants", id));
}

export async function updateParticipantTime(
    id: string,
    startTime: number,
    finishTime: number,
    instanceId?: string | null,
    nextInstanceId?: string | null
): Promise<void> {
    const participantRef = doc(db, "participants", id);
    if (!instanceId) {
        await updateDoc(participantRef, { startTime, finishTime });
        return;
    }

    const snapshot = await getDoc(participantRef);
    const data = snapshot.data() as ParticipantFirestoreData | undefined;
    const currentInstances = data?.instanceTimes ?? {};
    const current = currentInstances[instanceId] ?? { startTime: null, finishTime: null };
    const nextInstance = nextInstanceId ? currentInstances[nextInstanceId] ?? { startTime: null, finishTime: null } : null;

    await updateDoc(participantRef, {
        instanceTimes: {
            ...currentInstances,
            [instanceId]: { ...current, startTime, finishTime },
            ...(nextInstanceId
                ? {
                    [nextInstanceId]: {
                        ...nextInstance,
                        startTime: nextInstance?.startTime ?? finishTime,
                        finishTime: nextInstance?.finishTime ?? null,
                    },
                }
                : {}),
        },
    });
}

export async function bulkDeleteParticipants(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach(id => {
        const docRef = doc(db, "participants", id);
        batch.delete(docRef);
    });
    await batch.commit();
}

export async function bulkUpdateParticipants(
    updates: { id: string; data: Partial<ParticipantFirestoreData> }[]
): Promise<void> {
    if (updates.length === 0) return;
    const batch = writeBatch(db);
    updates.forEach(({ id, data }) => {
        const docRef = doc(db, "participants", id);
        batch.update(docRef, data);
    });
    await batch.commit();
}

export async function addCategory(category: CategoryInput): Promise<string> {
    const docRef = await addDoc(collection(db, "categories"), category);
    return docRef.id;
}

export async function updateCategory(id: string, categoryData: CategoryInput): Promise<void> {
    const categoryRef = doc(db, "categories", id);
    await updateDoc(categoryRef, categoryData);
}

export async function deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, "categories", id));
}

export async function bulkDeleteCategories(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach(id => {
        const docRef = doc(db, "categories", id);
        batch.delete(docRef);
    });
    await batch.commit();
}

export async function importParticipants(participants: ParticipantFirestoreData[]): Promise<void> {
    const participantsCol = collection(db, "participants");
    const batchSize = 499;

    for (let i = 0; i < participants.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = participants.slice(i, i + batchSize);

        for (const participant of chunk) {
            const docRef = doc(participantsCol);
            batch.set(docRef, participant);
        }
        await batch.commit();
    }
}

export async function getRaces(): Promise<Race[]> {
    const racesCol = collection(db, "races");
    const q = query(racesCol, orderBy("eventDate", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...normalizeRace(doc.data() as Omit<Race, "id">) }));
}

export async function addRace(data: RaceInput): Promise<string> {
    const payload: Omit<Race, "id"> = {
        ...data,
        raceStartTime: null,
        raceEndTime: null,
        finalized: false,
        sessions: [],
    };
    const docRef = await addDoc(collection(db, "races"), payload);
    return docRef.id;
}

export async function getRace(id: string): Promise<Race | null> {
    const raceRef = doc(db, "races", id);
    const snapshot = await getDoc(raceRef);

    if (!snapshot.exists()) {
        return null;
    }

    return { id: snapshot.id, ...normalizeRace(snapshot.data() as Omit<Race, "id">) };
}

export async function updateRace(id: string, data: RaceInput): Promise<void> {
    const raceRef = doc(db, "races", id);
    await updateDoc(raceRef, data);
}

export async function updateRaceFields(id: string, data: Partial<Omit<Race, "id">>): Promise<void> {
    const raceRef = doc(db, "races", id);
    await updateDoc(raceRef, data);
}

export async function deleteRace(id: string): Promise<void> {
    const raceRef = doc(db, "races", id);
    await deleteDoc(raceRef);
}

export async function addRunnerChange(change: Omit<RunnerChange, "id" | "createdAt"> & { createdAt?: string }) {
    const docRef = await addDoc(collection(db, "runnerChanges"), {
        ...change,
        createdAt: change.createdAt ?? new Date().toISOString(),
    });
    return docRef.id;
}

export async function getRunnerChanges(raceId: string): Promise<RunnerChange[]> {
    const changesCol = collection(db, "runnerChanges");
    const q = query(changesCol, where("raceId", "==", raceId));
    const snapshot = await getDocs(q);
    const changes = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RunnerChange, "id">) }));

    changes.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return changes;
}

export async function getTeams(raceId: string): Promise<Team[]> {
    const teamsCol = collection(db, "teams");
    const q = query(teamsCol, where("raceId", "==", raceId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Team, "id">) }));
}

export async function addTeam(team: Omit<Team, "id">): Promise<string> {
    const docRef = await addDoc(collection(db, "teams"), team);
    return docRef.id;
}

export async function updateTeam(id: string, data: Partial<Omit<Team, "id">>): Promise<void> {
    const teamRef = doc(db, "teams", id);
    await updateDoc(teamRef, data);
}

export async function deleteTeam(id: string): Promise<void> {
    const teamRef = doc(db, "teams", id);
    await deleteDoc(teamRef);
}
