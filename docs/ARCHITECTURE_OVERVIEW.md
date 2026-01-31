# KeeNChase Nexus - 系统架构总览（宪法）

**最后更新**: 2026-01-30
**版本**: V3.0 (前后端分离 + Go 后端 + 统一规范)
**性质**: 所有业务系统、账号中心、数据库的技术规范和部署标准

---

## 📜 文档性质与适用范围

### 本文档定位

**"宪法"级别**：本文档是 KeeNChase 所有业务系统的最高技术规范，所有系统设计、开发、部署**必须遵守**。

### 适用系统

| 系统 | 域名 | 状态 | 架构 |
|------|------|------|------|
| 账号中心 | os.crazyaigc.com | ✅ 已部署 | **V3.0: Go + Next.js** |
| PR业务系统 | pr.crazyaigc.com | ✅ 已部署 | **V3.0: Go + Next.js** ✅ 100% |
| AI生图系统 | pixel.crazyaigc.com / 3xvs5r4nm4.coze.site | ✅ 已部署 | Coze 平台 |
| 知识库系统 | study.crazyaigc.com | ✅ 已部署 | V1.0: Next.js |
| 客户管理系统 | crm.crazyaigc.com | ✅ 已部署 | V1.0: Next.js |

### 版本演进路线

```
V1.0 → V2.0 → V3.0 (当前标准)
单体    Monorepo  前后端分离
Next.js Next.js  Go + Next.js
```

**所有新系统必须采用 V3.0 架构**，现有系统逐步迁移。

---

## 📊 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户层 (浏览器/App)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ os.crazyaigc  │           │ pr.crazyaigc  │           │pixel.crazyaigc│
│     .com      │           │     .com      │           │     .com      │
│  (账号中心)    │           │  (PR业务)     │           │  (AI生图)     │
│  ✅ 上海部署    │           │  ✅ 上海部署    │           │  ✅ Coze部署   │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│study.crazyaigc│           │crm.crazyaigc  │           │  未来扩展     │
│     .com      │           │     .com      │           │               │
│  (知识库)      │           │  (客户管理)   │           │               │
│  ✅ Vercel部署  │           │  ✅ Vercel部署  │           │               │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
        ┌──────────────────────────────────────────────────────────┐
        │        统一数据层 (杭州服务器 47.110.82.96)              │
        │                                                           │
        │  ┌────────────────────────────────────────────────┐      │
        │  │         PostgreSQL 15 (端口5432)               │      │
        │  │                                                 │      │
        │  │  ┌────────────────────────────────────────┐   │      │
        │  │  │  auth_center_db  (认证数据库)           │   │      │
        │  │  │  - users (统一用户ID)                  │   │      │
        │  │  │  - user_accounts (登录入口)           │   │      │
        │  │  │  - sessions (Token管理)                │   │      │
        │  │  └────────────────────────────────────────┘   │      │
        │  │                                                 │      │
        │  │  ┌────────────────────────────────────────┐   │      │
        │  │  │  pr_business_db   (PR业务数据库)        │   │      │
        │  │  │  - users, profiles, tickets            │   │      │
        │  │  │  - wallets, invitations               │   │      │
        │  │  └────────────────────────────────────────┘   │      │
        │  │                                                 │      │
        │  │  ┌────────────────────────────────────────┐   │      │
        │  │  │  pixel_business_db (AI生图数据库)       │   │      │
        │  │  │  - users, designs, assets              │   │      │
        │  │  └────────────────────────────────────────┘   │      │
        │  │                                                 │      │
        │  │  ┌────────────────────────────────────────┐   │      │
        │  │  │  study_business_db (知识库数据库)       │   │      │
        │  │  │  - users, articles, knowledge           │   │      │
        │  │  └────────────────────────────────────────┘   │      │
        │  │                                                 │      │
        │  │  ┌────────────────────────────────────────┐   │      │
        │  │  │  crm_business_db   (客户管理数据库)     │   │      │
        │  │  │  - users, customers, orders             │   │      │
        │  │  └────────────────────────────────────────┘   │      │
        │  │                                                 │      │
        │  └────────────────────────────────────────────────┘      │
        └──────────────────────────────────────────────────────────┘
