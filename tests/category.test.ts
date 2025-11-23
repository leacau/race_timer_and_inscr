import { describe, expect, it } from 'vitest'
import { assignCategory, calculateAgeOnRaceDay } from '@/domain/category'
import { Gender } from '@prisma/client'

describe('category assignment', () => {
  it('matches category by age and gender', () => {
    const raceStart = new Date('2025-03-01T10:00:00Z')
    const registration = {
      registrationId: 'reg-1',
      participant: { birthDate: new Date('1990-06-20'), gender: Gender.MALE },
      raceStart,
    }
    const categories = [
      { id: 'open', name: 'General', minAge: null, maxAge: null, gender: Gender.OPEN },
      { id: 'adulto', name: 'Adultos 30-39', minAge: 30, maxAge: 39, gender: Gender.MALE },
    ]

    const chosen = assignCategory(registration, categories)
    expect(chosen?.id).toBe('adulto')
  })

  it('calculates age on race day', () => {
    const age = calculateAgeOnRaceDay(new Date('2000-01-15'), new Date('2025-01-14'))
    expect(age).toBe(24)
  })
})
