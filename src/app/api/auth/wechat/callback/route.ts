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

/**
 * 微信登录接口
 * POST /api/auth/wechat/callback
 *
 * 接收微信回调的 code，调用微信 API 获取 openid 和 unionid
 * 创建或更新用户，生成 JWT token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, loginType = 'mp' } = body  // mp: 公众号, open: 开放平台

    // 验证请求参数
    if (!code) {
      throw new ApiError(
        AuthErrorCode.INVALID_REQUEST,
        'Missing required parameter: code',
        400
      )
    }

    // 调用微信 API 获取用户信息（根据loginType选择公众号或开放平台）
    const wechatUserInfo = await getWechatUserInfo(code, loginType)

    // ✅ 根据登录类型确定 channel 和 appId
    const channel = loginType === 'open' ? 'web' : 'mp'
    const appId = loginType === 'open'
      ? process.env.WECHAT_APP_ID!
      : process.env.WECHAT_MP_APPID!

    // 查找或创建用户
    const user = await upsertWechatUser(
      { openId: wechatUserInfo.openId, unionId: wechatUserInfo.unionId! },
      channel,
      appId,
      wechatUserInfo.nickname,
      wechatUserInfo.headimgurl
    )

    // 生成 JWT token（7天有效期）
    const token = await createAuthToken({
      userId: user.userId,
      loginType: LoginType.WECHAT,
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
          loginType, // 记录登录方式
        },
      },
    })

    // 返回登录响应（包含完整的用户信息）
    return createSuccessResponse({
      userId: user.userId,
      token,
      expiresAt: expiresAt.toISOString(),
      loginType: LoginType.WECHAT,
      userInfo: {
        unionId: user.unionId,
        nickname: wechatUserInfo.nickname,
        headimgurl: wechatUserInfo.headimgurl,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * 调用微信 API 获取用户信息
 *
 * @param code - 微信授权码
 * @param loginType - 登录类型：'mp'（公众号）或 'open'（开放平台）
 * @returns 用户信息
 */
async function getWechatUserInfo(
  code: string,
  loginType: string
): Promise<{
  openId: string
  unionId?: string
  nickname?: string
  headimgurl?: string
}> {
  if (loginType === 'open') {
    // 开放平台扫码登录
    return await getOpenPlatformUserInfo(code)
  } else {
    // 公众号授权登录（默认）
    return await getMpUserInfo(code)
  }
}

/**
 * 调用微信公众号 API 获取用户信息
 *
 * 开发模式 Mock：当 WECHAT_MP_APPID 为空时，返回模拟数据
 */
async function getMpUserInfo(code: string): Promise<{
  openId: string
  unionId?: string
  nickname?: string
  headimgurl?: string
}> {
  const appId = process.env.WECHAT_MP_APPID       // 使用公众号AppID
  const appSecret = process.env.WECHAT_MP_SECRET  // 使用公众号AppSecret

  // 开发模式：Mock 微信 API
  if (!appId || !appSecret) {
    console.warn('⚠️ WECHAT_MP_APPID or WECHAT_MP_SECRET not configured. Using mock mode.')

    // 使用 code 生成一个确定的 openId 和 unionId
    const mockOpenId = `mock_openid_${code.substring(0, 8)}`
    const mockUnionId = `mock_unionid_${code.substring(0, 8)}`

    return {
      openId: mockOpenId,
      unionId: mockUnionId,
      nickname: 'Mock User',
      headimgurl: undefined,
    }
  }

  // 生产模式：调用真实的微信公众号API
  const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token'
  const tokenParams = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: 'authorization_code',
  })

  const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`)
  const tokenData = await tokenResponse.json()

  if (tokenData.errcode) {
    console.error('WeChat MP API Error:', tokenData)

    if (tokenData.errcode === 40029) {
      throw new ApiError(
        AuthErrorCode.WECHAT_CODE_EXPIRED,
        'WeChat authorization code has expired',
        400
      )
    }

    throw new ApiError(
      AuthErrorCode.WECHAT_AUTH_FAILED,
      tokenData.errmsg || 'WeChat authentication failed',
      500
    )
  }

  const { access_token, openid } = tokenData

  // ✅ 必须调用 userinfo 接口获取 unionid 和用户详细信息
  let nickname: string | undefined
  let headimgurl: string | undefined
  let unionid: string | undefined

  if (access_token && openid) {
    try {
      console.log('🔍 调用公众号 userinfo 接口获取 unionid...')
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`
      const userInfoResponse = await fetch(userInfoUrl)
      const userData = await userInfoResponse.json()

      if (userData.errcode) {
        console.error('❌ 公众号 userinfo 接口返回错误:', userData)
        throw new ApiError(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          `获取用户信息失败: ${userData.errmsg} (错误码: ${userData.errcode})`,
          500
        )
      }

      // ✅ 验证是否获取到 unionid
      if (!userData.unionid) {
        console.error('❌ 无法获取 unionid，请确认公众号已绑定到微信开放平台')
        throw new ApiError(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          '无法获取统一用户标识，请确保公众号已绑定到微信开放平台',
          500
        )
      }

      nickname = userData.nickname
      headimgurl = userData.headimgurl
      unionid = userData.unionid

      console.log('✅ 成功获取公众号用户信息:', {
        openid: openid ? `${openid.slice(0, 10)}...` : null,
        unionid: unionid ? `${unionid.slice(0, 10)}...` : null,
        nickname,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      console.error('❌ 调用公众号 userinfo 接口失败:', error)
      throw new ApiError(
        AuthErrorCode.UNKNOWN_ERROR,
        '获取用户信息失败，请重试',
        500
      )
    }
  }

  return {
    openId: openid,
    unionId: unionid!, // 必须有 unionid
    nickname,
    headimgurl,
  }
}

