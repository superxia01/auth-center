package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 生成请求 ID
		requestID := uuid.New().String()
		c.Set("requestID", requestID)

		// 记录请求开始时间
		start := time.Now()

		// 处理请求
		c.Next()

		// 计算处理时长
		latency := time.Since(start)

		// 记录日志
		log.Printf("[%s] %s %s | Status: %d | Latency: %v | ClientIP: %s",
			requestID,
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			latency,
			c.ClientIP(),
		)
	}
}
