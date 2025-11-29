

export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

// Tipo de Participante como se lee de Firestore
export type Participant = {
  id: string;
  raceId: string;
  bibNumber: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  distance: '5k' | '10k' | '21k' | '42k';
  birthDate: string; // YYYY-MM-DD
  categoryId: string | null;
  startTime: number | null;
  finishTime: number | null;
  chipNumber: string;
  city: string | null;
  province: string | null;
  country: string | null;
  isSpecial: boolean;
  kitDelivered?: boolean;
  replacedFromId?: string | null;
  replacedById?: string | null;
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
  isSpecial?: boolean;
};

export type ParticipantSnapshot = Pick<
  Participant,
  | "id"
  | "bibNumber"
  | "chipNumber"
  | "name"
  | "surname"
  | "dni"
  | "gender"
  | "distance"
  | "birthDate"
  | "categoryId"
>;

export type RunnerChange = {
  id: string;
  raceId: string;
  participantId: string;
  previous: ParticipantSnapshot;
  next: ParticipantSnapshot;
  createdAt: string;
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
  distance: '5k' | '10k' | '21k' | '42k';
};

export type CategoryInput = Omit<Category, 'id'>;

export type Race = {
  id: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
};

export type RaceInput = Omit<Race, 'id'>;
