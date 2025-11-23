import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if ('error' in auth) return auth.error
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId') || auth.payload.org

  const events = await prisma.event.findMany({
    where: { organizationId },
    include: { races: { include: { categories: true, timingPoints: true } } },
    orderBy: { startDate: 'desc' },
  })
  return NextResponse.json(events)
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if ('error' in auth) return auth.error
  const body = await request.json()

  const event = await prisma.event.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description,
      location: body.location,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      timezone: body.timezone ?? 'UTC',
      organizationId: auth.payload.org,
      races: body.races
        ? {
            create: body.races.map((race: any) => ({
              name: race.name,
              distanceKm: race.distanceKm,
              discipline: race.discipline,
              startTime: new Date(race.startTime),
              capacity: race.capacity,
            })),
          }
        : undefined,
    },
  })

  return NextResponse.json(event, { status: 201 })
}