```

---

## 🌐 分布式部署架构

### 三个平级仓库

 KeeNChase 项目现已拆分为三个平级仓库：

| 仓库名称 | 路径 | 用途 | 状态 |
|---------|------|------|------|
| **keenchase-nexus** | `/Users/xia/Documents/GitHub/keenchase-nexus` | 原始参考代码 + 技术文档 | ✅ 参考库 |
| **auth-center** | `/Users/xia/Documents/GitHub/auth-center` | 账号中心（独立 V3.0） | ✅ 生产 |
| **pr-business** | `/Users/xia/Documents/GitHub/pr-business` | PR 业务系统（独立 V3.0） | ✅ 生产 |

#### 1. keenchase-nexus - 参考代码仓库

**用途**：保留原始 Next.js 全栈代码，作为拆分其他系统的参考

**包含内容**：
- ✅ 完整的 Next.js 全栈应用代码（`app/`、`components/`、`lib/`）
- ✅ 技术文档（`docs/`）
- ✅ 数据库模型（`prisma/`）
- ✅ 部署脚本参考（`deploy-*.sh`）

**未来参考价值**：
- 📋 拆分"无限创作"系统时的参考
- 📋 拆分"超级像素"系统时的参考
- 📋 查看原始业务逻辑实现

#### 2. auth-center - 账号中心独立仓库

**用途**：统一的用户认证服务

**架构**：V3.0 前后端分离（Go + Next.js）

**部署地址**：https://os.crazyaigc.com

#### 3. pr-business - PR 业务系统独立仓库

**用途**：商家任务发布、达人接单、金币积分系统

**架构**：V3.0 前后端分离（Go + Next.js）✅ **已完全实现**

**部署地址**：https://pr.crazyaigc.com

**完成状态**：
- ✅ 81/81 API 路由代理（100%）
- ✅ 46/46 工作区页面（100%）
- ✅ 107/107 Go 后端 API（100%）
- ✅ 0 个 TODO 注释
- ✅ 与 V3.0 架构标准完全对齐

**文档**：
- [开发计划（已完成）](../pr-business/DEVELOPMENT_PLAN_COMPLETED.md)

---

### 代码仓库结构

```
┌─────────────────────────────────────────────────────────────┐
│                   KeeNChase 代码仓库分布                      │
└─────────────────────────────────────────────────────────────┘

📍 GitHub: github.com/superxia01
📍 本地路径: /Users/xia/Documents/GitHub

├── 📦 keenchase-nexus = 原始参考代码仓库
│   ├── docs/                      ← 技术文档
│   │   ├── ARCHITECTURE_OVERVIEW.md
│   │   ├── AUTH_CENTER_INTEGRATION_GUIDE.md
│   │   └── ...
│   ├── app/                       ← Next.js 全栈应用（原始代码）
│   ├── components/
│   ├── lib/
│   ├── prisma/
│   ├── deploy-auth-center-v3.sh   ← 部署脚本参考
│   └── [保留作为拆分其他系统的参考]
│
├── 📦 auth-center = 账号中心 (os.crazyaigc.com) - 独立仓库
│   ├── frontend/                  ← Next.js 前端
│   │   ├── src/
│   │   ├── package.json
│   │   └── next.config.js
│   ├── backend/                   ← Go 后端
│   │   ├── cmd/server/main.go
│   │   ├── internal/
│   │   │   ├── handler/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   └── config/
│   │   ├── go.mod
│   │   └── bin/server
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .git/
│   └── README.md
│
└── 📦 pr-business = PR业务系统 (pr.crazyaigc.com) - 独立仓库
    ├── frontend/                  ← Next.js 前端 (UI Only)
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── (dashboard)/    # 商家/服务商/达人后台
    │   │   │   └── mobile/         # 达人移动端
    │   │   ├── components/
    │   │   └── lib/
    │   ├── package.json
    │   └── next.config.js
    │
    ├── backend/                   ← Go 后端 (All APIs)
    │   ├── cmd/server/main.go
    │   ├── internal/
    │   │   ├── handler/           # HTTP 处理器
    │   │   │   ├── auth.go        # 认证相关
    │   │   │   ├── tasks.go       # 任务管理
    │   │   │   ├── audit.go       # 审核队列
    │   │   │   ├── invitations.go # 邀请系统
    │   │   │   ├── assignments.go # 任务分配
    │   │   │   └── wallet.go      # 钱包积分
    │   │   ├── service/           # 业务逻辑
    │   │   ├── repository/        # 数据访问
    │   │   ├── middleware/        # 中间件
    │   │   ├── models/            # 数据模型
    │   │   └── config/            # 配置管理
    │   ├── go.mod
    │   ├── bin/server             # 编译后的二进制
    │   └── Dockerfile
    │
    ├── backend-pr/                ← Go 后端生产版本
    │   └── [与 backend 相同结构]
    │
    ├── prisma/
    │   └── schema.prisma
    │
    ├── deploy-pr-business-v3.sh  ← V3.0 部署脚本
    └── README.md
```

### 服务器分布

```
┌─────────────────────────────────────────────────────────────────┐
│                      服务器部署分布                              │
└─────────────────────────────────────────────────────────────────┘

