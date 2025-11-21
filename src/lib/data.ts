
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
    getDoc
} from "firebase/firestore";
import type { Participant, Category, ParticipantInput, CategoryInput } from "./types";

const removeUndefinedFields = <T extends Record<string, any>>(obj: T) => {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
};

export async function getParticipants(): Promise<Participant[]> {
    try {
        const participantsCol = collection(db, "participants");
        const q = query(participantsCol, orderBy("bibNumber"));
        const participantSnapshot = await getDocs(q);
        const participantList = participantSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
        return participantList;
    } catch (error) {
        console.error("Failed to load participants from Firestore", error);
        return [];
    }
}

export async function getCategories(): Promise<Category[]> {
    try {
        const categoriesCol = collection(db, "categories");
        const q = query(categoriesCol, orderBy("name"));
        const categorySnapshot = await getDocs(q);
        const categoryList = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        return categoryList;
    } catch (error) {
        console.error("Failed to load categories from Firestore", error);
        return [];
    }
}

export async function addParticipant(participant: ParticipantInput & { categoryId?: string, chipNumber: string }): Promise<Participant> {
    const { id, ...dataToSave } = participant as any; // Firestore fails if id is present
    const sanitizedData = removeUndefinedFields(dataToSave);
    const docRef = await addDoc(collection(db, "participants"), sanitizedData);
    return { ...sanitizedData, id: docRef.id } as Participant;
}

export async function updateParticipant(updatedParticipant: Participant): Promise<Participant | null> {
    const participantRef = doc(db, "participants", updatedParticipant.id);
    const { id, ...dataToUpdate } = updatedParticipant;
    const sanitizedData = removeUndefinedFields(dataToUpdate);
    await updateDoc(participantRef, sanitizedData);
    const updatedDoc = await getDoc(participantRef);
    if(updatedDoc.exists()) {
        return { id: updatedDoc.id, ...updatedDoc.data() } as Participant;
    }
    return null;
}


export async function deleteParticipant(id: string): Promise<void> {
    await deleteDoc(doc(db, "participants", id));
}

export async function updateParticipantTime(id: string, startTime: number, finishTime: number): Promise<void> {
    const participantRef = doc(db, "participants", id);
    await updateDoc(participantRef, { startTime, finishTime });
}

export async function addCategory(category: CategoryInput): Promise<Category> {
    const docRef = await addDoc(collection(db, "categories"), category);
    return { ...category, id: docRef.id };
}

export async function updateCategory(updatedCategory: Category): Promise<Category | null> {
    const categoryRef = doc(db, "categories", updatedCategory.id);
    const { id, ...dataToUpdate } = updatedCategory;
    await updateDoc(categoryRef, dataToUpdate);
    const updatedDoc = await getDoc(categoryRef);
    if(updatedDoc.exists()) {
        return { id: updatedDoc.id, ...updatedDoc.data() } as Category;
    }
    return null;
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


type ParticipantToCreate = ParticipantInput & { categoryId?: string; chipNumber: string };

export async function importParticipants(participants: ParticipantToCreate[]): Promise<void> {
    const participantsCol = collection(db, "participants");
    const batchSize = 500; // Firestore batch limit

    for (let i = 0; i < participants.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = participants.slice(i, i + batchSize);
        
        chunk.forEach(participant => {
            const docRef = doc(participantsCol);
            const { id, ...dataToSave } = participant as any;
            const sanitizedData = removeUndefinedFields(dataToSave);
            batch.set(docRef, sanitizedData);
        });

        await batch.commit();
    }
}
