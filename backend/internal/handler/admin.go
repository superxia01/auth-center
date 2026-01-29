package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetUsers 获取用户列表
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// SetPhonePassword 设置手机号密码
func SetPhonePassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// VerifyAdmin 验证管理员
func VerifyAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}