📍 杭州服务器 (47.110.82.96) - 统一数据库服务器
├─ 配置: 阿里云ECS
├─ 部署服务:
│   └─ ✅ PostgreSQL 15 (端口5432)
│       ├─ auth_center_db (账号中心数据库)
│       ├─ pr_business_db (PR业务数据库)
│       ├─ pixel_business_db (AI生图数据库)
│       ├─ study_business_db (知识库数据库)
│       └─ crm_business_db (客户管理数据库)
└─ 安全:
    ├─ 数据库端口仅内网访问
    ├─ SSL/TLS加密连接
    └─ IP白名单限制

📍 上海服务器 (101.35.120.199) - 自有应用服务器
├─ ✅ os.crazyaigc.com (账号中心) - V3.0 架构
│   ├─ 前端: Next.js :3000 (PM2 管理)
│   ├─ 后端: Go API :8080 (Systemd 管理)
│   ├─ 框架: Next.js 15.5 + Go 1.21
│   ├─ SSL证书: 有效期至 2026-04-27
│   └─ 状态: ✅ 在线运行
│
├─ ✅ pr.crazyaigc.com (PR业务) - V3.0 架构
│   ├─ 前端: Next.js :3001 (PM2 管理)
│   ├─ 后端: Go API :8081 (Systemd 管理)
│   ├─ 框架: Next.js 15 + Go 1.21
│   ├─ SSL证书: 有效期至 2026-04-27
│   └─ 状态: ✅ 在线运行
│
└─ ✅ pixel.crazyaigc.com (AI生图) - Coze 平台
│   ├─ 主域名: https://pixel.crazyaigc.com
│   ├─ 备用域名: https://3xvs5r4nm4.coze.site (Coze 部署)
│   ├─ 框架: Coze 平台
│   └─ 状态: ✅ 在线运行

📍 Vercel (Serverless 平台)
├─ ✅ study.crazyaigc.com (知识库系统)
│   ├─ 框架: Next.js
│   ├─ 部署: Vercel 自动化 CI/CD
│   └─ 状态: ✅ 已部署
│
└─ ✅ crm.crazyaigc.com (客户管理系统)
    ├─ 框架: Next.js
    ├─ 部署: Vercel 自动化 CI/CD
    └─ 状态: ✅ 已部署

📍 Coze 平台
└─ ✅ pixel.crazyaigc.com (AI生图系统)
    ├─ 框架: Coze 平台
    └─ 状态: ✅ 已部署
```

---

## 🏗️ V3.0 架构标准（强制）

### 核心架构：前后端分离

```
┌─────────────────────────────────────────────────────────────┐
│                    V3.0 标准架构                             │
└─────────────────────────────────────────────────────────────┘

每个业务系统 = 独立仓库 + 前后端分离

