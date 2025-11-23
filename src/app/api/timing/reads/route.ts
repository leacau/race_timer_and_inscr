import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeResult } from '@/domain/results'
import { TimingPointReading } from '@/domain/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { registrationId, timingPointCode, recordedAt } = body

  const timingPoint = await prisma.timingPoint.findUnique({ where: { code: timingPointCode } })
  if (!timingPoint) return NextResponse.json({ error: 'Invalid timing point' }, { status: 404 })

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { race: true, participant: true, timeReads: { include: { timingPoint: true } } },
  })

  if (!registration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  await prisma.timeRead.upsert({
    where: { registrationId_timingPointId: { registrationId, timingPointId: timingPoint.id } },
    update: { recordedAt: new Date(recordedAt) },
    create: { recordedAt: new Date(recordedAt), registrationId, timingPointId: timingPoint.id },
  })

  const refreshed = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { timeReads: { include: { timingPoint: true } }, race: true, participant: true },
  })

  if (!refreshed) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  const readings: TimingPointReading[] = refreshed.timeReads.map((read) => ({
    timingPointId: read.timingPointId,
    timingPointType: read.timingPoint.type,
    recordedAt: read.recordedAt,
  }))

  const computed = computeResult(readings, refreshed.race.startTime)

  await prisma.result.upsert({
    where: { registrationId },
    update: {
      grossTimeMs: computed.grossMs ?? undefined,
      netTimeMs: computed.netMs ?? undefined,
      status: computed.status,
    },
    create: {
      registrationId,
      raceId: refreshed.raceId,
      grossTimeMs: computed.grossMs ?? undefined,
      netTimeMs: computed.netMs ?? undefined,
      status: computed.status,
    },
  })

  return NextResponse.json({ ok: true, computed })
}
