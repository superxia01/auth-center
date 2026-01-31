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
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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

interface User {
  userId: string
  unionId: string
  phoneNumber: string | null
  email: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  accounts: UserAccount[]
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

  // 搜索状态
  const [globalFilter, setGlobalFilter] = useState('')

  // 设置对话框状态
  const [settingUser, setSettingUser] = useState<User | null>(null)
  const [phonePasswordDialogOpen, setPhonePasswordDialogOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

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
            <Box sx={{ mb:3, bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
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
              管理用户账号，设置手机号和密码
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
            <Button
              onClick={handleLogout}
              variant="outlined"
              color="secondary"
            >
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
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ mb: 3, bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
          <Typography variant="body2" color="error.error">
            {error}
          </Typography>
        </Box>
      )}

      {/* Users Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">用户列表</Typography>
          <TextField
            placeholder="搜索用户ID、手机号、邮箱..."
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
            sx={{ width: 300 }}
          />
        </Box>

        <TableContainer component={Paper} elevation={0}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  'userId',
                  'unionId',
                  'phoneNumber',
                  'email',
                  'createdAt',
                  'updatedAt',
                  'lastLoginAt',
                  'loginMethods',
                  'accounts',
                  'actions',
                ].map((column) => (
                  <TableCell
                    key={column}
                    align={column === 'actions' ? 'center' : 'left'}
                    sx={{
                      fontWeight: 'bold',
                      bgcolor: 'background.paper',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      minWidth:
                        column === 'accounts'
                          ? 300
                          : column === 'actions'
                          ? 100
                          : column === 'userId' || column === 'unionId'
                          ? 250
                          : 150,
                    }}
                  >
                    {column === 'userId' && '用户ID'}
                    {column === 'unionId' && 'Union ID'}
                    {column === 'phoneNumber' && '手机号'}
                    {column === 'email' && '邮箱'}
                    {column === 'createdAt' && '注册时间'}
                    {column === 'updatedAt' && '更新时间'}
                    {column === 'lastLoginAt' && '最后登录'}
                    {column === 'loginMethods' && '登录方式'}
                    {column === 'accounts' && '账号信息'}
                    {column === 'actions' && '操作'}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">暂无用户数据</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.userId}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>{user.userId}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {user.unionId || '-'}
                    </TableCell>
                    <TableCell>{user.phoneNumber || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })
                        : '-'}
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
                      <Box sx={{ maxWidth: 300 }}>
                        {user.accounts.map((account) => (
                          <Box
                            key={account.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 1,
                              p: 1,
                              bgcolor: 'grey.50',
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              component="img"
                              src={account.avatarUrl}
                              alt={account.nickname}
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.currentTarget.src = '/vite.svg'
                              }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {account.nickname || '未设置昵称'}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {account.provider === 'wechat' ? '微信' : account.provider}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        startIcon={<SettingsIcon />}
                        onClick={() => openSetPhonePasswordDialog(user)}
                        size="small"
                        variant="outlined"
                      >
                        设置
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
            count={totalCount}
            rowsPerPage={pagination.pageSize}
            page={pagination.pageIndex}
            onPageChange={(_, newPage) => {
              setPagination({ ...pagination, pageIndex: newPage })
              fetchUsers(newPage + 1)
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