┌──────────────────────────────────────┐
│   仓库根目录 (example-business)       │
├──────────────────────────────────────┤
│  ├── frontend/        ← Next.js 前端 │
│  │   ├── src/                      │
│  │   ├── package.json              │
│  │   └── next.config.js            │
│  │                                  │
│  ├── backend/         ← Go 后端     │
│  │   ├── cmd/server/main.go        │
│  │   ├── internal/                 │
│  │   │   ├── handler/              │
│  │   │   ├── service/              │
│  │   │   ├── repository/           │
│  │   │   ├── middleware/           │
│  │   │   ├── models/               │
│  │   │   └── config/               │
│  │   ├── go.mod                    │
│  │   └── Dockerfile                │
│  │                                  │
│  └── prisma/          ← 数据库模型  │
│      └── schema.prisma              │
└──────────────────────────────────────┘
```

### 技术栈标准（强制）

#### 前端技术栈
```
✅ 框架: Next.js 15+ (App Router)
✅ 语言: TypeScript 5+
✅ 样式: Tailwind CSS
✅ 状态管理: React Context / Zustand
✅ HTTP 客户端: Axios / Fetch API
✅ 表单处理: React Hook Form
```

#### 后端技术栈
```
✅ 语言: Go 1.21+
✅ 框架: Gin (github.com/gin-gonic/gin)
✅ ORM: GORM (gorm.io/gorm)
✅ 数据库驱动: PostgreSQL (gorm.io/driver/postgres)
✅ 认证: JWT (github.com/golang-jwt/jwt/v5)
✅ 密码加密: bcrypt (golang.org/x/crypto/bcrypt)
✅ 配置管理: godotenv (github.com/joho/godotenv)
✅ 日志: Zap (go.uber.org/zap) - 推荐
```

#### 数据库标准
```
✅ 数据库: PostgreSQL 15+
✅ 主键类型: UUID (不是 Auto Increment INT)
✅ 列命名: snake_case (不是 camelCase)
✅ 时间戳: timestamp with time zone
✅ JSON 字段: JSONB (PostgreSQL)
```

---

## 📏 代码规范（强制执行）

### 1. 命名规范

#### 数据库命名（PostgreSQL）

**强制规则**：
- ✅ **表名**: `snake_case`，复数形式
  ```sql
  users          -- ✅ 正确
  user_accounts  -- ✅ 正确
  userAccounts   -- ❌ 错误
  User           -- ❌ 错误
  ```

- ✅ **列名**: `snake_case`，全部小写
  ```sql
  user_id        -- ✅ 正确
  created_at     -- ✅ 正确
  phone_number   -- ✅ 正确
  userId         -- ❌ 错误
  CreatedAt      -- ❌ 错误
  ```

- ✅ **主键**: `{table}_id` 或 `id` (UUID)
  ```sql
  -- 方式1: 表名_id (推荐用于外键)
  users.user_id          UUID PRIMARY KEY
  user_accounts.id       UUID PRIMARY KEY
  sessions.user_id       UUID REFERENCES users(user_id)

  -- 方式2: id (推荐用于主表)
  users.id               UUID PRIMARY KEY
  user_accounts.user_id  UUID REFERENCES users(id)
  ```

- ✅ **时间戳**: `{column}_at` (timestamp) 或 `{column}_time` (time)
  ```sql
  created_at     TIMESTAMP WITH TIME ZONE
  updated_at     TIMESTAMP WITH TIME ZONE
  deleted_at     TIMESTAMP WITH TIME ZONE
  expires_at     TIMESTAMP WITH TIME ZONE
  ```

- ✅ **布尔值**: `is_{adjective}` 或 `{verb}_ed`
  ```sql
  is_active      BOOLEAN
  is_verified    BOOLEAN
  is_deleted     BOOLEAN
  published      BOOLEAN
  ```

#### Go 代码命名

**强制规则**：
- ✅ **结构体名**: `PascalCase` (单数)
  ```go
  type User struct { }         // ✅ 正确
  type UserAccount struct { }  // ✅ 正确
  type user struct { }         // ❌ 错误
  ```

- ✅ **字段名 (JSON)**: `camelCase` (导出字段)
  ```go
  type User struct {
      UserID       string    `json:"userId"`        // ✅ 正确
      PhoneNumber  string    `json:"phoneNumber"`   // ✅ 正确
      CreatedAt    time.Time `json:"createdAt"`     // ✅ 正确
  }
  ```

- ✅ **GORM 列映射**: **必须**使用 `column` 标签指定 snake_case
  ```go
  type User struct {
      UserID       string    `gorm:"primaryKey;column:user_id;type:uuid" json:"userId"`
      UnionID      string    `gorm:"uniqueIndex;column:union_id;type:varchar(255)" json:"unionId"`
      PhoneNumber  string    `gorm:"uniqueIndex;column:phone_number;type:varchar(255)" json:"phoneNumber"`
      CreatedAt    time.Time `gorm:"column:created_at;type:timestamp with time zone" json:"createdAt"`
  }
  ```

- ✅ **函数名**: `PascalCase` (导出) 或 `camelCase` (私有)
  ```go
  func GetUserByID(id string) (*User, error) { }  // ✅ 正确
  func validateToken(token string) error { }       // ✅ 正确
  ```

- ✅ **常量**: `PascalCase` 或 `UPPER_SNAKE_CASE`
  ```go
  const MaxRetryCount = 3              // ✅ 正确
  const DEFAULT_TIMEOUT = 30 * time.Second  // ✅ 正确
  ```

#### TypeScript/React 代码命名

**强制规则**：
- ✅ **组件名**: `PascalCase`
  ```tsx
  function UserProfile() { }           // ✅ 正确
  function userProfile() { }           // ❌ 错误
  const UserProfile = () => { }        // ✅ 正确
  ```

- ✅ **文件名**:
  - 组件文件: `PascalCase.tsx`
    ```
    UserProfile.tsx      // ✅ 正确
    user-profile.tsx     // ❌ 错误
    ```

  - 工具文件: `camelCase.ts`
    ```
    authUtils.ts         // ✅ 正确
    auth-utils.ts        // ❌ 错误
    ```

  - 类型文件: `camelCase.types.ts`
    ```
    user.types.ts        // ✅ 正确
    userTypes.ts         // ⚠️  可接受
    ```

- ✅ **接口/类型**: `PascalCase`
  ```typescript
  interface User { }               // ✅ 正确
  interface UserProfile { }        // ✅ 正确
  type UserID = string;            // ✅ 正确
  ```

### 2. API 设计规范

#### RESTful API 标准（强制）

**基础规则**：
- ✅ 使用名词复数: `/api/users`, `/api/tickets`
- ✅ HTTP 方法语义化:
  - `GET` - 查询
  - `POST` - 创建
  - `PUT` - 完整更新
  - `PATCH` - 部分更新
  - `DELETE` - 删除

**URL 设计示例**：
```
# 用户资源
GET    /api/users              - 获取用户列表 (分页)
GET    /api/users/:id          - 获取单个用户
POST   /api/users              - 创建用户
PUT    /api/users/:id          - 完整更新用户
PATCH  /api/users/:id          - 部分更新用户
DELETE /api/users/:id          - 删除用户

