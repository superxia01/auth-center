import { useState, useEffect } from 'react'

interface User {
  userId: string
  phoneNumber: string | null
  email: string | null
  openId: string | null
  unionId: string | null
  loginMethods: {
    wechat: boolean
    password: boolean
  }
  accounts?: any[]
  createdAt: string
}

interface Statistics {
  total: number
  withPassword: number
  withWechat: number
}

interface ApiResponse {
  success: boolean
  data?: {
    users: User[]
    statistics: Statistics
  }
  error?: {
    code: string
    message: string
  }
}

export default function AdminDashboard() {
  // 认证状态
  const [token, setToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // 数据状态
  const [users, setUsers] = useState<User[]>([])
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    withPassword: 0,
    withWechat: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 编辑状态
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // 初始化：检查URL中是否有token或code（微信登录回调）
  useEffect(() => {
    // 从URL参数获取token或code
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const urlCode = urlParams.get('code')
    const urlType = urlParams.get('type') // mp 或 open
    const storedToken = localStorage.getItem('adminToken')

    if (urlToken) {
      // 已有token，直接验证
      setToken(urlToken)
      localStorage.setItem('adminToken', urlToken)
      // 清除URL中的token参数
      window.history.replaceState({}, '', '/admin/dashboard')
      // 验证管理员权限
      verifyAdmin(urlToken)
    } else if (urlCode) {
      // 有code，需要先调用登录接口获取token
      handleWechatCode(urlCode, urlType)
    } else if (storedToken) {
      // 使用已存储的token
      setToken(storedToken)
      verifyAdmin(storedToken)
    }
  }, [])

  // 处理微信授权码（根据type参数判断是公众号还是开放平台）
  const handleWechatCode = async (code: string, type: string | null) => {
    setVerifying(true)
    setError('')

    try {
      // 优先使用 URL 中的 type 参数，如果没有则检测浏览器环境
      const loginType = type || (/micromessenger|wxwork|wechat/i.test(navigator.userAgent) ? 'mp' : 'open')

      console.log('🔐 处理微信授权码:', { code: `${code.slice(0, 10)}...`, loginType })

      let loginResponse
      if (loginType === 'mp') {
        // 微信内：使用公众号登录API
        console.log('📱 使用公众号登录API')
        loginResponse = await fetch('/api/auth/wechat/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, type: 'mp' }),
        })
      } else {
        // PC端：使用开放平台登录API
        console.log('💻 使用开放平台登录API')
        loginResponse = await fetch('/api/auth/wechat/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, type: 'open' }),
        })
      }

      const data = await loginResponse.json()

      console.log('📥 登录响应:', {
        success: data.success,
        hasToken: !!data.token,
        userId: data.userId,
        error: data.error
      })

      if (data.success && data.token) {
        const { token } = data
        setToken(token)
        localStorage.setItem('adminToken', token)
        // 清除URL中的code和type参数
        window.history.replaceState({}, '', '/admin/dashboard')
        // 验证管理员权限
        await verifyAdmin(token)
      } else {
        const errorMsg = data.error || '微信登录失败'
        console.error('❌ 登录失败:', errorMsg)

        // 提供更友好的错误提示
        let userFriendlyError = errorMsg
        if (errorMsg.includes('code') || errorMsg.includes('授权码')) {
          userFriendlyError = '授权码已失效或已被使用，请重新登录'
        } else if (errorMsg.includes('网络')) {
          userFriendlyError = '网络连接失败，请检查网络后重试'
        }

        setError(userFriendlyError)
        setIsAdmin(false)

        // 3秒后自动清除错误，并清除URL参数
        setTimeout(() => {
          window.history.replaceState({}, '', '/admin/dashboard')
          setError('')
        }, 3000)
      }
    } catch (err) {
      console.error('❌ Wechat login error:', err)
      setError('微信登录失败：网络错误')
      setIsAdmin(false)

      // 清除URL参数
      setTimeout(() => {
        window.history.replaceState({}, '', '/admin/dashboard')
      }, 3000)
    } finally {
      setVerifying(false)
    }
  }

  // 验证管理员权限
  const verifyAdmin = async (authToken: string) => {
    setVerifying(true)
    setError('')

    try {
      // 验证是否是管理员
      const verifyResponse = await fetch('/api/admin/verify', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      if (verifyResponse.ok) {
        setIsAdmin(true)
        // 加载用户列表
        await fetchUsers(authToken)
      } else {
        const data = await verifyResponse.json()
        setError(data.error?.message || '无管理员权限')
        setIsAdmin(false)
        // 清除无效token
        localStorage.removeItem('adminToken')
        setToken(null)
      }
    } catch (err) {
      console.error('Verify admin error:', err)
      setError('验证失败：网络错误')
      setIsAdmin(false)
    } finally {
      setVerifying(false)
    }
  }

  // 获取用户列表
  const fetchUsers = async (authToken: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      const data: ApiResponse = await response.json()

      if (data.success && data.data) {
        setUsers(data.data.users)
        setStatistics(data.data.statistics)
      } else {
        setError(data.error?.message || '获取用户列表失败')
      }
    } catch (err) {
      setError('网络错误：无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }

  // 微信登录（智能检测）
  const handleWechatLogin = () => {
    setError('')
    setLoading(true)

    // 🔥 前端检测是否在微信内置浏览器
    const isInWeChat = /micromessenger|wxwork|wechat/i.test(navigator.userAgent)
    console.log('🔍 前端检测结果 - 是否在微信:', isInWeChat, navigator.userAgent)

    const currentUrl = window.location.href.split('?')[0]
    const callbackUrl = encodeURIComponent(currentUrl)

    let loginUrl: string

    if (isInWeChat) {
      // 在微信中：直接调用智能检测API（会自动判断使用公众号授权）
      loginUrl = `/api/auth/wechat/login?callbackUrl=${callbackUrl}`
      console.log('📱 检测到微信环境，使用智能检测API')
    } else {
      // 非微信：使用智能检测API（会自动跳转到开放平台扫码）
      loginUrl = `/api/auth/wechat/login?callbackUrl=${callbackUrl}`
      console.log('💻 非微信环境，将使用开放平台扫码登录')
    }

    console.log('🚀 跳转到微信授权:', loginUrl)

    // 跳转到微信授权
    window.location.href = loginUrl
  }

  // 设置手机号和密码
  const handleSetPhonePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser || !token) return

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/admin/set-phone-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.userId,
          phoneNumber,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage(`成功为用户 ${selectedUser.userId} 设置手机号和密码`)
        setPhoneNumber('')
        setPassword('')
        setSelectedUser(null)

        // 刷新用户列表
        await fetchUsers(token)

        // 3秒后隐藏成功消息
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setError(data.error?.message || '设置失败')
      }
    } catch (err) {
      setError('网络错误：无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    setToken(null)
    setIsAdmin(false)
    setUsers([])
    setStatistics({ total: 0, withPassword: 0, withWechat: 0 })
  }

  // 打开编辑对话框
  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setPhoneNumber(user.phoneNumber || '')
    setPassword('')
    setError('')
  }

  // 关闭编辑对话框
  const closeEditModal = () => {
    setSelectedUser(null)
    setPhoneNumber('')
    setPassword('')
  }

  // ========== 渲染：未登录 ==========
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            账号中心 - 管理员登录
          </h1>

          <div className="space-y-4">
            <div className="text-center text-gray-600 mb-6">
              <p className="mb-2">请使用微信扫码登录</p>
              <p className="text-sm text-gray-500">只有管理员微信账号可以访问</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleWechatLogin}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '登录中...' : '微信登录'}
            </button>

            <div className="text-xs text-gray-500 text-center mt-4">
              管理员权限通过微信账号验证
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========== 渲染：验证中 ==========
  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">验证管理员权限中...</p>
        </div>
      </div>
    )
  }

  // ========== 渲染：无权限 ==========
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-red-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-red-600 mb-2">无权限访问</h1>
            <p className="text-gray-600 mb-6">{error || '您没有管理员权限'}</p>
            <button
              onClick={handleLogout}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
            >
              返回登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== 渲染：管理员界面 ==========
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                账号中心 - 用户管理
              </h1>
              <p className="text-gray-600 mt-1">
                管理用户账号，设置手机号和密码
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              退出登录
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600">总用户数</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {statistics.total}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600">已设置密码</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {statistics.withPassword}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600">微信登录</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {statistics.withWechat}
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">用户列表</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    UnionID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    手机号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    邮箱
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登录方式
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    账号信息
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注册时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {user.userId}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {user.unionId || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.phoneNumber || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        {user.loginMethods?.wechat && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            微信
                          </span>
                        )}
                        {user.loginMethods?.password && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            密码
                          </span>
                        )}
                        {!user.loginMethods?.wechat && !user.loginMethods?.password && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            未设置
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.accounts && user.accounts.length > 0 ? (
                        <div className="space-y-1">
                          {user.accounts.map((acc: any, idx: number) => (
                            <div key={idx} className="text-xs">
                              <div className="font-medium">{acc.provider === 'wechat' ? '微信' : acc.provider}</div>
                              <div className="text-gray-500">
                                {acc.type === 'web' ? '网页' :
                                 acc.type === 'mp' ? '公众号' :
                                 acc.type === 'miniapp' ? '小程序' : acc.type}
                                {acc.nickname && ` - ${acc.nickname}`}
                              </div>
                              <div className="text-gray-400 font-mono text-xs">{acc.openId}</div>
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        设置手机号/密码
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                暂无用户数据
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  设置手机号和密码
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">
                  <div>用户ID: {selectedUser.userId}</div>
                  <div className="mt-1">
                    当前登录方式:{' '}
                    {selectedUser.loginMethods.wechat && '微信 '}
                    {selectedUser.loginMethods.password && '密码'}
                    {!selectedUser.loginMethods.wechat &&
                      !selectedUser.loginMethods.password && '未设置'}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSetPhonePassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="phoneNumber"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    手机号
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入手机号（可选）"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    留空则不修改手机号
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    密码
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入密码"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    至少8位，包含字母和数字
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
