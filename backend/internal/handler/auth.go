package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// WeChatLogin 微信登录
func WeChatLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// WeChatCallback 微信公众号回调
func WeChatCallback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// OpenPlatformCallback 开放平台回调
func OpenPlatformCallback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// VerifyToken 验证 Token
func VerifyToken(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// GetUserInfo 获取用户信息
func GetUserInfo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// PasswordLogin 密码登录
func PasswordLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}

// SignOut 登出
func SignOut(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "待实现",
		})
	}
}
