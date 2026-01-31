# 账号中心对接指南

**面向开发者**: 业务系统集成账号中心微信登录和密码登录
**账号中心地址**: https://os.crazyaigc.com
**数据库服务器**: 杭州服务器 47.110.82.96:5432
**架构版本**: V3.0 - 前后端分离 + Go 后端 + 三层账号模型
**最后更新**: 2026-01-31

---

## 📋 目录

1. [快速开始](#快速开始)
2. [架构概述](#架构概述)
3. [三层账号模型详解](#三层账号模型详解)
4. [微信登录流程](#微信登录流程)
5. [API接口说明](#api接口说明)
   - [发起微信登录](#1-发起微信登录智能检测)
   - [验证Token](#2-验证token)
   - [获取用户信息](#3-获取用户信息)
   - [密码登录](#4-密码登录)
   - [登出](#5-登出)
6. [已集成系统](#已集成系统)
7. [数据库集成](#数据库集成)
8. [代码示例](#代码示例)
9. [常见问题](#常见问题)
10. [联系支持](#联系支持)

---

## 快速开始

### ⚠️ 重要：用户注册流程

**KeeNChase账号中心采用"微信优先+人工审核"的注册流程：**

1. 用户**必须先通过微信登录**，系统自动创建账号
2. 管理员人工审核用户身份
3. 管理员为用户设置手机号和密码（可选）
4. 用户可使用手机号+密码登录

**不支持的功能**:
- ❌ 用户自助注册手机号
- ❌ 用户自己设置密码

---

### 5分钟完成对接

```typescript
// 1. 引导用户跳转到账号中心
window.location.href = 'https://os.crazyaigc.com/api/auth/wechat/login?callbackUrl=https://your-domain.com/auth/callback'

// 2. 在回调页面接收参数（账号中心自动处理）
// URL: https://your-domain.com/auth/callback?userId=xxx&token=yyy

// 3. 验证token并获取用户信息
const response = await fetch('https://os.crazyaigc.com/api/auth/verify-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'yyy' })
})
const { valid, userId } = await response.json()

// 4. 在你的数据库创建用户
// INSERT INTO users (auth_center_user_id, ...) VALUES ('xxx', ...)
```

---

## 架构概述

### 系统组成

```
┌─────────────────────────────────────────────────────────────┐
│                     业务系统 (你的应用)                      │
│                  your-domain.com                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─ 1. 引导用户登录
                       │   跳转到 os.crazyaigc.com
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  账号中心 (认证服务)                         │
│                  os.crazyaigc.com                          │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  微信登录 API (智能检测)                             │    │
│  │  - /api/auth/wechat/login                            │    │
│  │  - 自动检测浏览器类型                                 │    │
│  │  │  ├─ 微信内置浏览器 → 公众号授权              │    │
│  │  │  └─ 其他浏览器 → 开放平台扫码              │    │
│  │  └────────────────────────────────────────────┘    │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Token验证API                                      │    │
│  │  - /api/auth/verify-token                          │    │
│  │  - /api/auth/user-info                              │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │  2. 返回 userId + token
                       |
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              杭州服务器 (统一数据库)                         │
│              47.110.82.96:5432                            │
│                                                               │
│  auth_center_db - 存储用户统一身份                          │
│  - users (userId, unionId)                             │
│  - user_accounts (各端的 openid)                       │
│  - sessions (token管理)                                  │
│                                                               │
│  your_business_db - 存储你的业务数据                         │
│  - users (id, auth_center_user_id, ...)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 三层账号模型详解

### 🎯 核心设计理念

**基于微信 UnionID 机制的三层账号模型**：

```
unionid = 人（同一用户在不同应用）
openid = 登录入口（同一应用不同用户）
```

### 📊 三层结构

#### **第1层：User（用户层）- 真实的人**

**表名**: `users`

**字段说明**:
- `userId` (UUID): 统一用户ID，全局唯一
- `unionId` (VARCHAR): 微信 UnionID，跨应用统一标识
- `phoneNumber` (VARCHAR): 手机号（用于密码登录）
- `passwordHash` (VARCHAR): 密码哈希
- `email` (VARCHAR): 邮箱

**关键点**:
- ✅ 存储跨应用的统一标识 `unionId`
- ❌ **不再存储** `openId` 和 `mpOpenId`（已迁移到 UserAccount 表）
- 一个 `userId` 对应一个真实的人

---

#### **第2层：UserAccount（登录入口层）- 各端的 openid**

**表名**: `user_accounts`

**字段说明**:
- `id` (UUID): 主键
- `userId` (UUID): 关联到 User 表
- `provider` (VARCHAR): 提供商（如 'wechat'）
- `appId` (VARCHAR): 应用 AppID（如 'wx1234567890abcdef'）
- `openId` (VARCHAR): 该应用下的 openid
- `type` (VARCHAR): 登录类型（'web' | 'mp' | 'miniapp' | 'app'）
- `nickname` (VARCHAR): 用户昵称
- `avatarUrl` (TEXT): 头像URL

**关系**:
- 一个用户可以有**多个**登录入口
- 联合唯一约束：(provider, appId, openId)

**示例**：
```
用户A (userId: xxx)
├─ PC网页登录 (appId: wxe3453a6c5c8ec701, openId: oBwJS...)
├─ 公众号登录 (appId: wx2b00da8349d8714c, openId: oyHz...)
└─ 小程序登录 (appId: wx..., openId: oABC...)
```

---

#### **第3层：Session（会话层）- 登录会话管理**

**表名**: `sessions`

**字段说明**:
- `id` (UUID): 主键
- `userId` (UUID): 关联到 User 表
- `token` (VARCHAR): JWT token（7天有效）
- `expiresAt` (TIMESTAMP): 过期时间
- `deviceInfo` (JSONB): 设备信息（IP, User-Agent等）
- `createdAt` (TIMESTAMP): 创建时间

**作用**：
- 管理用户登录会话
- 支持主动撤销（删除 session）
- Token 验证

---

### 🔑 数据关系图

```
┌──────────────┐
│    User       │  ← unionId = 人
└──────┬───────┘
       │ 1:N
       ├──────────────┐
       │ UserAccount  │  ← openId = 登录入口
       └──────────────┘
       │ 1:N
       ├──────────┐
       │ Session │  ← token = 会话
       └──────────┘
```

---

## 微信登录流程

### 完整流程图

```
用户访问你的应用
     │
     ▼
[检查登录状态]
     │
     ├─ 已登录 → 显示应用内容
     │
     └─ 未登录 ──────────────┐
                             ▼
           ┌─────────────────────────────────┐
           │  步骤1: 智能检测登录方式       │
           └─────────────────────────────────┘
                             │
           ┌─────────────┴─────────────┐
           ▼                           ▼
     [微信内置浏览器]              [PC/其他浏览器]
           │                           │
           ▼                           ▼
     [公众号授权]              [开放平台扫码]
     snsapi_userinfo            snsapi_login
           │                           │
           │                           │ 用户扫码
           ▼                           ▼
     ┌─────────────────────────────────┐
     │  步骤2: 微信回调到账号中心       │
     │  - 获取 unionId 和 openId        │
     │  - 查询/创建 User（通过unionId）   │
     │  - 创建 UserAccount（绑定openId）│
     │  - 生成 JWT token               │
     │  - 存储 session                 │
     └─────────────────────────────────┘
           │
           │ 重定向
           ▼
     ┌─────────────────────────────────┐
     │  步骤3: 回调到你的应用           │
     │  /auth/callback                 │
     │  ?userId=xxx&token=yyy          │
     └─────────────────────────────────�
           │
           │
    ┌────────────┴────────────┐
    ▼                            ▼
┌──────────────┐      ┌──────────────────┐
│  步骤4: 验证Token  │      │  步骤5: 创建用户  │
│  调用账号中心API  │      │  在你的数据库中   │
└──────────────┘      └──────────────────┘
    │                            │
    │ 验证成功                    │ 设置本地session
    └────────────┬────────────┘
                 ▼
        ┌─────────────────┐
        │  登录完成        │
        └─────────────────┘
```

---

## API接口说明

### 1. 发起微信登录（智能检测）

**接口**: `GET /api/auth/wechat/login`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| callbackUrl | string | 是 | 登录后回调URL（需URL编码） |

**请求示例**:
```
GET https://os.crazyaigc.com/api/auth/wechat/login?callbackUrl=https%3A%2F%2Fyour-domain.com%2Fauth%2Fcallback
```

**响应**:
- 微信内置浏览器：跳转到公众号授权页面
- 其他浏览器：跳转到开放平台扫码页面

---

### 2. 验证Token

**接口**: `POST /api/auth/verify-token`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Token无效或已过期"
  }
}
```

---

### 3. 获取用户信息

**接口**: `GET /api/auth/user-info`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "unionId": "oZh_a67J99sgfrHFX5pRPcXr0uQA",
    "phoneNumber": "13800138000",
    "email": null,
    "createdAt": "2026-01-29T03:17:24.451Z",
    "lastLoginAt": "2026-01-31T08:46:42.123Z",
    "profile": {
      "nickname": "微信昵称",
      "avatarUrl": "https://wx.qlogo.cn/xxx"
    },
    "accounts": [
      {
        "provider": "wechat",
        "type": "web",
        "nickname": "微信昵称",
        "avatarUrl": "https://wx.qlogo.cn/xxx",
        "createdAt": "2026-01-29T03:17:24.451Z"
      }
    ]
  }
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| userId | string | 统一用户ID |
| unionId | string | 微信 UnionID |
| phoneNumber | string | 手机号（如已设置） |
| email | string | 邮箱（如已设置） |
| createdAt | string | 注册时间 |
| lastLoginAt | string | 最后登录时间 |
| profile.nickname | string | 用户昵称（来自微信） |
| profile.avatarUrl | string | 用户头像（来自微信） |
| accounts | array | 登录账号列表 |

---

### 4. 密码登录

**接口**: `POST /api/auth/password/login`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "phoneNumber": "13800138000",
  "password": "password123"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phoneNumber | string | 是 | 手机号（管理员预先设置） |
| password | string | 是 | 密码（管理员预先设置） |

**成功响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**失败响应**:
```json
{
  "success": false,
  "error": "手机号或密码错误"
}
```

**业务系统集成示例**:
```typescript
// 前端登录页面
async function handlePasswordLogin() {
  const phoneNumber = "13800138000"
  const password = "password123"

  const response = await fetch('https://os.crazyaigc.com/api/auth/password/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, password })
  })

  const result = await response.json()

  if (result.success) {
    // 登录成功
    localStorage.setItem('auth_token', result.token)
    localStorage.setItem('user_id', result.userId)

    // 跳转到业务系统首页
    window.location.href = '/dashboard'
  } else {
    // 登录失败
    alert(result.error)
  }
}
```

**重要说明**:
- ⚠️ 用户必须先通过微信登录创建账号
- ⚠️ 管理员在账号中心后台为用户设置手机号和密码
- ✅ 设置完成后，用户可使用手机号+密码登录
- ✅ 业务系统可直接调用此接口验证用户身份

---

### 5. 登出

**接口**: `POST /api/auth/signout`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true
}
```

---

## 已集成系统

### ✅ PR 业务系统 (pr.crazyaigc.com)

**架构**: V3.0 前后端分离 (Go + Next.js)
**独立仓库**: `github.com/superxia01/pr-business`
**数据库**: `pr_business_db`
**状态**: ✅ 已完成集成

#### 集成方式

1. **认证流程**:
   ```
   用户访问 pr.crazyaigc.com
   → 重定向到 os.crazyaigc.com/api/auth/wechat/login
   → 微信登录/密码登录
   → 获得 JWT Token
   → 返回 pr.crazyaigc.com
   → 前端保存 Token (localStorage)
   → 后续 API 调用携带 Token
   ```

2. **前端集成**:
   - 登录页面跳转到账号中心
   - 保存 JWT Token 到 localStorage
   - Axios 拦截器自动添加 `Authorization: Bearer <token>`

3. **后端集成** (Go):
   - 中间件验证 Token
   - 调用账号中心 API 获取用户信息
   - 从 `pr_business_db_v2` 查询用户业务数据
   - 返回业务数据给前端

4. **数据库关联**:
   ```sql
   -- PR 业务数据库
   pr_business_db.users
   ├── auth_center_user_id (VARCHAR)  -- 关联账号中心
   ├── role (VARCHAR)                 -- 业务角色
   ├── wallet_gold_coins (INT)        -- 金币积分
   └── ... (其他业务字段)
   ```

#### 技术实现

**Go 后端中间件**:
```go
// middleware/auth.go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 从 Authorization Header 获取 Token
        token := c.GetHeader("Authorization")
        token = strings.TrimPrefix(token, "Bearer ")

        // 2. 调用账号中心 API 验证 Token
        resp, _ := http.PostForm(
            "https://os.crazyaigc.com/api/auth/verify-token",
            url.Values{"token": {token}},
        )

        // 3. 提取 userId
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        userId := result["data"].(map[string]interface{})["userId"]

        // 4. 查询本地用户
        var user User
        db.Where("auth_center_user_id = ?", userId).First(&user)

        // 5. 设置用户上下文
        c.Set("user", user)
        c.Next()
    }
}
```

**前端 Axios 拦截器**:
```typescript
// frontend/src/lib/axios.ts
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

#### 相关文档

- [账号中心 README](../../auth-center/README.md)
- [PR 业务系统 README](../../pr-business/README.md)
- [V3.0 架构标准](./ARCHITECTURE_OVERVIEW.md)

---

### 📋 待集成系统

以下系统计划集成账号中心统一认证：

| 系统 | 域名 | 当前架构 | 计划 |
|------|------|----------|------|
| Pixel AI 生图 | pixel.crazyaigc.com | Next.js | 待迁移到 V3.0 |
| Study 知识库 | study.crazyaigc.com | Next.js | 待迁移到 V3.0 |
| CRM 客户管理 | crm.crazyaigc.com | Next.js | 待迁移到 V3.0 |

---

## 数据库集成

### 环境变量配置

```bash
# .env 或环境变量

# 数据库连接（杭州服务器）
AUTH_CENTER_DATABASE_URL="postgresql://user:password@47.110.82.96:5432/your_business_db?sslmode=require"

# 账号中心API地址
AUTH_CENTER_URL="https://os.crazyaigc.com"

# 应用密钥
NEXTAUTH_SECRET="your-secret-key"
```

### 数据库Schema设计

**关键点**: 必须添加 `auth_center_user_id` 字段

```sql
-- Prisma schema.prisma 示例
model User {
  id                    String    @id @default(cuid())
  authCenterUserId    String?   @unique @map("auth_center_user_id") // ✅ 关键字段

  // 业务字段
  role                 String    @default("USER")
  profile              Json?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // 关系
  posts                Post[]
  orders               Order[]

  @@map("users")
}
```

**重要**:
- `auth_center_user_id` 必须设置 `@unique`，确保一对一关系
- 类型使用 `String`（存储UUID）
- 允许为 `null`（老用户可能没有此字段）

---

## 代码示例

### 完整示例：Next.js App Router

#### 1. 登录页面

```typescript
// app/login/page.tsx
'use client'

export default function LoginPage() {
  const handleWechatLogin = () => {
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback`)
    const authUrl = `https://os.crazyaigc.com/api/auth/wechat/login?callbackUrl=${redirectUri}`
    window.location.href = authUrl
  }

  return (
    <div>
      <h1>登录</h1>
      <button onClick={handleWechatLogin}>
        微信登录
      </button>
    </div>
  )
}
```

#### 2. 回调API

```typescript
// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyToken(token: string) {
  const response = await fetch('https://os.crazyaigc.com/api/auth/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })

  if (!response.ok) {
    throw new Error('Token验证失败')
  }

  return await response.json()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('userId')
  const token = searchParams.get('token')

  // 1. 验证参数
  if (!userId || !token) {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url))
  }

  try {
    // 2. 验证token
    const verifyResult = await verifyToken(token)

    if (!verifyResult.success || !verifyResult.data.valid) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    if (verifyResult.data.userId !== userId) {
      return NextResponse.redirect(new URL('/login?error=user_mismatch', request.url))
    }

    // 3. 创建/获取本地用户
    let user = await prisma.user.findUnique({
      where: { authCenterUserId: userId }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: cuid(),
          authCenterUserId: userId,
          role: 'USER'
        }
      })
    }

    // 4. 设置session
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7天
    })

    return response
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
```

---

## 常见问题

### Q0: 用户如何使用手机号+密码登录？

**A**: 用户必须先完成以下步骤：

1. **第一步：微信登录**
   - 用户首次必须使用微信登录
   - 系统自动创建账号

2. **第二步：人工审核**
   - 管理员验证用户身份
   - 确认用户信息真实性

3. **第三步：设置密码**
   - 管理员为用户设置手机号和密码
   - 联系账号中心团队完成此步骤

4. **第四步：密码登录**
   - 设置完成后，用户可使用手机号+密码登录

---

### Q1: 三层账号模型的优势是什么？

**A**:

**旧模型（单层）的局限**:
- ❌ `users` 表存储 `openId` 和 `mpOpenId`
- ❌ 无法区分同一用户在不同应用的登录
- ❌ 难以扩展到新的登录方式

**新模型（三层）的优势**:
- ✅ `unionId` 统一用户标识
- ✅ `UserAccount` 支持多个登录入口
- ✅ 易于扩展（小程序、App等）
- ✅ 符合微信 UnionID 机制标准

---

### Q2: 用户在多个应用间如何共享登录状态？

**A**: 通过统一的 `userId` 和 Token：

```
1. 用户在 PR 系统登录
   ├─ 获取 userId 和 token
   └─ 存储 session

2. 用户访问 Pixel 系统
   ├─ 检测到未登录
   ├─ 跳转到账号中心
   ├─ 账号中心验证 token 有效
   └─ 返回 userId（无需重新授权）

3. Pixel 创建本地用户，关联同一个 userId
```

---

### Q3: Token过期怎么办？

**A**:

**Token有效期**: 7天

**处理方式**:
```typescript
// 方案1: 重新登录
if (tokenExpired) {
  window.location.href = '/login'
}

// 方案2: 自动刷新（需要账号中心支持）
// 未来可能提供 refresh_token 机制
```

---

## 联系支持

### 账号中心团队

**技术支持**:
- 邮箱: support@crazyaigc.com
- 文档: https://docs.crazyaigc.com/auth-center

### 需要帮助的场景

1. **数据库接入**
   - 创建数据库和用户
   - 配置权限
   - 获取连接字符串

2. **技术问题**
   - API调用问题
   - 集成难题
   - Bug反馈

3. **业务咨询**
   - 多业务系统互通
   - 用户数据迁移
   - 定制化需求

---

**文档版本**: V3.0.2
**最后更新**: 2026-01-31
**架构版本**: 前后端分离 + Go 后端 + 三层账号模型 (V3.0)
**维护团队**: KeeNChase 账号中心团队
