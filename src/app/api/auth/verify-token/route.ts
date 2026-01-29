import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthToken } from '@/lib/jwt'
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  ApiError,
} from '@/lib/api-utils'
import {
  AuthErrorCode,
  VerifyTokenResponse,
} from '@keenchase/auth-center-shared-types'

/**
 * Token 验证接口
 * POST /api/auth/verify-token
 *
 * 接收 { token }
 * 验证 token 有效性并返回用户信息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    // 验证请求参数
    if (!token) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Missing required parameter: token',
        400
      )
    }

    // 验证 JWT token
    const payload = await verifyAuthToken(token)

    if (!payload) {
      const response: VerifyTokenResponse = {
        valid: false,
        error: 'Invalid or expired token',
      }
      return createErrorResponse(
        AuthErrorCode.TOKEN_INVALID,
        'Invalid or expired token',
        401
      )
    }

    // 检查会话是否在数据库中存在且未过期
    const session = await prisma.session.findUnique({
      where: { token },
    })

    if (!session) {
      const response: VerifyTokenResponse = {
        valid: false,
        error: 'Session not found',
      }
      return createErrorResponse(
        AuthErrorCode.TOKEN_INVALID,
        'Session not found',
        401
      )
    }

    // 检查会话是否过期
    if (session.expiresAt < new Date()) {
      // 删除过期的会话
      await prisma.session.delete({
        where: { id: session.id },
      })

      const response: VerifyTokenResponse = {
        valid: false,
        error: 'Token expired',
      }
      return createErrorResponse(
        AuthErrorCode.TOKEN_EXPIRED,
        'Token expired',
        401
      )
    }

    // Token 有效
    const response: VerifyTokenResponse = {
      valid: true,
      userId: payload.userId,
    }

    return createSuccessResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
}
