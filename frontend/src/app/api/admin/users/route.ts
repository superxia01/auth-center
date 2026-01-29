import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-utils'
import { AuthErrorCode } from '@keenchase/auth-center-shared-types'
import { verifyAdminUser } from '@/lib/admin-utils'

/**
 * 获取所有用户列表（管理员API）
 * GET /api/admin/users
 *
 * 权限要求：需要管理员微信登录（Authorization: Bearer {token}）
 *
 * 返回用户列表（三层账号模型），包含：
 * - userId (统一用户ID)
 * - phoneNumber (手机号，如果有)
 * - unionId (微信UnionID - 跨应用统一标识)
 * - accountCount (登录方式数量)
 * - openId (第一个登录入口的 openId，仅用于展示)
 * - loginMethods (登录方式统计)
 * - createdAt (注册时间)
 */
export async function GET(request: NextRequest) {
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

    // 获取所有用户及其登录入口
    const users = await prisma.user.findMany({
      include: {
        accounts: true,  // 关联查询 UserAccount 表
      },
      orderBy: { createdAt: 'desc' },
    })

    // 统计信息
    const totalUsers = users.length
    const usersWithPassword = users.filter(u => u.passwordHash).length
    const usersWithWechat = users.filter(u => u.unionId || u.accounts.length > 0).length

    // 脱敏处理
    const sanitizedUsers = users.map(user => {
      // 取第一个登录入口的 openId 用于展示（如果有）
      const firstOpenId = user.accounts[0]?.openId || null

      return {
        userId: user.userId,
        phoneNumber: user.phoneNumber,
        email: user.email,
        openId: firstOpenId ? `${firstOpenId.slice(0, 10)}...` : null,
        unionId: user.unionId ? `${user.unionId.slice(0, 10)}...` : null,
        accountCount: user.accounts.length,  // 登录方式数量
        loginMethods: {
          wechat: !!(user.unionId || user.accounts.length > 0),
          password: !!user.passwordHash,
        },
        createdAt: user.createdAt,
      }
    })

    return createSuccessResponse({
      users: sanitizedUsers,
      statistics: {
        total: totalUsers,
        withPassword: usersWithPassword,
        withWechat: usersWithWechat,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
