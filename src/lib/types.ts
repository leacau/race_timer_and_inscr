
export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

// Tipo de Participante como se lee de Firestore
export type Participant = {
  id: string;
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate: string; // YYYY-MM-DD - Hacemos que sea requerido para simplificar
  categoryId: string | null;
  startTime: number | null;
  finishTime: number | null;
  chipNumber: string;
  city: string | null;
  province: string | null;
  country: string | null;
};

// Tipo para el formulario del cliente y la creación
export type ParticipantInput = {
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate: string; // YYYY-MM-DD
  city?: string;
  province?: string;
  country?: string;
};

// Tipo para escribir en Firestore, sin id de documento
export type ParticipantFirestoreData = Omit<Participant, 'id'>;

export type Category = {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  gender: 'Male' | 'Female' | 'Other' | 'Any';
  distance: '5k' | '10k' | '21k' | '42k';
};

export type CategoryInput = Omit<Category, 'id'>;
