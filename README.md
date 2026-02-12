# 账号中心 (Auth Center)

> **统一的用户认证服务** - 支持微信登录、密码登录等多种认证方式
> **统一 Token 模式** - 所有登录方式统一返回 token，简化业务系统对接

**部署地址**: https://os.crazyaigc.com
**架构版本**: V3.1 (统一 Token 模式)
**最后更新**: 2026-02-06

---

## 项目架构

本项目采用前后端分离架构（V3.1 标准）：

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

---

## 🆕 V3.1 新特性：统一 Token 模式

### 核心改造

从 **混合模式**（PC 传 code + type，微信内传 userId + token）统一为 **Token 模式**（所有场景都传 token）。

### 改造内容

#### 前端简化
```typescript
// ❌ 改造前：需要判断两种情况
if (token && userId) {
  // 微信内登录
} else if (code && type) {
  // PC 扫码登录
}

// ✅ 改造后：统一处理
if (token) {
  // 所有登录方式
}
```

#### 后端统一
```go
// ✅ auth-center 变化
OpenPlatformRedirect:
  改造前: 返回 code + type
  改造后: 完成登录，返回 token

// ✅ 业务系统后端
AuthCenterMiddleware:
  1. 验证 auth-center token
  2. 获取用户信息（包含 unionID、昵称、头像）
  3. 创建/更新本地用户
  4. 存入上下文
```

### 好处

1. **代码简化**：前端代码减少 30-40%
2. **架构统一**：所有业务系统使用相同认证模式
3. **自动化**：新用户首次登录自动创建
4. **完整性**：获取 unionID、昵称、头像等完整信息
5. **安全性**：token 不在 URL 中暴露

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
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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

## 📡 API 端点

### 认证相关 (`/api/auth/`)

| 方法 | 路径 | 说明 | 认证 | V3.1 变化 |
|------|------|------|------|----------|
| GET | `/api/auth/wechat/login` | 重定向到微信授权页面（智能检测） | ❌ | ✅ 统一返回 token |
| POST | `/api/auth/wechat/login` | 用 code 换取 token（**保留兼容**） | ❌ | - |
| GET | `/api/auth/wechat/mp-redirect` | 公众号授权回调 | ❌ | ✅ 返回 token |
| GET | `/api/auth/wechat/open-platform-redirect` | 开放平台授权回调 | ❌ | ✅ 返回 token |
| POST | `/api/auth/verify-token` | 验证 token | ❌ | - |
| GET | `/api/auth/user-info` | 获取用户信息 | ✅ | - |
| GET | `/api/auth/sessions` | 获取当前用户的会话列表 | ✅ | - |
| POST | `/api/auth/password/login` | 密码登录 | ❌ | - |
| POST | `/api/auth/signout` | 登出 | ✅ | - |

### 管理员功能 (`/api/admin/`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/users` | 获取用户列表 | 管理员 |
| POST | `/api/admin/set-phone-password` | 设置手机号和密码 | 管理员 |
| GET | `/api/admin/verify` | 验证管理员权限 | 管理员 |

---

## 🔗 业务系统集成指南（V3.1）

### 统一 Token 模式

#### 登录流程

```
用户点击"微信登录"
    ↓
业务系统重定向到 auth-center
    ↓
auth-center 检测环境（PC/微信内）
    ↓
    ├─ PC 浏览器 → 开放平台扫码
    └─ 微信内 → 公众号授权
    ↓
auth-center 完成登录，生成 JWT token
    ↓
重定向回业务系统（只传 token）
    ↓
业务前端用 token 调用 /auth/me 或业务系统自己的用户信息 API
    ↓
业务系统后端 AuthCenterMiddleware：
    1. 验证 token
    2. 获取用户信息（unionID、昵称、头像）
    3. 创建/更新本地用户
    4. 返回用户信息
    ↓
登录完成
```

#### 对接方式

**方式 1：前端直接调用业务系统后端（推荐）**

```
auth-center → token → 业务前端 → 业务后端 /auth/me
```

