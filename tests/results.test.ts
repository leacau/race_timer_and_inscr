import { describe, expect, it } from 'vitest'
import { computeResult, rankResults } from '@/domain/results'
import { TimingPointType } from '@prisma/client'

const raceStart = new Date('2025-05-01T12:00:00Z')

describe('result computation', () => {
  it('calculates gross and net time with splits', () => {
    const start = new Date('2025-05-01T12:00:05Z')
    const finish = new Date('2025-05-01T12:52:10Z')
    const split = new Date('2025-05-01T12:25:00Z')
    const result = computeResult(
      [
        { timingPointId: 'start', timingPointType: TimingPointType.START, recordedAt: start },
        { timingPointId: 'split', timingPointType: TimingPointType.SPLIT, recordedAt: split },
        { timingPointId: 'finish', timingPointType: TimingPointType.FINISH, recordedAt: finish },
      ],
      raceStart,
    )

    expect(result.grossMs).toBe(finish.getTime() - raceStart.getTime())
    expect(result.netMs).toBe(finish.getTime() - start.getTime())
    expect(result.splits[0].elapsedMs).toBe(split.getTime() - start.getTime())
  })

  it('flags DNS and DNF states', () => {
    const dns = computeResult([], raceStart)
    expect(dns.status).toBe('DNS')

    const dnf = computeResult(
      [{ timingPointId: 'start', timingPointType: TimingPointType.START, recordedAt: raceStart }],
      raceStart,
    )
    expect(dnf.status).toBe('DNF')
  })
})

describe('ranking logic', () => {
  it('assigns overall, gender and category ranks', () => {
    const ranks = rankResults([
      { registrationId: 'a', netMs: 1000, gender: 'MALE', categoryId: 'cat1' },
      { registrationId: 'b', netMs: 900, gender: 'FEMALE', categoryId: 'cat2' },
      { registrationId: 'c', netMs: 1100, gender: 'MALE', categoryId: 'cat1' },
    ])

    const fastest = ranks.find((r) => r.registrationId === 'b')
    expect(fastest?.overallRank).toBe(1)
    const maleRank = ranks.find((r) => r.registrationId === 'a')
    expect(maleRank?.genderRank).toBe(1)
  })
})
