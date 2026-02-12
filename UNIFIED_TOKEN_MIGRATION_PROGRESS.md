# 统一 Token 模式改造进度文档

> 目标：将所有业务系统从混合模式改造为统一 token 模式，使用 AuthCenterMiddleware 中间件

**创建时间**：2025-02-06
**状态**：进行中

---

## 一、改造方案概述

### 当前混合模式
- **PC 扫码**：auth-center → code + type → 业务系统
- **微信内**：auth-center → userId + token → 业务系统

### 统一 Token 模式（目标）
- **所有场景**：auth-center → token → 业务系统
- **业务系统**：统一使用 AuthCenterMiddleware 中间件处理认证

---

## 二、改造清单

### ✅ 已完成

| # | 业务系统 | 文件 | 状态 | 说明 |
|---|---------|------|------|------|
| 1 | auth-center | `backend/internal/handler/auth.go` | ✅ 完成 | 修改 OpenPlatformRedirect 函数，完成登录后返回 token |
| 2 | superpixel | `frontend/src/pages/AuthCallbackPage.tsx` | ✅ 完成 | 删除 code 逻辑，只处理 token（108行→66行） |
| 3 | superpixel | `backend/internal/middleware/auth_center.go` | ✅ 完成 | 添加新用户创建逻辑 |
| 4 | superpixel | `backend/internal/service/auth_center_service.go` | ✅ 完成 | 添加 GetUserInfoFromToken 方法 |
| 5 | edit-business | `frontend/src/pages/AuthCallbackPage.tsx` | ✅ 完成 | 删除 code 逻辑，只处理 token（143行→95行） |

---

### 🚧 进行中

| # | 业务系统 | 任务 | 状态 |
|---|---------|------|------|
| 6 | edit-business | 创建 `middleware/auth_center.go` | ⏳ 进行中 |
| 7 | edit-business | 创建 `service/auth_center_service.go` | ⏸️ 待开始 |
| 8 | edit-business | 创建 `pkg/authcenter/client.go` | ⏸️ 待开始 |
| 9 | edit-business | 修改路由配置 | ⏸️ 待开始 |
| 10 | edit-business | 简化 `handler/auth_handler.go` | ⏸️ 待开始 |

---

### 📋 待完成

| # | 业务系统 | 任务 | 预计工作量 |
|---|---------|------|-----------|
| 11 | pr-business | 前端改造 | ~30 行 |
| 12 | pr-business | 后端中间件改造 | ~100 行 |
| 13 | pr-business | 后端 Service 改造 | ~50 行 |
| 14 | service-quote-system | 前端改造 | ~30 行 |
| 15 | service-quote-system | 后端中间件改造 | ~100 行 |
| 16 | service-quote-system | 后端 Service 改造 | ~50 行 |

---

## 三、详细改造指南

### 3.1 前端改造模板

**文件**：`frontend/src/pages/AuthCallbackPage.tsx`

**修改前**：
```typescript
const code = searchParams.get('code')
const type = searchParams.get('type')
const token = searchParams.get('token')
const userId = searchParams.get('userId')

if (token && userId) {
  // 微信内登录逻辑
} else if (code) {
  // PC 扫码登录逻辑
}
```

**修改后**：
```typescript
const token = searchParams.get('token')

if (!token) {
  setStatus('error')
  setMessage('登录失败：缺少 token')
  return
}

const response = await fetch('/api/v1/users/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

---

### 3.2 后端中间件改造模板

**文件**：`backend/internal/middleware/auth_center.go`

**完整代码**：
```go
package middleware

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// generateInvitationCode 生成8位随机邀请码
func generateInvitationCode() string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	rand.Seed(time.Now().UnixNano())
	code := make([]byte, 8)
	for i := range code {
		code[i] = chars[rand.Intn(len(chars))]
	}
	return string(code)
}

