import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'

export function requireAuth(request: NextRequest) {
  const header = headers().get('authorization') || request.headers.get('authorization')
  const token = header?.replace('Bearer ', '')
  const payload = verifyToken(token || undefined)
  if (!payload) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { payload }
}
