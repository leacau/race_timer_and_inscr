import { Gender, TimingPointType } from '@prisma/client'

export type TimingPointReading = {
  timingPointId: string
  timingPointType: TimingPointType
  recordedAt: Date
  offsetMs?: number
}

export type CalculatedSplit = {
  timingPointId: string
  elapsedMs: number
}

export type RegistrationContext = {
  registrationId: string
  participant: {
    birthDate: Date
    gender: Gender
  }
  raceStart: Date
}

export type CategoryRule = {
  id: string
  name: string
  minAge?: number | null
  maxAge?: number | null
  gender: Gender
}

export type Penalty = {
  reason: string
  milliseconds: number
  appliesTo: 'gross' | 'net'
}
