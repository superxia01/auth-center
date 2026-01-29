/**
 * 统一账号中心 - 共享类型定义
 *
 * 此包包含账号中心和业务系统共享的类型定义
 */

// ============================================
// 用户相关类型
// ============================================

/**
 * 统一用户 ID（账号中心的 user_id）
 */
export type AuthCenterUserId = string;

/**
 * 微信用户信息
 */
export interface WechatUserInfo {
  openId: string;
  unionId?: string;
  mpOpenId?: string;
}

/**
 * 手机号用户信息
 */
export interface PhoneUser {
  phoneNumber: string;
  passwordHash: string;
}

// ============================================
// 认证相关类型
// ============================================

/**
 * 登录方式枚举
 */
export enum LoginType {
  WECHAT = 'WECHAT',
  PHONE_PASSWORD = 'PHONE_PASSWORD',
}

/**
 * Token 信息
 */
export interface TokenInfo {
  token: string;
  userId: string;
  expiresAt: Date;
  loginType: LoginType;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  success: boolean;
  data?: {
    userId: string;
    token: string;
    expiresAt: string; // ISO 8601 格式
    loginType: LoginType;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Token 验证响应
 */
export interface VerifyTokenResponse {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * 用户信息响应
 */
export interface UserInfoResponse {
  userId: string;
  phoneNumber?: string;
  email?: string;
  createdAt: string;
}

// ============================================
// API 路径常量
// ============================================

export const AUTH_CENTER_API_PATHS = {
  // 微信登录
  WECHAT_AUTHORIZE: '/api/auth/wechat/authorize',
  WECHAT_CALLBACK: '/api/auth/wechat/callback',

  // 手机号+密码登录
  PHONE_PASSWORD_LOGIN: '/api/auth/password/login',

  // Token 管理
  VERIFY_TOKEN: '/api/auth/verify-token',
  REFRESH_TOKEN: '/api/auth/refresh-token',
  LOGOUT: '/api/auth/logout',

  // 用户信息
  USER_INFO: '/api/auth/user-info',

  // 管理API
  ADMIN_SET_PHONE_PASSWORD: '/api/admin/set-phone-password',
} as const;

// ============================================
// 错误码
// ============================================

export enum AuthErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // 微信登录错误
  WECHAT_AUTH_FAILED = 'WECHAT_AUTH_FAILED',
  WECHAT_CODE_EXPIRED = 'WECHAT_CODE_EXPIRED',
  WECHAT_USER_CANCELLED = 'WECHAT_USER_CANCELLED',

  // 手机号+密码登录错误
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PHONE_NOT_SET = 'PHONE_NOT_SET',
  PASSWORD_NOT_SET = 'PASSWORD_NOT_SET',

  // Token 错误
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 权限错误
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
}
