import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signUser, verifyPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const token = signUser(user)
  return NextResponse.json({ token, role: user.role, organizationId: user.organizationId })
}
