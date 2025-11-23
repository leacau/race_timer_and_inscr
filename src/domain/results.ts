import { ResultStatus, TimingPointType } from '@prisma/client'
import { Penalty, TimingPointReading } from './types'
import { applyPenalties } from './penalties'

export type ResultComputation = {
  grossMs: number | null
  netMs: number | null
  splits: { timingPointId: string; elapsedMs: number }[]
  status: ResultStatus
}

export function computeResult(
  readings: TimingPointReading[],
  raceStart: Date,
  penalties: Penalty[] = [],
): ResultComputation {
  const startRead = readings.find((r) => r.timingPointType === TimingPointType.START)
  const finishRead = readings.find((r) => r.timingPointType === TimingPointType.FINISH)

  const status = !startRead
    ? ResultStatus.DNS
    : !finishRead
      ? ResultStatus.DNF
      : ResultStatus.OK

  const grossMs = finishRead && startRead ? finishRead.recordedAt.getTime() - raceStart.getTime() : null
  const netMs = finishRead && startRead ? finishRead.recordedAt.getTime() - startRead.recordedAt.getTime() : null
  const netWithPenalties = applyPenalties(netMs, penalties)

  const splits = readings
    .filter((r) => r.timingPointType === TimingPointType.SPLIT)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .map((split) => ({
      timingPointId: split.timingPointId,
      elapsedMs: split.recordedAt.getTime() - (startRead?.recordedAt.getTime() ?? raceStart.getTime()),
    }))

  return {
    grossMs,
    netMs: netWithPenalties,
    splits,
    status,
  }
}

export function rankResults(results: { registrationId: string; netMs: number | null; gender: string; categoryId?: string | null }[]) {
  const filtered = results.filter((r) => r.netMs != null) as { registrationId: string; netMs: number; gender: string; categoryId?: string | null }[]
  const sorted = filtered.sort((a, b) => a.netMs - b.netMs)

  return sorted.map((result, index) => ({
    registrationId: result.registrationId,
    overallRank: index + 1,
    genderRank:
      sorted
        .filter((r) => r.gender === result.gender)
        .findIndex((r) => r.registrationId === result.registrationId) + 1,
    categoryRank:
      sorted
        .filter((r) => r.categoryId === result.categoryId)
        .findIndex((r) => r.registrationId === result.registrationId) + 1,
  }))
}
