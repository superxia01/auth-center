# 账号中心 (Auth Center)

> **统一的用户认证服务** - 支持微信登录、密码登录等多种认证方式

**部署地址**: https://os.crazyaigc.com
**架构版本**: V3.0 (前后端分离)

---

## 项目架构

本项目采用前后端分离架构（V3.0 标准）：

```
auth-center/
├── frontend-vite/     # Vite + React + MUI 前端（管理员后台）
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # React 组件
│   │   └── lib/             # 工具函数
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/           # Go 后端（GORM）
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── handler/         # HTTP 处理器 (auth.go, admin.go)
│   │   ├── service/         # 业务逻辑 (jwt.go, user.go, wechat.go)
│   │   ├── repository/      # 数据访问 (GORM db.go)
│   │   ├── middleware/      # 中间件 (auth.go, cors.go, logger.go)
│   │   ├── models/          # GORM 数据模型 (user.go)
│   │   └── config/          # 配置管理 (config.go)
│   ├── go.mod
│   └── bin/server           # 编译后的二进制
│
├── prisma/            # 数据库参考模型（实际使用 GORM）
│   └── schema.prisma
│
└── docs/              # 文档
    └── ARCHITECTURE_OVERVIEW.md
```

---

## 技术栈

### 前端 (frontend-vite/)
- **构建工具**: Vite 7.2.4
- **框架**: React 19.2.0
- **语言**: TypeScript 5.9.3
- **路由**: React Router 7.13.0
- **UI 组件库**: Material-UI 7.3.7
- **样式**: Tailwind CSS 4.x
- **HTTP 客户端**: Fetch API

### 后端 (backend/)
- **语言**: Go 1.21+
- **Web 框架**: Gin (github.com/gin-gonic/gin)
- **ORM**: GORM (gorm.io/gorm)
- **数据库驱动**: PostgreSQL (gorm.io/driver/postgres)
- **认证**: JWT (github.com/golang-jwt/jwt/v5)
- **密码加密**: bcrypt (golang.org/x/crypto/bcrypt)
- **配置管理**: godotenv (github.com/joho/godotenv)

### 数据库
- **数据库**: PostgreSQL 15
- **数据库名**: auth_center_db
- **服务器**: 47.110.82.96:5432 (杭州)
- **ORM**: GORM (不使用 Prisma)

---

## 数据库表结构

### users (用户表)
```sql
CREATE TABLE users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id      VARCHAR(255) UNIQUE,      -- 微信 unionid（跨应用统一标识）
  phone_number  VARCHAR(255) UNIQUE,      -- 手机号（用于密码登录）
  password_hash VARCHAR(255),              -- 密码哈希（bcrypt，由管理员设置）
  email         VARCHAR(255) UNIQUE,       -- 邮箱
  last_login_at TIMESTAMP WITH TIME ZONE,  -- 最后登录时间
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### user_accounts (用户登录账户表)
```sql
CREATE TABLE user_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider   VARCHAR(50) NOT NULL,  -- 'wechat'
  app_id     VARCHAR(100) NOT NULL,  -- 应用 AppID
  open_id    VARCHAR(255) NOT NULL,  -- 该应用下的 openid
  type       VARCHAR(20) NOT NULL,   -- 'web' | 'mp' | 'miniapp' | 'app'
  nickname   VARCHAR(255),           -- 微信昵称
  avatar_url TEXT,                   -- 微信头像 URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, app_id, open_id)
);
```

### sessions (会话表)
```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token       VARCHAR(500) UNIQUE NOT NULL,
  device_info JSONB,                  -- 设备信息：IP, User-Agent等
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## API 端点

### 认证相关 (`/api/auth/`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/auth/wechat/login` | 重定向到微信授权页面（智能检测：公众号/开放平台） | ❌ |
| POST | `/api/auth/wechat/login` | 用 code 换取 token | ❌ |
| GET | `/api/auth/wechat/mp-redirect` | 公众号授权回调 | ❌ |
| GET | `/api/auth/wechat/open-platform-redirect` | 开放平台授权回调 | ❌ |
| POST | `/api/auth/wechat/open-platform-callback` | 开放平台授权回调（备用） | ❌ |
| POST | `/api/auth/verify-token` | 验证 token | ❌ |
| GET | `/api/auth/user-info` | 获取用户信息 | ✅ |
| **GET** | **`/api/auth/sessions`** | **获取当前用户的会话列表（新增）** | ✅ |
| POST | `/api/auth/password/login` | 密码登录 | ❌ |
| POST | `/api/auth/signout` | 登出 | ✅ |

### 管理员功能 (`/api/admin/`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/users` | 获取用户列表（**新增 sessions 数据**） | 管理员 |
| POST | `/api/admin/set-phone-password` | 设置手机号和密码 | 管理员 |
| GET | `/api/admin/verify` | 验证管理员权限 | 管理员 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

---

## 环境变量配置

