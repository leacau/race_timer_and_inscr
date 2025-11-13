
import type { Category, ParticipantInput, AgeCalculationMethod } from "./types";
import { calculateAge } from "./utils";

export const assignCategory = (
  participant: Pick<ParticipantInput, "distance" | "gender" | "birthDate">,
  categories: Category[],
  raceDate: Date,
  ageCalculationMethod: AgeCalculationMethod
): string | null => {
  const age = calculateAge(participant.birthDate, raceDate, ageCalculationMethod);
  
  if (age === null) return null;

  for (const category of categories) {
    if (
      participant.distance === category.distance &&
      (category.gender === "Any" || category.gender === participant.gender) &&
      age >= category.minAge &&
      age <= category.maxAge
    ) {
      return category.id;
    }
  }
  return null;
};
