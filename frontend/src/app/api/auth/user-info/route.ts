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
  UserInfoResponse,
} from '@keenchase/auth-center-shared-types'

/**
 * 用户信息查询接口
 * GET /api/auth/user-info?token=xxx
 *
 * 验证 token 并返回用户基础信息
 */
export async function GET(request: NextRequest) {
  try {
    // 从 query 参数获取 token
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

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
      throw new ApiError(
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
      throw new ApiError(
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

      throw new ApiError(
        AuthErrorCode.TOKEN_EXPIRED,
        'Token expired',
        401
      )
    }

    // 查询用户信息
    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      select: {
        userId: true,
        phoneNumber: true,
        email: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new ApiError(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404
      )
    }

    // 返回用户信息
    const response: UserInfoResponse = {
      userId: user.userId,
      phoneNumber: user.phoneNumber || undefined,
      email: user.email || undefined,
      createdAt: user.createdAt.toISOString(),
    }

    return createSuccessResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
}
