import { NextRequest, NextResponse } from 'next/server'
import { validateCallbackUrl } from '@/lib/callback-validator'

/**
 * 检测是否在微信内置浏览器中
 */
function isWechatBrowser(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''

  // 检测多种微信内置浏览器的 User-Agent 特征
  return /MicroMessenger/i.test(userAgent) || // 微信
         /wxwork/i.test(userAgent) ||            // 企业微信
         /WeChat/i.test(userAgent)             // WeChat（备用）
}

/**
 * 微信登录入口（智能检测）
 * GET /api/auth/wechat/login
 *
 * - 微信内置浏览器：使用公众号授权（snsapi_userinfo）
 * - 其他浏览器（PC）：使用开放平台扫码登录（snsapi_login）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  // 🔒 安全验证：检查 callbackUrl 是否在白名单中
  if (!validateCallbackUrl(callbackUrl)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_CALLBACK_URL',
          message: '回调 URL 不在允许的域名列表中，请联系管理员',
        },
      },
      { status: 400 }
    )
  }

  // 获取配置
  const openPlatformAppId = process.env.WECHAT_APP_ID       // 开放平台网站应用
  const mpAppId = process.env.WECHAT_MP_APPID               // 公众号

  // 从请求头获取真实的 Host
  const host = request.headers.get('host') || 'os.crazyaigc.com'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  // 检测是否在微信内置浏览器
  const userAgent = request.headers.get('user-agent') || ''
  const isInWeChat = isWechatBrowser(request)

  // 调试日志
  console.log('🔍 微信登录请求:', {
    userAgent,
    isInWeChat,
    callbackUrl,
    host,
  })

  if (isInWeChat) {
    // 微信内置浏览器：使用公众号授权（获取用户信息）
    if (!mpAppId) {
      return NextResponse.json(
        { error: '公众号配置缺失，请联系管理员' },
        { status: 500 }
      )
    }

    // 公众号网页授权回调
    const redirectUri = `${protocol}://${host}/api/auth/wechat/mp-callback`
    const state = encodeURIComponent(callbackUrl)

    // 使用 snsapi_userinfo（需要用户同意，可获取 unionid 和用户信息）
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${mpAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`

    console.log('📱 跳转到公众号授权')

    return NextResponse.redirect(authUrl)
  } else {
    // 其他浏览器：使用开放平台扫码登录
    if (!openPlatformAppId) {
      return NextResponse.json(
        { error: '微信开放平台配置缺失，请联系管理员' },
        { status: 500 }
      )
    }

    // 开放平台扫码登录回调
    const redirectUri = `${protocol}://${host}/api/auth/wechat/open-platform-redirect`
    const state = encodeURIComponent(callbackUrl)

    // 使用 snsapi_login 扫码登录
    const authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${openPlatformAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`

    console.log('💻 跳转到开放平台扫码登录')

    return NextResponse.redirect(authUrl)
  }
}