/**
 * 调用微信开放平台 API 获取用户信息（PC扫码登录）
 */
async function getOpenPlatformUserInfo(code: string): Promise<{
  openId: string
  unionId?: string
  nickname?: string
  headimgurl?: string
}> {
  const appId = process.env.WECHAT_APP_ID       // 开放平台网站应用AppID
  const appSecret = process.env.WECHAT_APP_SECRET  // 开放平台AppSecret

  // 开发模式：Mock 微信 API
  if (!appId || !appSecret) {
    console.warn('⚠️ WECHAT_APP_ID or WECHAT_APP_SECRET not configured. Using mock mode.')

    const mockOpenId = `mock_openid_${code.substring(0, 8)}`
    const mockUnionId = `mock_unionid_${code.substring(0, 8)}`

    return {
      openId: mockOpenId,
      unionId: mockUnionId,
      nickname: 'Mock User',
      headimgurl: undefined,
    }
  }

  // 生产模式：调用真实的微信开放平台API
  const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token'
  const tokenParams = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: 'authorization_code',
  })

  const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`)
  const tokenData = await tokenResponse.json()

  if (tokenData.errcode) {
    console.error('WeChat Open Platform API Error:', tokenData)

    if (tokenData.errcode === 40029) {
      throw new ApiError(
        AuthErrorCode.WECHAT_CODE_EXPIRED,
        'WeChat authorization code has expired',
        400
      )
    }

    throw new ApiError(
      AuthErrorCode.WECHAT_AUTH_FAILED,
      tokenData.errmsg || 'WeChat authentication failed',
      500
    )
  }

  const { access_token, openid } = tokenData

  // ✅ 必须调用 userinfo 接口获取 unionid 和用户详细信息
  let nickname: string | undefined
  let headimgurl: string | undefined
  let unionid: string | undefined

  if (access_token && openid) {
    try {
      console.log('🔍 调用开放平台 userinfo 接口获取 unionid...')
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`
      const userInfoResponse = await fetch(userInfoUrl)
      const userData = await userInfoResponse.json()

      if (userData.errcode) {
        console.error('❌ 开放平台 userinfo 接口返回错误:', userData)
        throw new ApiError(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          `获取用户信息失败: ${userData.errmsg} (错误码: ${userData.errcode})`,
          500
        )
      }

      // ✅ 验证是否获取到 unionid
      if (!userData.unionid) {
        console.error('❌ 无法获取 unionid，请确认应用已绑定到微信开放平台')
        throw new ApiError(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          '无法获取统一用户标识，请确保应用已绑定到微信开放平台',
          500
        )
      }

      nickname = userData.nickname
      headimgurl = userData.headimgurl
      unionid = userData.unionid

      console.log('✅ 成功获取开放平台用户信息:', {
        openid: openid ? `${openid.slice(0, 10)}...` : null,
        unionid: unionid ? `${unionid.slice(0, 10)}...` : null,
        nickname,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      console.error('❌ 调用开放平台 userinfo 接口失败:', error)
      throw new ApiError(
        AuthErrorCode.UNKNOWN_ERROR,
        '获取用户信息失败，请重试',
        500
      )
    }
  }

  return {
    openId: openid,
    unionId: unionid!, // 必须有 unionid
    nickname,
    headimgurl,
  }
}

/**
 * 创建或更新微信用户（标准三层账号模型）
 *
 * 核心原则：unionid = 人，openid = 登录入口
 *
 * @param wechatUserInfo - 微信用户信息
 * @param channel - 登录渠道：'web' | 'mp' | 'miniapp'
 * @param appId - 应用 AppID
 * @param nickname - 用户昵称（可选）
 * @param avatarUrl - 用户头像（可选）
 */
async function upsertWechatUser(
  wechatUserInfo: { openId: string; unionId: string },
  channel: 'web' | 'mp' | 'miniapp',
  appId: string,
  nickname?: string,
  avatarUrl?: string
) {
  const { openId, unionId } = wechatUserInfo

  console.log('🔍 开始处理用户登录:', {
    openId: openId ? `${openId.slice(0, 10)}...` : null,
    unionId: unionId ? `${unionId.slice(0, 10)}...` : null,
    channel,
    appId,
  })

  // ✅ 优先级 1：通过 unionid 查找用户（最强标识）
  let user = await prisma.user.findUnique({
    where: { unionId },
    include: { accounts: true },
  })

  if (user) {
    console.log('✅ 通过 unionid 找到用户:', { userId: user.userId })
  } else {
    console.log('⚠️ 未找到用户，将创建新用户')
  }

  // ✅ 如果没找到用户，创建新用户
  if (!user) {
    user = await prisma.user.create({
      data: {
        unionId, // unionid 是必须的
      },
      include: { accounts: true },
    })
    console.log('✅ 创建新用户:', { userId: user.userId, unionId })
  }

  // ✅ 检查是否已存在该账号（登录入口）
  const existingAccount = user.accounts.find(
    (acc) => acc.provider === 'wechat' && acc.appId === appId && acc.openId === openId
  )

  if (existingAccount) {
    console.log('✅ 该登录入口已绑定，跳过:', {
      accountId: existingAccount.id,
    })
  } else {
    // 绑定新的登录入口
    await prisma.userAccount.create({
      data: {
        userId: user.userId,
        provider: 'wechat',
        appId,
        openId,
        type: channel,
        nickname,
        avatarUrl,
      },
    })
    console.log('✅ 绑定登录入口成功:', {
      userId: user.userId,
      appId,
      type: channel,
      openId: openId ? `${openId.slice(0, 10)}...` : null,
    })
  }

  return user
}
