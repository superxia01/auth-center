import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthToken } from '@/lib/jwt'
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  ApiError,
} from '@/lib/api-utils'
import {
  LoginType,
  AuthErrorCode,
  LoginResponse,
} from '@keenchase/auth-center-shared-types'
import bcrypt from 'bcrypt'

/**
 * 手机号+密码登录接口
 * POST /api/auth/password/login
 *
 * 接收 { phoneNumber, password }
 * 验证密码，生成 JWT token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, password } = body

    // 验证请求参数
    if (!phoneNumber || !password) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Missing required parameters: phoneNumber and password are required',
        400
      )
    }

    // 验证手机号格式（简单验证）
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Invalid phone number format',
        400
      )
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    })

    if (!user) {
      throw new ApiError(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found with this phone number',
        401
      )
    }

    // 检查用户是否设置了密码
    if (!user.passwordHash) {
      throw new ApiError(
        AuthErrorCode.PASSWORD_NOT_SET,
        'Password not set for this user. Please contact administrator.',
        401
      )
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      throw new ApiError(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid phone number or password',
        401
      )
    }

    // 生成 JWT token（7天有效期）
    const token = await createAuthToken({
      userId: user.userId,
      loginType: LoginType.PHONE_PASSWORD,
    })

    // 计算 token 过期时间
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // 保存会话到数据库
    await prisma.session.create({
      data: {
        userId: user.userId,
        token,
        expiresAt,
        deviceInfo: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown',
        },
      },
    })

    // 返回登录响应
    const response: LoginResponse = {
      success: true,
      data: {
        userId: user.userId,
        token,
        expiresAt: expiresAt.toISOString(),
        loginType: LoginType.PHONE_PASSWORD,
      },
    }

    return createSuccessResponse(response.data)
  } catch (error) {
    return handleApiError(error)
  }
}
