import { SignJWT, jwtVerify } from 'jose'
import type { UserRole } from '@/types/user'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-key-change-in-production'
)

const TOKEN_EXPIRATION = '7d'

export interface JwtPayload {
  userId: string
  username: string
  role: UserRole
}

/**
 * 签发 JWT token
 */
export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(JWT_SECRET)
}

/**
 * 验证 JWT token
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as UserRole,
    }
  } catch {
    return null
  }
}
