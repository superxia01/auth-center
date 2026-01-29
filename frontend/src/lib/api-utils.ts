import { NextResponse } from 'next/server'
import { AuthErrorCode } from '@keenchase/auth-center-shared-types'

/**
 * 标准化 API 错误响应
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 创建错误响应
 */
export function createErrorResponse(code: AuthErrorCode, message: string, statusCode: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status: statusCode }
  )
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T) {
  return NextResponse.json({
    success: true,
    data,
  })
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error)

  if (error instanceof ApiError) {
    return createErrorResponse(error.code as AuthErrorCode, error.message, error.statusCode)
  }

  if (error instanceof Error) {
    return createErrorResponse(
      AuthErrorCode.UNKNOWN_ERROR,
      error.message,
      500
    )
  }

  return createErrorResponse(
    AuthErrorCode.UNKNOWN_ERROR,
    'An unknown error occurred',
    500
  )
}
