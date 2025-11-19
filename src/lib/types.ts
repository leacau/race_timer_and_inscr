

export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

// Tipo de Participante como se lee de Firestore
export type Participant = {
  id: string;
  raceId: string;
  bibNumber: string | null;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: string;
  birthDate: string; // YYYY-MM-DD
  categoryId: string | null;
  startTime: number | null;
  finishTime: number | null;
  chipNumber: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  isSpecial: boolean;
};

// Tipo para el formulario del cliente y la creación
export type ParticipantInput = {
  bibNumber?: string | null;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: string;
  birthDate: string; // YYYY-MM-DD
  city?: string;
  province?: string;
  country?: string;
  isSpecial?: boolean;
};

// Tipo para escribir en Firestore, sin id de documento
export type ParticipantFirestoreData = Omit<Participant, 'id'>;

export type Category = {
  id: string;
  raceId: string;
  name: string;
  minAge: number;
  maxAge: number;
  gender: 'Male' | 'Female' | 'Other' | 'Any';
  distance: string;
};

export type CategoryInput = Omit<Category, 'id'>;

export type Race = {
  id: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  distances: string[];
  ageCalculationMethod: AgeCalculationMethod;
  registrationsOpen: boolean;
};

export type RaceInput = Omit<Race, 'id'>;
