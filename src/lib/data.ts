
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
    getDoc
} from "firebase/firestore";
import type { Participant, Category, ParticipantInput, CategoryInput } from "./types";


export async function getParticipants(): Promise<Participant[]> {
    const participantsCol = collection(db, "participants");
    const q = query(participantsCol, orderBy("bibNumber"));
    const participantSnapshot = await getDocs(q);
    const participantList = participantSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
    return participantList;
}

export async function getCategories(): Promise<Category[]> {
    const categoriesCol = collection(db, "categories");
    const q = query(categoriesCol, orderBy("name"));
    const categorySnapshot = await getDocs(q);
    const categoryList = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    return categoryList;
}

export async function addParticipant(participant: ParticipantInput & { categoryId?: string, chipNumber: string }): Promise<string> {
    
    const dataToSave: { [key: string]: any } = {
        bibNumber: participant.bibNumber,
        name: participant.name,
        surname: participant.surname,
        dni: participant.dni,
        gender: participant.gender,
        distance: participant.distance,
        chipNumber: participant.chipNumber,
        startTime: null,
        finishTime: null,
    };

    if (participant.birthDate) dataToSave.birthDate = participant.birthDate;
    if (participant.age !== undefined) dataToSave.age = participant.age;
    if (participant.categoryId) dataToSave.categoryId = participant.categoryId;
    if (participant.city) dataToSave.city = participant.city;
    if (participant.province) dataToSave.province = participant.province;
    if (participant.country) dataToSave.country = participant.country;
    
    const docRef = await addDoc(collection(db, "participants"), dataToSave);
    return docRef.id;
}

export async function updateParticipant(updatedParticipant: Participant): Promise<void> {
    const { id, ...data } = updatedParticipant;
    const participantRef = doc(db, "participants", id);
    
    const dataToSave: { [key: string]: any } = {
        bibNumber: data.bibNumber,
        name: data.name,
        surname: data.surname,
        dni: data.dni,
        gender: data.gender,
        distance: data.distance,
        chipNumber: data.chipNumber,
    };

    if (data.birthDate) dataToSave.birthDate = data.birthDate;
    if (data.age !== undefined) dataToSave.age = data.age;
    if (data.categoryId) dataToSave.categoryId = data.categoryId;
    if (data.city) dataToSave.city = data.city;
    if (data.province) dataToSave.province = data.province;
    if (data.country) dataToSave.country = data.country;
    if (data.startTime) dataToSave.startTime = data.startTime;
    if (data.finishTime) dataToSave.finishTime = data.finishTime;

    await updateDoc(participantRef, dataToSave);
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
    const batchSize = 499;

    for (let i = 0; i < participants.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = participants.slice(i, i + batchSize);

        for (const participant of chunk) {
            const docRef = doc(participantsCol);
            const { bibNumber, name, surname, dni, gender, distance, chipNumber, birthDate, age, categoryId, city, province, country } = participant;
            const dataToSave: { [key: string]: any } = {
                bibNumber,
                name,
                surname,
                dni,
                gender,
                distance,
                chipNumber,
                startTime: null,
                finishTime: null,
            };

            if (birthDate) dataToSave.birthDate = birthDate;
            if (age !== undefined) dataToSave.age = age;
            if (categoryId) dataToSave.categoryId = categoryId;
            if (city) dataToSave.city = city;
            if (province) dataToSave.province = province;
            if (country) dataToSave.country = country;
            
            batch.set(docRef, dataToSave);
        }
        await batch.commit();
    }
}
