import { PrismaClient, RaceDiscipline, Gender, UserRole, TimingPointType, TeamType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('changeme', 10)

  const org = await prisma.organization.upsert({
    where: { slug: 'fast-timers' },
    update: {},
    create: {
      name: 'Fast Timers',
      slug: 'fast-timers',
      contactEmail: 'info@fasttimers.test',
      timezone: 'UTC',
    },
  })

  await prisma.user.upsert({
    where: { email: 'admin@fasttimers.test' },
    update: {},
    create: {
      email: 'admin@fasttimers.test',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      displayName: 'Super Admin',
      organizationId: org.id,
    },
  })

  const event = await prisma.event.upsert({
    where: { slug: 'trail-festival' },
    update: {},
    create: {
      name: 'Trail Festival',
      slug: 'trail-festival',
      description: 'Evento de trail con carreras de 10k y 21k',
      location: 'Patagonia, AR',
      startDate: new Date('2025-02-10T10:00:00Z'),
      endDate: new Date('2025-02-11T00:00:00Z'),
      status: 'PUBLISHED',
      organizationId: org.id,
    },
  })

  const race10k = await prisma.race.upsert({
    where: { id: 'seed-race-10k' },
    update: {},
    create: {
      id: 'seed-race-10k',
      name: '10K Trail',
      distanceKm: 10,
      discipline: RaceDiscipline.TRAIL,
      startTime: new Date('2025-02-10T10:00:00Z'),
      capacity: 500,
      eventId: event.id,
    },
  })

  await prisma.stage.upsert({
    where: { id: 'seed-stage-1' },
    update: {},
    create: {
      id: 'seed-stage-1',
      name: 'Etapa Única',
      order: 1,
      distanceKm: 10,
      raceId: race10k.id,
    },
  })

  const [catGeneral, catWomen] = await Promise.all([
    prisma.category.upsert({
      where: { id: 'seed-cat-general' },
      update: {},
      create: {
        id: 'seed-cat-general',
        name: 'General',
        gender: Gender.OPEN,
        minAge: null,
        maxAge: null,
        raceId: race10k.id,
      },
    }),
    prisma.category.upsert({
      where: { id: 'seed-cat-women' },
      update: {},
      create: {
        id: 'seed-cat-women',
        name: 'Femenino 30-39',
        gender: Gender.FEMALE,
        minAge: 30,
        maxAge: 39,
        raceId: race10k.id,
      },
    }),
  ])

  const timingPoints = await Promise.all([
    prisma.timingPoint.upsert({
      where: { code: 'TP-START-10K' },
      update: {},
      create: {
        name: 'Largada',
        order: 1,
        type: TimingPointType.START,
        code: 'TP-START-10K',
        raceId: race10k.id,
      },
    }),
    prisma.timingPoint.upsert({
      where: { code: 'TP-SPLIT-5K' },
      update: {},
      create: {
        name: 'Split 5K',
        order: 2,
        type: TimingPointType.SPLIT,
        code: 'TP-SPLIT-5K',
        raceId: race10k.id,
      },
    }),
    prisma.timingPoint.upsert({
      where: { code: 'TP-FINISH-10K' },
      update: {},
      create: {
        name: 'Llegada',
        order: 3,
        type: TimingPointType.FINISH,
        code: 'TP-FINISH-10K',
        raceId: race10k.id,
      },
    }),
  ])

  const participant = await prisma.participant.upsert({
    where: { email: 'runner@example.com' },
    update: {},
    create: {
      firstName: 'Camila',
      lastName: 'Gómez',
      email: 'runner@example.com',
      birthDate: new Date('1992-06-21'),
      gender: Gender.FEMALE,
      phone: '+5491112341234',
    },
  })

  await prisma.registration.upsert({
    where: { participantId_raceId: { participantId: participant.id, raceId: race10k.id } },
    update: {},
    create: {
      participantId: participant.id,
      raceId: race10k.id,
      categoryId: catWomen.id,
      status: 'CONFIRMED',
      bibNumber: 101,
      chipCode: 'CHIP-101',
      registeredAt: new Date('2025-01-10T12:00:00Z'),
    },
  })

  console.log('Seed data ready. Timing points:', timingPoints.map((t) => t.code))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