# 嵌套资源
GET    /api/users/:id/tickets      - 获取用户的 tickets
POST   /api/users/:id/tickets      - 为用户创建 ticket
GET    /api/tickets/:id/comments   - 获取 ticket 的评论

# 特殊操作 (使用动词)
POST   /api/auth/login         - 登录
POST   /api/auth/logout        - 登出
POST   /api/users/:id/verify   - 验证用户
```

#### 响应格式标准（强制）

**成功响应**：
```json
{
  "success": true,
  "data": {
    "userId": "uuid-xxx",
    "userName": "张三"
  }
}
```

**列表响应**：
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": "错误信息（用户可读）",
  "errorCode": "USER_NOT_FOUND",
  "details": {}
}
```

#### HTTP 状态码使用（强制）

```
200 OK          - 查询成功
201 Created     - 创建成功
204 No Content  - 删除成功

400 Bad Request         - 请求参数错误
401 Unauthorized        - 未认证
403 Forbidden           - 无权限
404 Not Found           - 资源不存在
409 Conflict            - 资源冲突 (如重复创建)
422 Unprocessable Entity - 参数验证失败

500 Internal Server Error - 服务器错误
503 Service Unavailable  - 服务维护中
```

### 3. 数据库设计规范（强制）

#### 主键规范
```sql
-- ✅ 强制使用 UUID
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 或
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- ❌ 禁止使用自增 ID
CREATE TABLE users (
  id SERIAL PRIMARY KEY  -- ❌ 错误
);
```

#### 外键规范
```sql
-- ✅ 外键命名: {referenced_table}_{referenced_column}
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  CONSTRAINT user_accounts_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- ✅ 索引命名: {table}_{column}_idx
CREATE INDEX user_accounts_user_id_idx
  ON user_accounts(user_id);

-- ✅ 唯一约束: {table}_{column}_key
ALTER TABLE users
  ADD CONSTRAINT users_phone_number_key
  UNIQUE (phone_number);
```

#### 时间戳规范
```sql
-- ✅ 标准时间戳字段
CREATE TABLE users (
  -- ...
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ✅ 软删除
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- ✅ 过期时间
CREATE TABLE sessions (
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

#### JSON 字段规范
```sql
-- ✅ 使用 JSONB (不是 JSON)
CREATE TABLE users (
  metadata JSONB,           -- ✅ 正确
  preferences JSONB         -- ✅ 正确
);

-- ❌ 避免
metadata JSON              -- ❌ 使用 JSONB
```

---

## 🗄️ 数据库架构规范

### 统一数据库服务器（杭州）

**服务器信息**：
```
IP: 47.110.82.96
数据库: PostgreSQL 15 (Docker)
端口: 5432
用途: 统一数据存储中心
```

### 数据库隔离策略

```
PostgreSQL Server (47.110.82.96:5432)
│
├─ auth_center_db        -- 账号中心（认证专用）
├─ pr_business_db        -- PR业务系统
├─ pixel_business_db     -- AI生图系统
├─ study_business_db     -- 知识库系统
└─ crm_business_db       -- 客户管理系统
```

**强制规则**：
- ✅ 每个业务系统使用**独立数据库**
- ✅ 不允许跨库查询（应用层Join）
- ✅ 通过 `auth_center_user_id` 关联用户身份

### 用户关联规范

#### auth_center_db.users（统一身份）
```sql
CREATE TABLE users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id      VARCHAR(255) UNIQUE,      -- 微信 unionid（跨应用）
  phone_number  VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  email         VARCHAR(255) UNIQUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 业务数据库.users（本地用户）
```sql
-- pr_business_db.users
CREATE TABLE users (
  id                     VARCHAR(255) PRIMARY KEY,  -- 本地 ID (CUID)
  auth_center_user_id    UUID UNIQUE,              -- 关联账号中心 ✅ 强制
  union_id               VARCHAR(255) UNIQUE,
  role                   VARCHAR(50),              -- 业务角色
  profile                JSONB,
  created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ 关键索引
CREATE INDEX users_auth_center_user_id_idx
  ON users(auth_center_user_id);
```

