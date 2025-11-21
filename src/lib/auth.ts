import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { User } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signUser(user: Pick<User, 'id' | 'email' | 'role' | 'organizationId'>) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, org: user.organizationId }, JWT_SECRET, {
    expiresIn: '12h',
  })
}

export function verifyToken(token?: string) {
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role: string; org: string }
  } catch (error) {
    return null
  }
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
