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

// RequireRole 要求特定角色
func RequireRole(db *gorm.DB, role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: 实现角色验证逻辑
		c.Next()
	}
}