**跨系统用户识别**：
```sql
-- 通过 auth_center_user_id 关联
SELECT
  u.*,
  a.union_id,
  a.phone_number
FROM pr_business_db.users u
JOIN auth_center_db.users a
  ON u.auth_center_user_id = a.user_id
WHERE u.id = 'xxx';
```

---

## 🚀 部署规范（强制）

### V3.0 标准部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    单系统部署架构                           │
└─────────────────────────────────────────────────────────────┘

业务系统 (example.com)
│
├── Nginx (443/80)
│   ├── SSL 终止
│   ├── 静态资源服务
│   └── 反向代理
│       ├── /          → Frontend (Next.js :3000)
│       └── /api       → Backend (Go :8080)
│
├── Frontend (Next.js)
│   ├── 端口: 3000
│   ├── 运行: PM2
│   └── 功能: SSR + 静态页面
│
└── Backend (Go)
    ├── 端口: 8080
    ├── 运行: Systemd / PM2
    ├── 功能: RESTful API
    └── 连接: PostgreSQL (47.110.82.96:5432)
```

### 部署流程（标准）

#### 1. 前端部署（Next.js）

```bash
# === 本地开发 ===
cd frontend/

# 1. 安装依赖
npm install

# 2. 环境配置
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_URL=https://example.com
EOF

# 3. 开发（可选）
npm run dev

# 4. 类型检查
npx tsc --noEmit

# === 部署到服务器 ===

# 5. 上传代码（排除 node_modules 和 .next）
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env.local' \
  . ubuntu@101.35.120.199:/var/www/example-frontend/

# 6. 服务器构建
ssh ubuntu@101.35.120.199
cd /var/www/example-frontend
npm install
npm run build

# 7. PM2 管理
pm2 start npm --name "example-frontend" -- start
pm2 save
```

#### 2. 后端部署（Go）

```bash
# === 本地开发 ===
cd backend/

# 1. 下载依赖
go mod download

# 2. 本地运行（可选）
go run cmd/server/main.go

# === 交叉编译（本地 Mac → Linux 服务器） ===

# 3. 编译 Linux 二进制
GOOS=linux GOARCH=amd64 go build \
  -o bin/server \
  cmd/server/main.go

# 4. 上传二进制
scp bin/server ubuntu@101.35.120.199:/var/www/example-backend/
scp -r config ubuntu@101.35.120.199:/var/www/example-backend/

# === 服务器配置 ===

# 5. 创建 systemd 服务
sudo tee /etc/systemd/system/example-backend.service << EOF
[Unit]
Description=Example Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/example-backend
ExecStart=/var/www/example-backend/bin/server
Restart=always
RestartSec=5
Environment="PORT=8080"
EnvironmentFile=/var/www/example-backend/.env

[Install]
WantedBy=multi-user.target
EOF

# 6. 启动服务
sudo systemctl daemon-reload
sudo systemctl enable example-backend
sudo systemctl start example-backend
sudo systemctl status example-backend
```

#### 3. Nginx 配置（标准模板）

```nginx
# /etc/nginx/sites-available/example.com
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # 前端静态资源
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api {
        rewrite ^/api/?(.*) /$1 break;
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS (如需要)
        add_header Access-Control-Allow-Origin https://example.com;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        add_header Access-Control-Allow-Credentials true;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:8080/health;
        access_log off;
    }
}
```

### 环境变量管理（强制）

#### 前端环境变量（.env.local）
```bash
# ✅ 必须以 NEXT_PUBLIC_ 开头（暴露给浏览器）
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_WECHAT_APP_ID=wxe3453a6c5c8ec701
```

#### 后端环境变量（.env）
```bash
# ✅ 服务器配置
PORT=8080
GIN_MODE=release

# ✅ 数据库连接
DATABASE_URL=postgresql://user:pass@47.110.82.96:5432/db_name?sslmode=require

# ✅ JWT 配置
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=168h  # 7天

# ✅ 微信配置
WECHAT_APP_ID=xxx
WECHAT_APP_SECRET=xxx
WECHAT_MP_APPID=xxx
WECHAT_MP_SECRET=xxx

# ✅ CORS 配置
ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

---

## 🔐 安全规范（强制）

### 1. 认证与授权

#### JWT Token 规范
```go
// ✅ Token 结构
type Claims struct {
    UserID string `json:"userId"`
    jwt.RegisteredClaims
}

// ✅ 标准配置
- 算法: HS256
- 有效期: 7天 (168小时)
- 签名密钥: 最少32字符
- 存储: PostgreSQL sessions 表
```

