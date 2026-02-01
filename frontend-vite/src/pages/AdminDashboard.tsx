import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  InputAdornment,
  Chip,
  TablePagination,
  TableFooter,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  IconButton,
  Tooltip,
  Avatar,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ContentCopy as ContentCopyIcon,
  Computer as ComputerIcon,
  Phone as PhoneIcon,
  PhoneIphone as PhoneIphoneIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface DeviceInfo {
  userAgent?: string
  ip?: string
  platform?: string
  deviceType?: string
}

interface UserAccount {
  id: string
  provider: string
  appId: string
  openId: string
  type: string
  nickname: string
  avatarUrl: string
  createdAt: string
}

interface Session {
  id: string
  token: string
  deviceInfo: DeviceInfo | null
  expiresAt: string
  createdAt: string
}

interface User {
  userId: string
  unionId: string
  phoneNumber: string | null
  email: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  accounts: UserAccount[]
  sessions: Session[]
  loginMethods: {
    wechat: boolean
    password: boolean
  }
}

interface ApiResponse {
  success: boolean
  data?: {
    users: User[]
    statistics: {
      total: number
      withPassword: number
      wechatLogin: number
    }
    pagination: {
      total: number
      page: number
      pageSize: number
    }
  }
  error?: string
}

export default function AdminDashboard() {
  // 认证状态
  const [token, setToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // 数据状态
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 分页状态
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [totalCount, setTotalCount] = useState(0)

  // 搜索和筛选状态
  const [globalFilter, setGlobalFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // 用户详情抽屉状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // 设置对话框状态
  const [settingUser, setSettingUser] = useState<User | null>(null)
  const [phonePasswordDialogOpen, setPhonePasswordDialogOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // 复制成功提示
  const [copied, setCopied] = useState<string | null>(null)

  // 初始化
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const urlCode = urlParams.get('code')
    const urlType = urlParams.get('type')
    const storedToken = localStorage.getItem('adminToken')

    if (urlToken) {
      setToken(urlToken)
      localStorage.setItem('adminToken', urlToken)
      window.history.replaceState({}, '', '/admin/dashboard')
      verifyAdmin(urlToken)
    } else if (urlCode) {
      handleWechatCode(urlCode, urlType)
    } else if (storedToken) {
      setToken(storedToken)
      verifyAdmin(storedToken)
    }
  }, [])

  // 获取用户列表
  const fetchUsers = async (currentPage = pagination.pageIndex + 1) => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/admin/users?page=${currentPage}&pageSize=${pagination.pageSize}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data: ApiResponse = await response.json()

      if (data.success && data.data) {
        setUsers(data.data.users)
        setTotalCount(data.data.pagination.total)
      } else {
        setError(data.error || '获取用户列表失败')
      }
    } catch (err) {
      setError('网络错误：无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }

  // 验证管理员权限
  const verifyAdmin = async (authToken: string) => {
    setVerifying(true)
    setError('')

    try {
      const verifyResponse = await fetch('/api/admin/verify', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (verifyResponse.ok) {
        setIsAdmin(true)
        await fetchUsers()
      } else {
        const data = await verifyResponse.json()
        setError(data.error?.message || '无管理员权限')
        setIsAdmin(false)
        localStorage.removeItem('adminToken')
        setToken(null)
      }
    } catch (err) {
      setError('验证失败：网络错误')
      setIsAdmin(false)
    } finally {
      setVerifying(false)
    }
  }

  // 处理微信授权码
  const handleWechatCode = async (code: string, type: string | null) => {
    setVerifying(true)
    setError('')

    try {
      const loginType = type || (/micromessenger|wxwork|wechat/i.test(navigator.userAgent) ? 'mp' : 'open')

      const loginResponse = await fetch('/api/auth/wechat/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, type: loginType }),
      })

      const data = await loginResponse.json()

      if (data.success && data.token) {
        const { token } = data
        setToken(token)
        localStorage.setItem('adminToken', token)
        window.history.replaceState({}, '', '/admin/dashboard')
        await verifyAdmin(token)
      } else {
        setError(data.error || '微信登录失败')
        setIsAdmin(false)
      }
    } catch (err) {
      setError('微信登录失败：网络错误')
      setIsAdmin(false)
    } finally {
      setVerifying(false)
    }
  }

  // 微信登录
  const handleWechatLogin = () => {
    setError('')
    const currentUrl = window.location.href.split('?')[0]
    const callbackUrl = encodeURIComponent(currentUrl)
    window.location.href = `/api/auth/wechat/login?callbackUrl=${callbackUrl}`
  }

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    setToken(null)
    setIsAdmin(false)
    setUsers([])
  }

  // 刷新数据
  const handleRefresh = () => {
    fetchUsers()
  }

  // 打开用户详情抽屉
  const openUserDrawer = (user: User) => {
    setSelectedUser(user)
    setDrawerOpen(true)
  }

  // 关闭抽屉
  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedUser(null)
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 获取平台类型信息
  const getPlatformTypeInfo = (type: string, provider: string) => {
    if (provider === 'password') {
      return {
        label: '手机密码',
        icon: <LockIcon fontSize="small" />,
        color: 'warning' as const,
      }
    }

    switch (type) {
      case 'web':
        return {
          label: 'PC网页',
          icon: <ComputerIcon fontSize="small" />,
          color: 'primary' as const,
        }
      case 'mp':
        return {
          label: '公众号',
          icon: <PhoneIphoneIcon fontSize="small" />,
          color: 'success' as const,
        }
      case 'miniapp':
        return {
          label: '小程序',
          icon: <PhoneIcon fontSize="small" />,
          color: 'info' as const,
        }
      case 'app':
        return {
          label: 'APP',
          icon: <PhoneIcon fontSize="small" />,
          color: 'info' as const,
        }
      default:
        return {
          label: type,
          icon: <AccountCircleIcon fontSize="small" />,
          color: 'default' as const,
        }
    }
  }

  // 生成历史事件列表
  const generateHistory = (user: User) => {
    const events: Array<{
      title: string
      description: string
      timestamp: string
      type: 'register' | 'account' | 'session'
      status: 'success' | 'primary' | 'warning' | 'error'
    }> = []

    // 按时间排序所有事件
    const allEvents: Array<{ type: string; data: any; timestamp: string }> = []

    // 注册事件
    allEvents.push({
      type: 'register',
      data: user,
      timestamp: user.createdAt,
    })

    // 账号绑定事件
    user.accounts.forEach((acc) => {
      allEvents.push({
        type: 'account',
        data: acc,
        timestamp: acc.createdAt,
      })
    })

    // 会话创建事件（只显示最近10个）
    user.sessions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .forEach((sess) => {
        allEvents.push({
          type: 'session',
          data: sess,
          timestamp: sess.createdAt,
        })
      })

    // 排序
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 转换为事件列表
    allEvents.forEach((event) => {
      switch (event.type) {
        case 'register':
          events.push({
            title: '🎉 用户注册',
            description: `UnionID: ${user.unionId.substring(0, 20)}...`,
            timestamp: event.timestamp,
            type: 'register',
            status: 'success',
          })
          break
        case 'account':
          const acc = event.data as UserAccount
          const platformInfo = getPlatformTypeInfo(acc.type, acc.provider)
          events.push({
            title: `🔗 绑定${platformInfo.label}`,
            description: `昵称: ${acc.nickname || '未设置'}`,
            timestamp: event.timestamp,
            type: 'account',
            status: 'primary',
          })
          break
        case 'session':
          const sess = event.data as Session
          const isExpired = new Date(sess.expiresAt) < new Date()
          events.push({
            title: isExpired ? '⏰ 会话已过期' : '🔐 会话创建',
            description: `设备: ${sess.deviceInfo?.deviceType || '未知设备'} | IP: ${sess.deviceInfo?.ip || '未知'}`,
            timestamp: event.timestamp,
            type: 'session',
            status: isExpired ? 'error' : 'success',
          })
          break
      }
    })

    return events
  }

  // 计算活跃会话数
  const getActiveSessionsCount = (user: User) => {
    return user.sessions.filter((s) => new Date(s.expiresAt) > new Date()).length
  }

  // 打开设置对话框
  const openSetPhonePasswordDialog = (user: User) => {
    setSettingUser(user)
    setPhoneNumber(user.phoneNumber || '')
    setPassword('')
    setPhonePasswordDialogOpen(true)
    setError('')
  }

  // 关闭对话框
  const closeDialog = () => {
    setPhonePasswordDialogOpen(false)
    setSettingUser(null)
    setPhoneNumber('')
    setPassword('')
  }

  // 保存手机号和密码
  const handleSavePhonePassword = async () => {
    if (!settingUser) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/set-phone-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: settingUser.userId,
          phoneNumber,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        closeDialog()
        fetchUsers() // 刷新列表
      } else {
        setError(data.error || '设置失败')
      }
    } catch (err) {
      setError('网络错误：设置失败')
    } finally {
      setSaving(false)
    }
  }

  // 过滤用户
  const filteredUsers = users.filter((user) => {
    // 搜索过滤
    if (globalFilter) {
      const searchLower = globalFilter.toLowerCase()
      const matchSearch =
        user.userId.toLowerCase().includes(searchLower) ||
        user.unionId.toLowerCase().includes(searchLower) ||
        user.phoneNumber?.includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.accounts.some(
          (acc) =>
            acc.nickname?.toLowerCase().includes(searchLower) ||
            acc.openId.toLowerCase().includes(searchLower) ||
            acc.appId.toLowerCase().includes(searchLower)
        )

      if (!matchSearch) return false
    }

    // Provider 过滤
    if (providerFilter !== 'all') {
      const hasProvider = user.accounts.some((acc) => acc.provider === providerFilter)
      if (!hasProvider) return false
    }

    // Type 过滤
    if (typeFilter !== 'all') {
      const hasType = user.accounts.some((acc) => acc.type === typeFilter)
      if (!hasType) return false
    }

    return true
  })

  // ========== 渲染：未登录 ==========
  if (!token) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          p: 4,
        }}
      >
        <Paper sx={{ maxWidth: 500, width: '100%', p: 8 }}>
          <Typography variant="h4" align="center" gutterBottom>
            账号中心 - 管理员登录
          </Typography>

          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              请使用微信扫码登录
            </Typography>
            <Typography variant="caption" color="text.secondary">
              只有管理员微信账号可以访问
            </Typography>
          </Box>

          {error && (
            <Box sx={{ mb: 3, bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
              <Typography variant="body2" color="error.error">
                {error}
              </Typography>
            </Box>
          )}

          <Button
            onClick={handleWechatLogin}
            disabled={loading}
            fullWidth
            variant="contained"
            size="large"
            sx={{
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            {loading ? '登录中...' : '微信登录'}
          </Button>
        </Paper>
      </Box>
    )
  }

  // ========== 渲染：验证中 ==========
  if (verifying) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>验证管理员权限中...</Typography>
        </Box>
      </Box>
    )
  }

  // ========== 渲染：无权限 ==========
  if (!isAdmin) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          p: 4,
        }}
      >
        <Paper sx={{ maxWidth: 400, width: '100%', p: 8, textAlign: 'center' }}>
          <Typography variant="h4" color="error.main" gutterBottom>
            无权限访问
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {error || '您没有管理员权限'}
          </Typography>
          <Button variant="contained" onClick={handleLogout}>
            返回登录
          </Button>
        </Paper>
      </Box>
    )
  }

  // ========== 渲染：管理员界面 ==========
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              账号中心 - 用户管理
            </Typography>
            <Typography variant="body2" color="text.secondary">
              查看用户详细信息、登录账户和活跃会话
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
              variant="outlined"
            >
              刷新
            </Button>
            <Button onClick={handleLogout} variant="outlined" color="secondary">
              退出登录
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Paper sx={{ flex: 1, p: 3, textAlign: 'center' }}>
          <Typography variant="h3" color="primary">
            {totalCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            总用户数
          </Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 3, textAlign: 'center' }}>
          <Typography variant="h3" color="success">
            {users.reduce((sum, u) => sum + getActiveSessionsCount(u), 0)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            活跃会话数
          </Typography>
        </Paper>
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ mb: 3, bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
          <Typography variant="body2" color="error.error">
            {error}
          </Typography>
        </Box>
      )}

      {/* Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="搜索用户ID、手机号、邮箱、昵称、OpenID..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            size="small"
            sx={{ width: 300, flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>登录方式</InputLabel>
            <Select
              value={providerFilter}
              label="登录方式"
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="wechat">微信</MenuItem>
              <MenuItem value="password">密码</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>平台类型</InputLabel>
            <Select
              value={typeFilter}
              label="平台类型"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="web">PC网页</MenuItem>
              <MenuItem value="mp">公众号</MenuItem>
              <MenuItem value="miniapp">小程序</MenuItem>
              <MenuItem value="app">APP</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Users Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer component={Paper} elevation={0}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  用户ID
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  手机号/邮箱
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  登录方式
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    minWidth: 200,
                  }}
                >
                  账号信息
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  账户数
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  会话数
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  注册时间
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">暂无用户数据</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.userId}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Tooltip title={user.userId}>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          {user.userId.substring(0, 8)}...
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {user.phoneNumber && (
                          <Typography variant="body2">{user.phoneNumber}</Typography>
                        )}
                        {user.email && (
                          <Typography variant="caption" color="text.secondary">
                            {user.email}
                          </Typography>
                        )}
                        {!user.phoneNumber && !user.email && (
                          <Typography color="text.secondary">-</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.loginMethods.wechat && (
                          <Chip label="微信" size="small" color="success" />
                        )}
                        {user.loginMethods.password && (
                          <Chip label="密码" size="small" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {user.accounts.map((account) => {
                          const platformInfo = getPlatformTypeInfo(account.type, account.provider)
                          return (
                            <Box key={account.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {platformInfo.label}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                                {account.nickname || '未设置'}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    </TableCell>
                    <TableCell>{user.accounts.length}</TableCell>
                    <TableCell>
                      <Chip
                        label={getActiveSessionsCount(user)}
                        size="small"
                        color={getActiveSessionsCount(user) > 0 ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        onClick={() => openUserDrawer(user)}
                        size="small"
                        variant="outlined"
                      >
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TableFooter>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={filteredUsers.length}
            rowsPerPage={pagination.pageSize}
            page={pagination.pageIndex}
            onPageChange={(_, newPage) => {
              setPagination({ ...pagination, pageIndex: newPage })
            }}
            onRowsPerPageChange={(e) => {
              const newPageSize = parseInt(e.target.value, 10)
              setPagination({ pageIndex: 0, pageSize: newPageSize })
              fetchUsers(1)
            }}
            sx={{ '& .MuiTablePagination-toolbar': { pl: 2 } }}
          />
        </TableFooter>
      </Paper>

      {/* 用户详情抽屉 */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: 600, maxWidth: '100%' },
        }}
      >
        {selectedUser && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 抽屉头部 */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">用户详情</Typography>
              <IconButton onClick={closeDrawer} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            {/* 抽屉内容 */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {/* 基本信息 */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📌 基本信息
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          用户ID:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {selectedUser.userId}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(selectedUser.userId, 'userId')}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        {copied === 'userId' && (
                          <Typography variant="caption" color="success.main">
                            已复制!
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          UnionID:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {selectedUser.unionId}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(selectedUser.unionId, 'unionId')}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        {copied === 'unionId' && (
                          <Typography variant="caption" color="success.main">
                            已复制!
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        手机号:
                      </Typography>
                      <Typography variant="body2">{selectedUser.phoneNumber || '-'}</Typography>
                    </Box>
                    <Box sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        邮箱:
                      </Typography>
                      <Typography variant="body2">{selectedUser.email || '-'}</Typography>
                    </Box>
                    <Box sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        注册时间:
                      </Typography>
                      <Typography variant="body2">
                        {format(new Date(selectedUser.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </Typography>
                    </Box>
                    <Box sx={{ width: '50%' }}>
                      <Typography variant="caption" color="text.secondary">
                        最后登录:
                      </Typography>
                      <Typography variant="body2">
                        {selectedUser.lastLoginAt
                          ? format(new Date(selectedUser.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })
                          : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* 登录账户 */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🔐 登录账户 ({selectedUser.accounts.length})
                  </Typography>
                  {selectedUser.accounts.map((account) => (
                    <Box
                      key={account.id}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Avatar src={account.avatarUrl} sx={{ width: 32, height: 32 }}>
                          {account.nickname?.charAt(0) || <AccountCircleIcon />}
                        </Avatar>
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Typography variant="body2" fontWeight="bold">
                              {account.nickname || '未设置昵称'}
                            </Typography>
                            <Chip
                              {...getPlatformTypeInfo(account.type, account.provider)}
                              size="small"
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Box display="flex" flexDirection="column" gap={1} mt={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Provider:
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {account.provider}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            AppID:
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {account.appId}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(account.appId, `appId-${account.id}`)}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            OpenID:
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {account.openId.substring(0, 30)}...
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(account.openId, `openId-${account.id}`)}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            绑定时间:
                          </Typography>
                          <Typography variant="body2">
                            {format(new Date(account.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>

              {/* 活跃会话 */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    💻 活跃会话 ({getActiveSessionsCount(selectedUser)} / {selectedUser.sessions.length})
                  </Typography>
                  {selectedUser.sessions.length === 0 ? (
                    <Typography color="text.secondary">暂无会话</Typography>
                  ) : (
                    selectedUser.sessions.map((session) => {
                      const isExpired = new Date(session.expiresAt) < new Date()
                      return (
                        <Box
                          key={session.id}
                          sx={{
                            mb: 2,
                            p: 2,
                            border: 1,
                            borderColor: isExpired ? 'error.main' : 'success.main',
                            borderRadius: 1,
                            bgcolor: isExpired ? 'error.50' : 'success.50',
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            {isExpired ? <ErrorIcon color="error" /> : <CheckCircleIcon color="success" />}
                            <Typography variant="body2" fontWeight="bold">
                              {isExpired ? '已过期' : '活跃中'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ({session.deviceInfo?.deviceType || '未知设备'})
                            </Typography>
                          </Box>

                          <Box display="flex" flexDirection="column" gap={1} mt={1}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Token:
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                  {session.token.substring(0, 40)}...
                                </Typography>
                                <IconButton size="small" onClick={() => copyToClipboard(session.token, `token-${session.id}`)}>
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                IP:
                              </Typography>
                              <Typography variant="body2">{session.deviceInfo?.ip || '-'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                平台:
                              </Typography>
                              <Typography variant="body2">{session.deviceInfo?.platform || '-'}</Typography>
                            </Box>
                            <Box sx={{ width: '50%' }}>
                              <Typography variant="caption" color="text.secondary">
                                创建时间:
                              </Typography>
                              <Typography variant="body2">
                                {format(new Date(session.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                              </Typography>
                            </Box>
                            <Box sx={{ width: '50%' }}>
                              <Typography variant="caption" color="text.secondary">
                                过期时间:
                              </Typography>
                              <Typography variant="body2" color={isExpired ? 'error' : 'success'}>
                                {format(new Date(session.expiresAt), 'MM-dd HH:mm', { locale: zhCN })}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              {/* 时间线 */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📊 登录历史时间线
                  </Typography>
                  <Box>
                    {generateHistory(selectedUser).map((event, index) => (
                      <Box
                        key={index}
                        sx={{
                          mb: 2,
                          p: 2,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: event.status === 'error' ? 'error.50' : event.status === 'success' ? 'success.50' : 'primary.50',
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {event.type === 'register' && <AccountCircleIcon color="success" />}
                          {event.type === 'account' && <CheckCircleIcon color="primary" />}
                          {event.type === 'session' && (
                            event.status === 'error' ? (
                              <ErrorIcon color="error" />
                            ) : (
                              <CheckCircleIcon color="success" />
                            )
                          )}
                          <Typography variant="body2" fontWeight="bold">
                            {event.title}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {event.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* 抽屉底部操作 */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button
                fullWidth
                startIcon={<SettingsIcon />}
                onClick={() => {
                  closeDrawer()
                  openSetPhonePasswordDialog(selectedUser)
                }}
                variant="outlined"
              >
                设置手机号密码
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* 设置手机号密码对话框 */}
      <Dialog open={phonePasswordDialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>设置手机号和密码</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              用户ID: {settingUser?.userId}
            </Typography>
            <TextField
              fullWidth
              label="手机号"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              margin="normal"
              placeholder="请输入手机号"
            />
            <TextField
              fullWidth
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              placeholder="留空则不修改密码"
              helperText="如不修改密码，请留空"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSavePhonePassword} variant="contained" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
