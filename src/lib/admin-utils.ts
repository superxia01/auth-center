import { prisma } from '@/lib/prisma'
import { verifyAuthToken } from '@/lib/jwt'

/**
 * 验证用户是否是管理员
 *
 * 验证逻辑（三层账号模型）：
 * 1. 解析JWT token获取userId
 * 2. 查询用户及其关联的UserAccount（登录入口）
 * 3. 对比环境变量ADMIN_WECHAT_OPENID
 * 4. 如果未配置环境变量，开发模式下在日志中提示并允许访问
 *
 * @param token - JWT token
 * @returns 是否是管理员
 */
export async function verifyAdminUser(token: string): Promise<boolean> {
  try {
    // 解析token获取userId
    const payload = await verifyAuthToken(token)

    // 查询用户及其登录入口（UserAccount）
    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      include: {
        accounts: true,  // 关联查询 UserAccount 表
      },
    })

    if (!user) {
      return false
    }

    // 获取管理员标识（可以是 unionid 或任意一个 openid）
    const adminIdentifier = process.env.ADMIN_WECHAT_OPENID

    if (!adminIdentifier) {
      // 开发模式：未配置时在日志中提示
      console.warn('⚠️ ADMIN_WECHAT_OPENID not configured.')
      console.warn(`当前登录用户的 unionId: ${user.unionId}`)
      console.warn(`当前登录用户的 openid 列表:`, user.accounts.map(a => a.openId))
      console.warn('请将 unionId 或 openId 配置到环境变量 ADMIN_WECHAT_OPENID 中')

      // 开发模式允许访问（仅用于首次配置）
      return true
    }

    // 验证 unionid 或任意一个 openid 是否匹配
    if (user.unionId === adminIdentifier) {
      return true
    }

    return user.accounts.some(account => account.openId === adminIdentifier)
  } catch (error) {
    console.error('Verify admin error:', error)
    return false
  }
}