#### 认证中间件（Go）
```go
// ✅ 标准 JWT 验证流程
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 提取 Token
        token := c.GetHeader("Authorization")
        if !strings.HasPrefix(token, "Bearer ") {
            c.JSON(401, gin.H{"error": "Missing token"})
            c.Abort()
            return
        }

        // 2. 验证 Token
        tokenString := strings.TrimPrefix(token, "Bearer ")
        claims, err := ValidateToken(tokenString)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        // 3. 检查会话
        session, err := GetSession(tokenString)
        if err != nil || session.ExpiresAt.Before(time.Now()) {
            c.JSON(401, gin.H{"error": "Session expired"})
            c.Abort()
            return
        }

        // 4. 注入用户信息
        c.Set("userId", claims.UserID)
        c.Next()
    }
}
```

### 2. 密码安全

```go
// ✅ 密码哈希（强制 bcrypt）
import "golang.org/x/crypto/bcrypt"

// 哈希密码
func HashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}

// 验证密码
func CheckPassword(password, hash string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}
```

### 3. 数据库安全

#### 连接字符串规范
```bash
# ✅ 生产环境（强制 SSL）
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# ❌ 禁止生产环境使用
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=disable"
```

#### SQL 注入防护
```go
// ✅ 使用 GORM 参数化查询
db.Where("user_id = ?", userID).First(&user)

// ❌ 禁止字符串拼接
db.Where("user_id = '" + userID + "'").First(&user)
```

### 4. CORS 配置（带白名单验证）

**⚠️ 安全要求**: 账号中心必须实现 CORS 白名单，防止钓鱼网站非法调用。

```go
// ✅ CORS 中间件（带白名单验证）
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
    // 解析白名单
    allowedOrigins := strings.Split(cfg.AllowedOrigins, ",")
    originMap := make(map[string]bool)
    for _, origin := range allowedOrigins {
        originMap[strings.TrimSpace(origin)] = true
    }

    return func(c *gin.Context) {
        origin := c.Request.Header.Get("Origin")

        // 验证 Origin 是否在白名单中
        if origin != "" {
            if !originMap[origin] {
                c.JSON(403, gin.H{
                    "success": false,
                    "error":   "域名未在白名单中",
                })
                c.Abort()
                return
            }
            // 设置具体的 Origin（不能是 *，因为要支持 credentials）
            c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
        }

        c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }

        c.Next()
    }
}
```

**环境变量配置**:
```bash
# .env
# CORS 白名单（逗号分隔，只允许这些域名调用账号中心 API）
ALLOWED_ORIGINS=https://os.crazyaigc.com,https://pr.crazyaigc.com,https://pixel.crazyaigc.com,https://3xvs5r4nm4.coze.site,https://study.crazyaigc.com,https://crm.crazyaigc.com
```

**安全效果**:
- ✅ 阻止钓鱼网站从浏览器端调用账号中心 API
- ✅ 保护用户 token 不被非法网站窃取
- ⚠️ 注意：不能防止服务端直接调用（需要额外的 API 密钥验证）
```

---

## 📊 监控与日志规范

### 结构化日志（标准）

```go
import "go.uber.org/zap"

// ✅ 结构化日志
logger, _ := zap.NewProduction()
logger.Info("User login",
    zap.String("userId", userID),
    zap.String("ip", clientIP),
    zap.Duration("duration", duration),
)

