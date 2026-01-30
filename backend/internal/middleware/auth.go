package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/keenchase/auth-center/internal/config"
	"gorm.io/gorm"
)

// Claims JWT 声明
type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

// Auth JWT 认证中间件
func Auth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取 Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "缺少授权令牌",
			})
			c.Abort()
			return
		}

		// 解析 Bearer Token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "无效的授权格式",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// 加载配置获取 JWT Secret
		cfg := config.Load()
		secret := cfg.JWTSecret

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "无效的令牌",
			})
			c.Abort()
			return
		}

		// 将用户信息存储到上下文
		c.Set("userId", claims.UserID)

		c.Next()
	}
}

// RequireAdmin 要求管理员权限
// 通过验证用户的微信 OpenID 是否匹配配置中的管理员 OpenID
func RequireAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userId")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "未授权",
			})
			c.Abort()
			return
		}

		// 加载配置获取管理员 OpenID
		cfg := config.Load()
		adminOpenID := cfg.AdminWeChatOpenID

		if adminOpenID == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "管理员配置缺失",
			})
			c.Abort()
			return
		}

		// 查询用户的微信账号 OpenID
		var account struct {
			OpenID string `gorm:"column:open_id"`
		}
		err := db.Table("user_accounts").
			Select("open_id").
			Where("user_id = ? AND provider = 'wechat'", userID).
			First(&account).Error

		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "无管理员权限",
			})
			c.Abort()
			return
		}

		// 添加日志
		c.Header("X-User-OpenID", account.OpenID)
		c.Header("X-Admin-OpenID", adminOpenID)

		// 验证 OpenID 是否匹配管理员
		if account.OpenID != adminOpenID {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "无管理员权限",
				"debug": gin.H{
					"userOpenID":  account.OpenID,
					"adminOpenID": adminOpenID,
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
