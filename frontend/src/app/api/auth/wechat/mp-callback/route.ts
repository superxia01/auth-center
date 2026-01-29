import { NextRequest } from 'next/server'
import { validateCallbackUrl } from '@/lib/callback-validator'

/**
 * 微信公众号授权回调重定向页面
 * GET /api/auth/wechat/mp-callback
 *
 * 接收公众号授权回调，重定向到前端页面并携带code
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return new Response('Missing code parameter', { status: 400 })
  }

  // 解析回调URL
  const callbackUrl = decodeURIComponent(state || '/')

  // 🔒 安全验证：检查 callbackUrl 是否在白名单中
  if (!validateCallbackUrl(callbackUrl)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_CALLBACK_URL',
          message: '回调 URL 不在允许的域名列表中，请联系管理员',
        },
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  console.log('📱 公众号授权回调:', {
    code: code ? `${code.slice(0, 10)}...` : null,
    callbackUrl,
  })

  // 重定向到前端页面，携带code和loginType
  const url = new URL(callbackUrl, request.url)
  url.searchParams.set('code', code)
  url.searchParams.set('type', 'mp') // 标识为公众号登录

  return Response.redirect(url.toString())
}
