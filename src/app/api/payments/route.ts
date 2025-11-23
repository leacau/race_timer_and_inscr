import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const payment = await prisma.payment.create({
    data: {
      provider: body.provider,
      amount: body.amount,
      currency: body.currency ?? 'USD',
      status: body.status ?? 'PENDING',
      providerRef: body.providerRef,
      registrationId: body.registrationId,
    },
  })
  return NextResponse.json(payment, { status: 201 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const registrationId = searchParams.get('registrationId')
  const payments = await prisma.payment.findMany({ where: { registrationId: registrationId ?? undefined } })
  return NextResponse.json(payments)
}