// AuthCenterMiddleware 账号中心认证中间件
func AuthCenterMiddleware(authCenterService AuthCenterService, userRepo UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token 格式错误"})
			c.Abort()
			return
		}

		token := parts[1]

		// 1. 验证 token
		authCenterUserID, err := authCenterService.VerifyToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token 无效"})
			c.Abort()
			return
		}

		// 2. 获取本地用户
		localUser, err := userRepo.GetByAuthCenterUserID(authCenterUserID)
		if err != nil {
			// 3. 本地用户不存在，从 auth-center 获取并创建
			authCenterUserInfo, err := authCenterService.GetUserInfoFromToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "获取用户信息失败"})
				c.Abort()
				return
			}

			// 创建本地用户
			newUser := &User{
				AuthCenterUserID: &authCenterUserID,
				UnionID:          &authCenterUserInfo.UnionID,
				Nickname:         &authCenterUserInfo.Profile.Nickname,
				AvatarURL:        &authCenterUserInfo.Profile.AvatarURL,
				Role:             "user",
				LoginType:        "wechat",
			}
			newUser.InvitationCode = generateInvitationCode()

			userRepo.Create(c.Request.Context(), newUser)
			localUser = newUser
		}

		// 4. 存入上下文
		c.Set("user", localUser)
		c.Set("authCenterUserID", authCenterUserID)

		c.Next()
	}
}
```

---

### 3.3 后端 Service 改造模板

**文件**：`backend/internal/service/auth_center_service.go`

**需要添加的方法**：
```go
// GetUserInfoFromToken 用 token 获取账号中心的用户信息
func (s *AuthCenterService) GetUserInfoFromToken(token string) (*authcenter.UserInfoResponse, error) {
	return s.authCenterClient.GetUserInfo(token)
}

// VerifyToken 验证 Token
func (s *AuthCenterService) VerifyToken(token string) (string, error) {
	resp, err := s.authCenterClient.VerifyToken(token)
	if err != nil {
		return "", err
	}
	return resp.Data.UserID, nil
}
```

---

### 3.4 路由配置改造

**修改前**：
```go
router.GET("/api/v1/users/me", handler.Me)
```

**修改后**：
```go
import (
    "github.com/keenchase/business/internal/middleware"
)

router.GET("/api/v1/users/me",
    middleware.AuthCenterMiddleware(authService, userRepo),
    handler.Me)
```

---

### 3.5 Handler 改造

**修改前**：
```go
func (h *Handler) Me(c *gin.Context) {
    token := extractToken(c)
    userInfo := callAuthCenter(token)
    user := getOrCreateUser(userInfo)
    c.JSON(user)
}
```

**修改后**：
```go
func (h *Handler) Me(c *gin.Context) {
    user, exists := c.Get("user")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
        return
    }
    c.JSON(user)
}
```

---

## 四、各业务系统特定信息

### 4.1 superpixel ✅
- **包名**：`genesis-backend`
- **API 前缀**：`/api/v1`
- **User ID 字段**：`authCenterUserID` (string)
- **状态**：✅ 已完成

### 4.2 edit-business
- **包名**：`github.com/keenchase/edit-business`
- **API 前缀**：`/api/v1`
- **当前认证**：使用 JWT 中间件（自建）
- **需要改造**：
  1. 创建 AuthCenterMiddleware
  2. 创建 AuthCenterService
  3. 创建 authcenter Client
  4. 修改路由配置
  5. 简化 Handler

### 4.3 pr-business
- **状态**：待检查
- **预计改造**：同 edit-business

### 4.4 service-quote-system
- **状态**：待检查
- **预计改造**：同 edit-business

---

## 五、验证清单

改造完成后，需要验证以下功能：

- [ ] PC 扫码登录：获取 token → 调用 /auth/me → 返回用户信息
- [ ] 微信内登录：获取 token → 调用 /auth/me → 返回用户信息
- [ ] 新用户首次登录：自动创建本地用户
- [ ] 老用户登录：直接返回本地用户信息
- [ ] Token 验证：无效 token 返回 401
- [ ] 用户信息完整性：包含 unionID、昵称、头像

---

## 六、回滚方案

如果改造后出现问题，回滚步骤：

1. **auth-center**：恢复 `OpenPlatformRedirect` 函数
   ```bash
   git checkout HEAD -- backend/internal/handler/auth.go
   ```

2. **前端**：恢复 AuthCallbackPage.tsx
   ```bash
   git checkout HEAD -- frontend/src/pages/AuthCallbackPage.tsx
   ```

3. **后端**：删除 auth_center.go，使用原 JWT 中间件

---

## 七、注意事项

1. **Token 有效期**：auth-center token 有效期 30 天，业务系统无需刷新
2. **本地用户创建**：只创建一次，后续通过 authCenterUserID 关联
3. **安全性**：不在 URL 中暴露 token，只在 Authorization header 中传递
4. **兼容性**：确保所有需要认证的接口都添加 AuthCenterMiddleware

---

## 八、下一步行动

- [ ] 完成 edit-business 改造
- [ ] 完成 pr-business 改造
- [ ] 完成 service-quote-system 改造
- [ ] 全面测试所有业务系统
- [ ] 更新部署文档
- [ ] 通知团队改造完成

---

**最后更新**：2025-02-06 （改造进行中）
