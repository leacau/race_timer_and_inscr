import { addYears, differenceInYears } from 'date-fns'
import { Gender } from '@prisma/client'
import { CategoryRule, RegistrationContext } from './types'

export function calculateAgeOnRaceDay(birthDate: Date, raceStart: Date) {
  return differenceInYears(raceStart, birthDate)
}

export function assignCategory(
  registration: RegistrationContext,
  categories: CategoryRule[],
): CategoryRule | undefined {
  const age = calculateAgeOnRaceDay(registration.participant.birthDate, registration.raceStart)
  const gender = registration.participant.gender
  return categories.find((category) => {
    const matchGender = category.gender === Gender.OPEN || category.gender === gender
    const minOk = category.minAge == null || age >= category.minAge
    const maxOk = category.maxAge == null || age <= category.maxAge
    return matchGender && minOk && maxOk
  })
}

export function computeBirthdateFromAge(age: number, reference: Date) {
  const startOfYear = new Date(reference.getFullYear(), 0, 1)
  return addYears(startOfYear, -age)
}
