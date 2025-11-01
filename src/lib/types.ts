export type Participant = {
  id: string;
  name: string;
  surname: string;
  dni: string;
  gender: 'Male' | 'Female' | 'Other';
  birthDate: string; // YYYY-MM-DD
  distance: '5k' | '10k' | '21k' | '42k';
  categoryId?: string;
  startTime?: number; // timestamp
  finishTime?: number; // timestamp
};

export type ParticipantInput = Omit<Participant, 'id' | 'categoryId' | 'startTime' | 'finishTime'>;

export type Category = {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  gender: 'Male' | 'Female' | 'Other' | 'Any';
  distance: '5k' | '10k' | '21k' | '42k';
};

export type CategoryInput = Omit<Category, 'id'>;
