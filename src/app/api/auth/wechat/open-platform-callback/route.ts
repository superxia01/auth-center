import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { createAuthToken } from '@/lib/jwt'
import { LoginType, AuthErrorCode } from '@keenchase/auth-center-shared-types'

/**
 * 微信开放平台扫码登录回调
 * POST /api/auth/wechat/open-platform/callback
 *
 * 处理开放平台网站应用的扫码登录回调
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return createErrorResponse(
        AuthErrorCode.INVALID_REQUEST,
        'Missing required parameter: code',
        400
      )
    }

    // 调用微信开放平台API获取access_token和openid
    const openPlatformAppId = process.env.WECHAT_APP_ID
    const openPlatformAppSecret = process.env.WECHAT_APP_SECRET

    if (!openPlatformAppId || !openPlatformAppSecret) {
      return createErrorResponse(
        AuthErrorCode.INVALID_REQUEST,
        'WeChat open platform not configured',
        500
      )
    }

    // 获取access_token
    const tokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token'
    const tokenParams = new URLSearchParams({
      appid: openPlatformAppId,
      secret: openPlatformAppSecret,
      code,
      grant_type: 'authorization_code',
    })

    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`)
    const tokenData = await tokenResponse.json()

    if (tokenData.errcode) {
      console.error('WeChat Open Platform Error:', tokenData)
      return createErrorResponse(
        AuthErrorCode.WECHAT_AUTH_FAILED,
        tokenData.errmsg || 'WeChat authentication failed',
        500
      )
    }

    const { access_token, openid } = tokenData

    // ✅ 必须调用 userinfo 接口获取 unionid
    let userInfo: {
      unionid?: string
      nickname?: string
      headimgurl?: string
      errcode?: number
      errmsg?: string
    } = {}

    try {
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`
      console.log('🔍 调用微信 userinfo 接口获取 unionid...')
      const userInfoResponse = await fetch(userInfoUrl)
      userInfo = await userInfoResponse.json()

      if (userInfo.errcode) {
        console.error('❌ 微信 userinfo 接口返回错误:', userInfo)
        return createErrorResponse(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          `获取用户信息失败: ${userInfo.errmsg} (错误码: ${userInfo.errcode})`,
          500
        )
      }

      // ✅ 验证是否获取到 unionid
      if (!userInfo.unionid) {
        console.error('❌ 无法获取 unionid，请确认应用已绑定到微信开放平台')
        return createErrorResponse(
          AuthErrorCode.WECHAT_AUTH_FAILED,
          '无法获取统一用户标识，请确保应用已绑定到微信开放平台',
          500
        )
      }

      console.log('✅ 成功获取 unionid:', {
        openid: openid ? `${openid.slice(0, 10)}...` : null,
        unionid: userInfo.unionid ? `${userInfo.unionid.slice(0, 10)}...` : null,
        nickname: userInfo.nickname,
      })
    } catch (error) {
      console.error('❌ 调用 userinfo 接口失败:', error)
      return createErrorResponse(
        AuthErrorCode.UNKNOWN_ERROR,
        '获取用户信息失败，请重试',
        500
      )
    }

    // 查找或创建用户（使用 userInfo 中的 unionid）
    const user = await upsertWechatUser(
      { openId: openid, unionId: userInfo.unionid! },
      'web', // PC 网页登录
      openPlatformAppId,
      userInfo.nickname,
      userInfo.headimgurl
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
          loginType: 'open-platform',
        },
      },
    })

    console.log('✅ 开放平台扫码登录成功:', {
      userId: user.userId,
      openId: openid ? `${openid.slice(0, 10)}...` : null,
      unionId: userInfo.unionid ? `${userInfo.unionid.slice(0, 10)}...` : null,
    })

    return createSuccessResponse({
      userId: user.userId,
      token,
      expiresAt: expiresAt.toISOString(),
      loginType: LoginType.WECHAT,
      userInfo: {
        openId: user.openId,
        unionId: user.unionId,
        nickname: userInfo.nickname,
        headimgurl: userInfo.headimgurl,
      },
    })
  } catch (error) {
    console.error('Open platform callback error:', error)
    return createErrorResponse(
      AuthErrorCode.UNKNOWN_ERROR,
      'Failed to process open platform callback',
      500
    )
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
