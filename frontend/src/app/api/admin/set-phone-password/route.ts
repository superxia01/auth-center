import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  ApiError,
} from '@/lib/api-utils'
import { AuthErrorCode } from '@keenchase/auth-center-shared-types'
import { verifyAdminUser } from '@/lib/admin-utils'

/**
 * 管理员设置手机号+密码接口
 * POST /api/admin/set-phone-password
 *
 * 接收 { userId, phoneNumber, password }
 * - userId: 必填，用户ID
 * - phoneNumber: 可选，手机号（如果提供则验证格式和唯一性）
 * - password: 必填，密码（至少8位，包含字母和数字）
 *
 * 验证管理员权限（需要管理员微信登录），为用户设置手机号和密码
 */
export async function POST(request: NextRequest) {
  try {
    // 从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return createErrorResponse(
        AuthErrorCode.UNAUTHORIZED,
        'Missing authorization header',
        401
      )
    }

    const token = authHeader.substring(7)

    // 验证是否是管理员
    const isAdmin = await verifyAdminUser(token)
    if (!isAdmin) {
      return createErrorResponse(
        AuthErrorCode.FORBIDDEN,
        'You do not have admin privileges',
        403
      )
    }

    const body = await request.json()
    const { userId, phoneNumber, password } = body

    // 验证请求参数
    if (!userId || !password) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Missing required parameters: userId and password are required',
        400
      )
    }

    // 验证手机号格式（如果提供）
    if (phoneNumber && !/^1[3-9]\d{9}$/.test(phoneNumber)) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Invalid phone number format',
        400
      )
    }

    // 验证密码强度（至少8位，包含字母和数字）
    if (!validatePasswordStrength(password)) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Password must be at least 8 characters long and contain both letters and numbers',
        400
      )
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { userId: userId },
    })

    if (!user) {
      throw new ApiError(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404
      )
    }

    // 如果提供了手机号，检查是否已被其他用户使用
    if (phoneNumber) {
      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber: phoneNumber },
      })

      if (existingUser && existingUser.userId !== userId) {
        throw new ApiError(
          AuthErrorCode.INVALID_REQUEST,
          'Phone number already in use by another user',
          400
        )
      }
    }

    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, 10)

    // 更新用户信息
    await prisma.user.update({
      where: { userId: userId },
      data: {
        ...(phoneNumber && { phoneNumber }),
        passwordHash,
      },
    })

    // 返回成功响应
    return createSuccessResponse({
      success: true,
      message: 'Phone number and password set successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * 验证密码强度
 * - 至少8位
 * - 包含字母和数字
 */
function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) {
    return false
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  return hasLetter && hasNumber
}
