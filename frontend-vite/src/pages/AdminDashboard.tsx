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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandMore as ExpandMoreIcon,
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
  loginSources?: { sourceHost: string; lastLoginAt: string }[]
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
          p: 4,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 30% 20%, rgba(34, 197, 94, 0.08) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Paper
          elevation={24}
          sx={{
            maxWidth: 420,
            width: '100%',
            p: 5,
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {/* Logo + Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
            <Box
              component="img"
              src="/ai-logo.png"
              alt="Logo"
              sx={{ width: 40, height: 40 }}
            />
            <Typography
              sx={{
                fontFamily: '"Fira Code", monospace',
                fontSize: 20,
                fontWeight: 600,
                color: '#1E3A8A',
                letterSpacing: '0.02em',
              }}
            >
              CRAZYAIGC
            </Typography>
            <Typography sx={{ color: 'text.secondary', mx: 0.5 }}>|</Typography>
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              账号中心
            </Typography>
          </Box>

          <Typography variant="h5" fontWeight={600} sx={{ mb: 1, color: 'grey.800' }}>
            管理员登录
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            请使用微信扫码登录，仅管理员可访问
          </Typography>

          {error && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: 'error.50',
                border: '1px solid',
                borderColor: 'error.light',
              }}
            >
              <Typography variant="body2" color="error.main">
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
              py: 1.5,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              bgcolor: '#07c160',
              boxShadow: '0 4px 14px rgba(7, 193, 96, 0.4)',
              '&:hover': {
                bgcolor: '#06ad56',
                boxShadow: '0 6px 20px rgba(7, 193, 96, 0.5)',
              },
            }}
          >
            {loading ? '登录中...' : '微信扫码登录'}
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
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src="/ai-logo.png"
            alt="Logo"
            sx={{ width: 48, height: 48, mb: 2, opacity: 0.9 }}
          />
          <CircularProgress sx={{ mb: 2, color: 'white' }} />
          <Typography color="white">验证管理员权限中...</Typography>
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
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
          p: 4,
        }}
      >
        <Paper
          elevation={24}
          sx={{
            maxWidth: 400,
            width: '100%',
            p: 5,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Box
            component="img"
            src="/ai-logo.png"
            alt="Logo"
            sx={{ width: 40, height: 40, mb: 2 }}
          />
          <Typography variant="h5" color="error.main" fontWeight={600} gutterBottom>
            无权限访问
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {error || '您没有管理员权限'}
          </Typography>
          <Button variant="contained" onClick={handleLogout} sx={{ borderRadius: 2 }}>
            返回登录
          </Button>
        </Paper>
      </Box>
    )
  }

  // ========== 渲染：管理员界面 ==========
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header - 按 logo-standards */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Box component="img" src="/ai-logo.png" alt="Logo" sx={{ width: 32, height: 32 }} />
            <Typography
              sx={{
                fontFamily: '"Fira Code", monospace',
                fontSize: 18,
                fontWeight: 600,
                color: '#1E3A8A',
              }}
            >
              CRAZYAIGC
            </Typography>
            <Typography color="text.secondary" sx={{ mx: 0.5 }}>|</Typography>
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                账号中心 - 用户管理
              </Typography>
              <Typography variant="caption" color="text.secondary">
                查看用户详细信息、登录账户和活跃会话
              </Typography>
            </Box>
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
          sx: { width: 680, maxWidth: '100%' },
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
              {/* 1. 身份标识 */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                身份标识
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">用户ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {selectedUser.userId.substring(0, 8)}...
                  </Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(selectedUser.userId, 'userId')}>
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {copied === 'userId' && <Typography variant="caption" color="success.main">已复制</Typography>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">UnionID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {selectedUser.unionId.substring(0, 12)}...
                  </Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(selectedUser.unionId, 'unionId')}>
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {copied === 'unionId' && <Typography variant="caption" color="success.main">已复制</Typography>}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">手机号</Typography>
                  <Typography variant="body2">{selectedUser.phoneNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">邮箱</Typography>
                  <Typography variant="body2">{selectedUser.email || '-'}</Typography>
                </Box>
              </Box>

              {/* 2. 注册与绑定 */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                注册与绑定
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">注册时间</Typography>
                  <Typography variant="body2">
                    {format(new Date(selectedUser.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">最后登录</Typography>
                  <Typography variant="body2">
                    {selectedUser.lastLoginAt
                      ? format(new Date(selectedUser.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })
                      : '-'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {selectedUser.accounts.map((account) => {
                  const platformInfo = getPlatformTypeInfo(account.type, account.provider)
                  return (
                    <Box
                      key={account.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                      }}
                    >
                      <Avatar src={account.avatarUrl} sx={{ width: 28, height: 28 }}>
                        {account.nickname?.charAt(0) || <AccountCircleIcon />}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {account.nickname || '未设置'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip {...platformInfo} size="small" sx={{ height: 20 }} />
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(account.createdAt), 'yyyy-MM-dd', { locale: zhCN })} 绑定
                          </Typography>
                        </Box>
                      </Box>
                      <Tooltip title="复制 AppID">
                        <IconButton size="small" onClick={() => copyToClipboard(account.appId, `appId-${account.id}`)}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                })}
              </Box>

              {/* 3. 业务足迹 */}
              {(selectedUser.loginSources?.length ?? 0) > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    业务足迹
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>业务系统</TableCell>
                          <TableCell>最近登录</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedUser.loginSources!.map((item) => (
                          <TableRow key={item.sourceHost}>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {item.sourceHost}
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* 4. 当前活跃 */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                当前活跃 ({getActiveSessionsCount(selectedUser)} / {selectedUser.sessions.length})
              </Typography>
              {selectedUser.sessions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>暂无会话</Typography>
              ) : (
                <Box sx={{ mb: 3 }}>
                  {[...selectedUser.sessions]
                    .sort((a, b) => {
                      const aExpired = new Date(a.expiresAt) < new Date()
                      const bExpired = new Date(b.expiresAt) < new Date()
                      if (aExpired !== bExpired) return aExpired ? 1 : -1
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    })
                    .map((session) => {
                      const isExpired = new Date(session.expiresAt) < new Date()
                      return (
                        <Accordion
                          key={session.id}
                          disableGutters
                          elevation={0}
                          sx={{
                            border: 1,
                            borderColor: isExpired ? 'error.light' : 'success.light',
                            bgcolor: isExpired ? 'error.50' : 'success.50',
                            '&:before': { display: 'none' },
                            '&:not(:last-child)': { mb: 1 },
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {isExpired ? <ErrorIcon color="error" fontSize="small" /> : <CheckCircleIcon color="success" fontSize="small" />}
                              <Typography variant="body2" fontWeight="medium">
                                {isExpired ? '已过期' : '活跃中'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {session.deviceInfo?.ip || '-'} · {format(new Date(session.expiresAt), 'MM-dd HH:mm', { locale: zhCN })} 过期
                              </Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: '0.8rem' }}>
                              <Box>
                                <Typography variant="caption" color="text.secondary">Token</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                    {session.token.substring(0, 36)}...
                                  </Typography>
                                  <IconButton size="small" onClick={() => copyToClipboard(session.token, `token-${session.id}`)}>
                                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary">平台</Typography>
                                <Typography variant="body2">{session.deviceInfo?.platform || '-'}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary">创建时间</Typography>
                                <Typography variant="body2">
                                  {format(new Date(session.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                </Typography>
                              </Box>
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      )
                    })}
                </Box>
              )}
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
