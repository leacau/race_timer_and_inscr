import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assignCategory } from '@/domain/category'
import { RegistrationContext, CategoryRule } from '@/domain/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const registrations = await prisma.registration.findMany({
    where: { participant: { email } },
    include: { race: true, category: true, payments: true },
    orderBy: { registeredAt: 'desc' },
  })
  return NextResponse.json(registrations)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const race = await prisma.race.findUnique({
    where: { id: body.raceId },
    include: { categories: true },
  })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  const participant = await prisma.participant.upsert({
    where: { email: body.participant.email },
    update: body.participant,
    create: body.participant,
  })

  const context: RegistrationContext = {
    registrationId: '',
    participant: {
      birthDate: new Date(participant.birthDate),
      gender: participant.gender,
    },
    raceStart: race.startTime,
  }

  const category = assignCategory(
    context,
    race.categories.map(
      (cat): CategoryRule => ({
        id: cat.id,
        name: cat.name,
        gender: cat.gender,
        minAge: cat.minAge,
        maxAge: cat.maxAge,
      }),
    ),
  )

  const registration = await prisma.registration.create({
    data: {
      participantId: participant.id,
      raceId: race.id,
      categoryId: category?.id,
      status: 'PENDING',
    },
    include: { category: true, participant: true },
  })

  return NextResponse.json(registration, { status: 201 })
}
