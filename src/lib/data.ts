
// This file simulates a database.
import type { Participant, Category, ParticipantInput, CategoryInput } from "./types";

let participants: Participant[] = [
  { id: '1', name: 'John', surname: 'Doe', dni: '12345678', gender: 'Male', birthDate: '1990-05-15', distance: '10k', categoryId: 'cat1', bibNumber: '101', chipNumber: 'LT00101' },
  { id: '2', name: 'Jane', surname: 'Smith', dni: '87654321', gender: 'Female', birthDate: '1985-11-20', distance: '10k', categoryId: 'cat2', bibNumber: '102', chipNumber: 'LT00102' },
  { id: '3', name: 'Peter', surname: 'Jones', dni: '11223344', gender: 'Male', birthDate: '2000-01-10', distance: '5k', categoryId: 'cat3', bibNumber: '103', chipNumber: 'LT00103' },
];

let categories: Category[] = [
  { id: 'cat1', name: 'Masculino 30-39 10k', minAge: 30, maxAge: 39, gender: 'Male', distance: '10k' },
  { id: 'cat2', name: 'Femenino 30-39 10k', minAge: 30, maxAge: 39, gender: 'Female', distance: '10k' },
  { id: 'cat3', name: 'Masculino 18-29 5k', minAge: 18, maxAge: 29, gender: 'Male', distance: '5k' },
];

// In a real app, you would use a persistent database.
// The "db" object simulates asynchronous database calls.
export const db = {
  participants,
  categories,
};

// Simulate API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getParticipants(): Promise<Participant[]> {
  await delay(100);
  // Sort participants by surname, then name
  return [...db.participants].sort((a, b) => {
    return parseInt(a.bibNumber) - parseInt(b.bibNumber);
  });
}

export async function getCategories(): Promise<Category[]> {
  await delay(100);
  return [...db.categories].sort((a, b) => a.name.localeCompare(b.name));
}

export async function addParticipant(participant: ParticipantInput & { categoryId?: string, chipNumber: string }): Promise<Participant> {
  await delay(100);
  const newParticipant: Participant = { ...participant, id: String(Date.now()) };
  db.participants.push(newParticipant);
  return newParticipant;
}

export async function updateParticipant(updatedParticipant: Participant): Promise<Participant | null> {
    await delay(100);
    const index = db.participants.findIndex(p => p.id === updatedParticipant.id);
    if (index !== -1) {
        db.participants[index] = { ...db.participants[index], ...updatedParticipant };
        return db.participants[index];
    }
    return null;
}

export async function deleteParticipant(id: string): Promise<void> {
    await delay(100);
    db.participants = db.participants.filter(p => p.id !== id);
}

export async function updateParticipantTime(id: string, startTime: number, finishTime: number): Promise<void> {
    await delay(100);
    const index = db.participants.findIndex(p => p.id === id);
    if (index !== -1) {
        db.participants[index].startTime = startTime;
        db.participants[index].finishTime = finishTime;
    }
}

export async function addCategory(category: CategoryInput): Promise<Category> {
  await delay(100);
  const newCategory: Category = { ...category, id: String(Date.now()) };
  db.categories.push(newCategory);
  return newCategory;
}

export async function updateCategory(updatedCategory: Category): Promise<Category | null> {
    await delay(100);
    const index = db.categories.findIndex(c => c.id === updatedCategory.id);
    if (index !== -1) {
        db.categories[index] = updatedCategory;
        return db.categories[index];
    }
    return null;
}

export async function deleteCategory(id: string): Promise<void> {
    await delay(100);
    db.categories = db.categories.filter(c => c.id !== id);
}

export async function bulkDeleteCategories(ids: string[]): Promise<void> {
    await delay(100);
    db.categories = db.categories.filter(c => !ids.includes(c.id));
}