**方式 2：前端调用业务系统后端，业务后端调用 auth-center**

```
auth-center → token → 业务前端 → 业务后端 → auth-center API
```

### API 接口

#### 1. 发起微信登录

**请求**：
```
GET /api/auth/wechat/login?callbackUrl=<业务系统回调URL>
```

**示例**：
```
GET https://os.crazyaigc.com/api/auth/wechat/login?callbackUrl=https://pixel.crazyaigc.com/auth/callback
```

**响应**：
- PC：重定向到微信扫码页面
- 微信内：重定向到微信授权页面

#### 2. auth-center 回调（V3.1 统一）

**参数**：
```
/callback?token=<jwt_token>
```

**示例**：
```
https://pixel.crazyaigc.com/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 3. 获取用户信息

**请求**：
```
GET /api/auth/user-info
Authorization: Bearer <token>
```

**响应**：
```json
{
  "success": true,
  "data": {
    "userId": "uuid-xxx",
    "unionId": "oxxx",
    "phoneNumber": "",
    "email": "",
    "profile": {
      "nickname": "张三",
      "avatarUrl": "https://xxx"
    },
    "accounts": [
      {
        "provider": "wechat",
        "type": "web",
        "nickname": "张三",
        "avatarUrl": "https://xxx"
      }
    ]
  }
}
```

#### 4. 验证 Token

**请求**：
```
POST /api/auth/verify-token
Content-Type: application/json

{
  "token": "jwt_token"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "valid": true,
    "userId": "uuid-xxx"
  }
}
```

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

# 回调域名白名单（V3.1 重要）
ALLOWED_CALLBACK_DOMAINS=os.crazyaigc.com,pr.crazyaigc.com,pixel.crazyaigc.com,edit.crazyaigc.com

# 运行模式
GIN_MODE=release
PORT=8080
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
- **V3.1**: 所有场景统一返回 token

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
├─ token: JWT token（30天有效）
└─ expiresAt: 过期时间
```

### 3. 管理员功能
- 查看所有用户列表
- 为用户设置手机号和密码
- 微信登录后自动创建用户
- 管理员通过 UnionID 验证身份

---

## V3.1 更新日志 (2026-02-06)

### ✅ 核心改造：统一 Token 模式

**改造范围**：
- ✅ auth-center：OpenPlatformRedirect 改为完成登录后返回 token
- ✅ superpixel：前端简化 + 后端添加新用户创建逻辑
- ✅ edit-business：添加 AuthCenterMiddleware 中间件
- ✅ pr-business：添加 AuthCenterMiddleware 中间件
- ✅ service-quote-system：添加回调处理

**主要变化**：

1. **登录流程统一**
   ```
   PC 扫码: auth-center → token → 业务系统
   微信内: auth-center → token → 业务系统
   ```

2. **前端简化**
   - 删除 code + type 处理逻辑
   - 只处理 token 参数
   - 代码减少 30-40%

3. **后端统一**
   - 所有业务系统添加 AuthCenterMiddleware
   - 自动验证 token
   - 自动创建/更新本地用户
   - 获取完整用户信息（unionID、昵称、头像）

4. **新用户自动创建**
   ```
   首次登录 → 验证 token → 获取用户信息 → 创建本地用户 → 返回
   ```

5. **用户信息完整性**
   - ✅ unionID：跨应用统一标识
   - ✅ nickname：用户昵称
   - ✅ avatarUrl：用户头像
   - ✅ phoneNumber：手机号
   - ✅ email：邮箱

**改造文件统计**：
- auth-center：1 个文件
- superpixel：3 个文件
- edit-business：5 个文件
- pr-business：5 个文件
- service-quote-system：2 个文件
- **总计**：16 个文件

### 向后兼容

- ✅ 保留 POST /api/auth/wechat/login 接口（code 换 token）
- ✅ 保留原 JWT 认证中间件
- ✅ 保留所有管理员功能
- ✅ 不影响已部署的业务系统

---

## 许可证

MIT
