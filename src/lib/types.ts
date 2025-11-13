export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

export type Participant = {
  id: string;
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate?: string | null; // YYYY-MM-DD
  age?: number | null;
  categoryId?: string | null;
  startTime?: number | null;
  finishTime?: number | null;
  chipNumber?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

// Type for creating a new participant, from client form or import
export type ParticipantInput = {
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate?: string | null;
  age?: number | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

// Type for data being written to Firestore, must not have undefined
export type ParticipantFirestoreData = {
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate: string | null;
  age: number | null;
  categoryId: string | null;
  startTime: number | null;
  finishTime: number | null;
  chipNumber: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}


export type Category = {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  gender: 'Male' | 'Female' | 'Other' | 'Any';
  distance: '5k' | '10k' | '21k' | '42k';
};

export type CategoryInput = Omit<Category, 'id'>;
