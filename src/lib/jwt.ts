import { SignJWT, jwtVerify } from 'jose'

// ✅ 安全修复：生产环境必须设置 AUTH_CENTER_SECRET
const secret = new TextEncoder().encode(
  process.env.AUTH_CENTER_SECRET ?? (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AUTH_CENTER_SECRET environment variable is required in production. ' +
        'Please set it in your .env.production file.'
      )
    }
    // 开发环境使用默认值（仅用于本地开发）
    console.warn('⚠️ Using default AUTH_CENTER_SECRET for development. Set AUTH_CENTER_SECRET in .env.local for better security.')
    return 'auth-center-development-secret-change-me'
  })()
)

export interface AuthTokenPayload {
  userId: string
  loginType: 'WECHAT' | 'PHONE_PASSWORD'
  iat?: number
  exp?: number
}

/**
 * 创建认证 Token（有效期 7 天）
 */
export async function createAuthToken(payload: AuthTokenPayload): Promise<string> {
  return await new SignJWT({ userId: payload.userId, loginType: payload.loginType })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

/**
 * 验证认证 Token
 */
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as AuthTokenPayload
  } catch (error) {
    return null
  }
}
