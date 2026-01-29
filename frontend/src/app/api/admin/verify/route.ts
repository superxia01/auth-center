import { NextRequest } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { verifyAdminUser } from '@/lib/admin-utils'
import { AuthErrorCode } from '@keenchase/auth-center-shared-types'

/**
 * 管理员权限验证API
 * GET /api/admin/verify
 *
 * 验证当前用户是否是管理员
 *
 * 请求头：
 * - Authorization: Bearer {token}
 *
 * 响应：
 * - 200: { success: true, data: { isAdmin: true } }
 * - 401: { success: false, error: { code: 'UNAUTHORIZED', message: '...' } }
 * - 403: { success: false, error: { code: 'FORBIDDEN', message: '...' } }
 */
export async function GET(request: NextRequest) {
  try {
    // 从header获取token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return createErrorResponse(
        AuthErrorCode.UNAUTHORIZED,
        'Missing or invalid authorization header',
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

    return createSuccessResponse({ isAdmin: true })
  } catch (error) {
    console.error('Admin verify error:', error)
    return createErrorResponse(
      AuthErrorCode.UNKNOWN_ERROR,
      'Failed to verify admin privileges',
      500
    )
  }
}