// ✅ 错误日志
logger.Error("Database connection failed",
    zap.Error(err),
    zap.String("host", dbHost),
)
```

### 健康检查端点（强制）

```go
// ✅ 标准 /health 端点
func HealthCheck(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 检查数据库连接
        sqlDB, err := db.DB()
        if err != nil {
            c.JSON(503, gin.H{"status": "unhealthy"})
            return
        }

        if err := sqlDB.Ping(); err != nil {
            c.JSON(503, gin.H{"status": "unhealthy"})
            return
        }

        c.JSON(200, gin.H{
            "status": "healthy",
            "service": "example-backend",
        })
    }
}
```

---

## 🧪 测试规范

### 单元测试（推荐）

```go
// ✅ 表格驱动测试
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name  string
        email string
        want  bool
    }{
        {"valid email", "test@example.com", true},
        {"invalid email", "invalid", false},
        {"empty email", "", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ValidateEmail(tt.email)
            if got != tt.want {
                t.Errorf("ValidateEmail() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

### API 测试（推荐）

```go
func TestLoginAPI(t *testing.T) {
    router := SetupRouter()

    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{
        "email": "test@example.com",
        "password": "password123"
    }`))
    req.Header.Set("Content-Type", "application/json")

    router.ServeHTTP(w, req)

    assert.Equal(t, 200, w.Code)
    assert.Contains(t, w.Body.String(), "token")
}
```

---

## 📚 文档规范

### API 文档（强制）

**每个后端项目必须提供**：
1. README.md - 项目说明
2. API.md - API 文档（可选，使用 Swagger）
3. DEPLOYMENT.md - 部署文档

### API 文档模板

```markdown
# API 文档

## 认证

所有 API 请求需要在 Header 中携带 Token:

```
Authorization: Bearer <token>
```

## 端点列表

### 用户相关

#### 创建用户
- **URL**: POST /api/users
- **认证**: 需要
- **权限**: admin

**请求体**:
```json
{
  "userName": "张三",
  "email": "test@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-xxx",
    "userName": "张三",
    "email": "test@example.com"
  }
}
```
```

---

## 🔧 开发工作流

### Git 提交规范（强制）

```
<type>(<scope>): <subject>

type:
  feat     - 新功能
  fix      - Bug 修复
  docs     - 文档更新
  style    - 代码格式（不影响功能）
  refactor - 重构
  test     - 测试
  chore    - 构建/工具

示例:
feat(auth): 添加微信登录功能
fix(database): 修复用户查询 SQL 错误
docs(api): 更新认证文档
```

### 代码审查（强制）

**必须满足**：
- ✅ 遵循代码规范
- ✅ 通过类型检查 (`npx tsc --noEmit`)
- ✅ 通过编译 (`go build`)
- ✅ 有适当的注释
- ✅ 有必要的测试

---

## 📞 技术支持

### 服务器信息

**杭州数据库服务器**:
- IP: 47.110.82.96
- SSH: `ssh -i ~/.ssh/xia_mac_alicloud root@47.110.82.96`
- 数据库: PostgreSQL 15 :5432

**上海应用服务器**:
- IP: 101.35.120.199
- 用户名: ubuntu
- SSH: ~/.ssh/xia_mac_lighthouse.pem
- 部署应用: os.crazyaigc.com, pr.crazyaigc.com

### 常用命令

```bash
# === 杭州数据库 ===
# SSH 连接
ssh -i ~/.ssh/xia_mac_alicloud root@47.110.82.96

# 查看数据库容器
docker ps | grep postgres

# 连接数据库
docker exec -it keenchase-postgres psql -U nexus -d auth_center_db

# === 上海应用 ===
# SSH 连接
ssh -i ~/.ssh/office_ubuntu_dev ubuntu@101.35.120.199

# PM2 管理
pm2 list
pm2 logs auth-center
pm2 restart auth-center

# Nginx 重载
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📋 版本历史

### V3.0 (2026-01-29) - 当前版本

**重大变更**：
- ✅ 引入 Go 后端标准（前后端分离）
- ✅ 强制数据库命名规范（snake_case）
- ✅ 强制 UUID 主键
- ✅ 统一代码规范（Go + TypeScript）
- ✅ 标准化部署流程

**迁移指南**：
- 账号中心: ✅ 已完成迁移
- PR业务系统: ⏳ 计划中

### V2.0 (2026-01-28)

**特性**：
- 统一账号中心
- 微信登录双模式
- Monorepo 结构

### V1.0 (2026-01-01)

**特性**：
- 初始版本
- Next.js 单体应用

---

**维护者**: KeeNChase Dev Team
**最后更新**: 2026-01-29
**下次审核**: 2026-02-29

---

## 附录

### A. 快速检查清单

**新系统创建**：
- [ ] 创建独立仓库
- [ ] 初始化前端（Next.js + TypeScript）
- [ ] 初始化后端（Go + Gin）
- [ ] 配置数据库（PostgreSQL + UUID）
- [ ] 实现认证（JWT）
- [ ] 配置 Nginx
- [ ] 编写 API 文档
- [ ] 配置部署脚本

### B. 常见问题

**Q: 为什么强制使用 UUID 而不是自增 ID？**
A: UUID 支持分布式系统，避免 ID 冲突，提高安全性。

**Q: 为什么数据库使用 snake_case 而代码使用 camelCase？**
A: 这是行业标准：PostgreSQL 使用 snake_case，Go/JavaScript 使用 camelCase。通过 ORM 映射实现。

**Q: 为什么禁止使用 AutoMigrate？**
A: 生产环境应该使用数据库迁移工具（如 golang-migrate）进行版本控制，避免意外修改。

**Q: 如何在本地测试跨服务器数据库连接？**
A: 使用 SSH 隧道：
```bash
ssh -i ~/.ssh/xia_mac_alicoud -f -N -L 5433:localhost:5432 root@47.110.82.96
# 然后连接 localhost:5433
```

---

**本文档为 KeeNChase 技术团队的"宪法"，所有开发、部署工作必须严格遵守。**
