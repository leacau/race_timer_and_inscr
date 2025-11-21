import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rankResults } from '@/domain/results'

export async function GET(_: NextRequest, { params }: { params: { raceId: string } }) {
  const raceId = params.raceId
  const results = await prisma.result.findMany({
    where: { raceId },
    include: { registration: { include: { participant: true, category: true } } },
  })

  const ranked = rankResults(
    results.map((result) => ({
      registrationId: result.registrationId,
      netMs: result.netTimeMs,
      gender: result.registration.participant.gender,
      categoryId: result.registration.categoryId,
    })),
  )

  return NextResponse.json({ results, ranks: ranked })
}
