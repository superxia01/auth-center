package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/keenchase/auth-center/internal/config"
)

// CORS 跨域中间件（带白名单验证）
func CORS(cfg *config.Config) gin.HandlerFunc {
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