### 后端 (.env)
```bash
# 数据库连接
DATABASE_URL=postgresql://nexus:nexus123@localhost:5432/auth_center_db?sslmode=disable

# JWT 密钥
AUTH_CENTER_SECRET=your-secret-key-min-32-chars

# 微信开放平台配置
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=your-secret

# 微信公众号配置
WECHAT_MP_APPID=wx1234567890abcdef
WECHAT_MP_SECRET=your-secret

# 管理员配置（微信 UnionID）
ADMIN_WECHAT_OPENID=oZh_a67J99sgfrHFX5pRPcXr0uQA

# CORS 白名单
ALLOWED_ORIGINS=https://os.crazyaigc.com,https://pr.crazyaigc.com,https://pixel.crazyaigc.com

# 回调域名白名单
ALLOWED_CALLBACK_DOMAINS=os.crazyaigc.com,pr.crazyaigc.com,pixel.crazyaigc.com,3xvs5r4nm4.coze.site,localhost

# 运行模式
GIN_MODE=release
PORT=8080
```

### 前端 (frontend-vite/.env.production)
```bash
VITE_API_URL=https://os.crazyaigc.com/api
VITE_APP_URL=https://os.crazyaigc.com
```

---

## 部署信息

### 服务器
- **位置**: 上海服务器 (101.35.120.199)
- **域名**: os.crazyaigc.com
- **SSL证书**: 有效期至 2026-04-27

### 前端部署
- **技术**: Vite + React 静态文件
- **部署方式**: Nginx 直接服务静态文件
- **构建目录**: `/var/www/auth-center-frontend/`
- **命令**:
  ```bash
  # 本地构建
  cd frontend-vite
  npm run build

  # 上传到服务器
  rsync -avz dist/ shanghai-tencent:/var/www/auth-center-frontend/
  ```

### 后端部署
- **技术**: Go API
- **运行方式**: Systemd
- **端口**: 8080
- **二进制路径**: `/var/www/auth-center-backend/bin/server`
- **服务名**: auth-center-backend

---

## 开发指南

### 前端开发
```bash
cd frontend-vite
npm install
npm run dev        # 开发模式 (http://localhost:5173)
npm run build      # 构建
```

### 后端开发
```bash
cd backend
go mod download
go run cmd/server/main.go    # 开发模式 (http://localhost:8080)

# 交叉编译（Mac → Linux）
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/server cmd/server/main.go
```

---

## 核心功能说明

### 1. 微信登录（智能检测）
- **PC 浏览器**: 跳转到开放平台扫码页面
- **微信内置浏览器**: 跳转到公众号授权页面
- **自动检测**: 通过 User-Agent 判断

### 2. 三层账号模型
```
第1层: User (用户层)
├─ userId (UUID): 统一用户ID
├─ unionId: 微信 UnionID，跨应用统一标识
└─ phoneNumber: 手机号（用于密码登录）

第2层: UserAccount (登录入口层)
├─ provider: 'wechat'
├─ appId: 应用 AppID
├─ openId: 该应用下的 openid
└─ type: 'web' | 'mp' | 'miniapp' | 'app'

第3层: Session (会话层)
├─ token: JWT token（7天有效）
└─ expiresAt: 过期时间
```

### 3. 管理员功能
- 查看所有用户列表
- 为用户设置手机号和密码
- 微信登录后自动创建用户
- 管理员通过 UnionID 验证身份

---

## 项目状态

### ✅ 已完成
- [x] 前后端分离架构（Vite + React + Go）
- [x] Go 后端完整实现
- [x] GORM 数据库模型
- [x] JWT 认证中间件
- [x] CORS 白名单中间件
- [x] 微信登录（开放平台 + 公众号）
- [x] 密码登录
- [x] 管理员后台（完整用户信息展示）
- [x] 会话管理功能（查看 sessions）
- [x] 生产环境部署

### 🚧 可优化项
- [ ] 单元测试
- [ ] API 文档（Swagger）
- [ ] CI/CD 流水线
- [ ] Docker 配置

---

## 更新日志

### 2026-02-01

**后端更新**：
- ✅ 新增 `GET /api/auth/sessions` 接口，用户可查看自己的所有会话
- ✅ 优化 `GET /api/admin/users` 接口，返回完整的 sessions 数据
- ✅ 支持查看会话详细信息（Token、IP、设备类型、平台、过期时间）

**前端更新**：
- ✅ 管理员后台重构，完整显示用户信息
- ✅ 用户列表新增"账号信息"列，显示平台类型（PC网页、公众号等）
- ✅ 用户详情抽屉显示：
  - 基本信息（userId, UnionID, 手机号, 邮箱）
  - 登录账户详情（Provider, AppID, OpenID, 平台类型）
  - 活跃会话列表（Token, IP, 设备信息, 过期时间）
  - 登录历史时间线
- ✅ 一键复制功能（复制 ID、Token 等）

**部署更新**：
- ✅ 修复 Nginx 配置，直接服务 Vite 静态文件（不再需要 Node.js）
- ✅ 前端部署路径：`/var/www/auth-center-vite-frontend/`
- ✅ 后端部署路径：`/var/www/auth-center-backend/bin/server`

**影响范围**：
- ✅ 新增接口不影响 PR/Pixel 登录
- ✅ PR/Pixel 可调用 `/api/auth/sessions` 查看用户会话
- ✅ CORS 白名单已包含所有业务系统

---

## 许可证

MIT
