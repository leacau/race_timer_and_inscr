import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if ('error' in auth) return auth.error

  const organizations = await prisma.organization.findMany({
    include: { events: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(organizations)
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if ('error' in auth) return auth.error
  if (auth.payload.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const created = await prisma.organization.create({
    data: {
      name: body.name,
      slug: body.slug,
      contactEmail: body.contactEmail,
      timezone: body.timezone ?? 'UTC',
    },
  })
  return NextResponse.json(created, { status: 201 })
}
