/**
 * Callback URL 域名白名单验证
 *
 * 用于验证业务系统的回调 URL 是否在允许的域名列表中
 * 防止开放重定向攻击和未授权业务系统接入
 */

/**
 * 默认允许的回调域名白名单
 */
const DEFAULT_ALLOWED_DOMAINS = [
  'pr.crazyaigc.com',
  'www.crazyaigc.com',
  'os.crazyaigc.com',
  'localhost', // 开发环境
]

/**
 * 解析环境变量中的域名白名单
 * 格式：ALLOWED_CALLBACK_DOMAINS="domain1.com,domain2.com,*.example.com"
 */
function parseEnvDomains(): string[] {
  const envValue = process.env.ALLOWED_CALLBACK_DOMAINS
  if (!envValue) return []

  return envValue
    .split(',')
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0)
}

/**
 * 获取所有允许的域名（默认 + 环境变量）
 */
function getAllowedDomains(): string[] {
  const envDomains = parseEnvDomains()
  return [...DEFAULT_ALLOWED_DOMAINS, ...envDomains]
}

/**
 * 检查域名是否匹配（支持通配符 *.example.com）
 */
function isDomainMatch(hostname: string, allowedDomain: string): boolean {
  // 精确匹配
  if (hostname === allowedDomain) {
    return true
  }

  // 通配符匹配（*.example.com）
  if (allowedDomain.startsWith('*.')) {
    const baseDomain = allowedDomain.slice(2) // 去掉 *.
    return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
  }

  return false
}

/**
 * 验证 callbackUrl 是否在白名单中
 *
 * @param callbackUrl - 要验证的回调 URL
 * @returns true 如果合法，false 如果非法
 */
export function validateCallbackUrl(callbackUrl: string): boolean {
  try {
    const url = new URL(callbackUrl)
    const hostname = url.hostname

    const allowedDomains = getAllowedDomains()

    // 检查域名是否在白名单中
    const isAllowed = allowedDomains.some(domain =>
      isDomainMatch(hostname, domain)
    )

    if (!isAllowed) {
      console.error('❌ Callback URL 域名不在白名单中:', {
        callbackUrl,
        hostname,
        protocol: url.protocol,
        allowedDomains,
      })
      return false
    }

    // ✅ 必须是 https 或 localhost
    if (url.protocol !== 'https:' && hostname !== 'localhost') {
      console.error('❌ Callback URL 必须使用 HTTPS:', {
        callbackUrl,
        protocol: url.protocol,
      })
      return false
    }

    console.log('✅ Callback URL 验证通过:', {
      callbackUrl,
      hostname,
    })

    return true
  } catch (error) {
    console.error('❌ Callback URL 格式错误:', {
      callbackUrl,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * 获取当前允许的域名列表（用于调试和管理）
 */
export function getAllowedDomainsList(): string[] {
  return getAllowedDomains()
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}
