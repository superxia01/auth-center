package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/keenchase/auth-center/internal/service"
	"gorm.io/gorm"
)

// GetUsersRequest 获取用户列表请求
type GetUsersRequest struct {
	Page     int `json:"page" binding:"required"`
	PageSize int `json:"pageSize" binding:"required"`
}

// GetUsersResponse 获取用户列表响应
type GetUsersResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
}

// GetUsers 获取用户列表
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 query 参数获取分页信息，设置默认值
		pageStr := c.DefaultQuery("page", "1")
		pageSizeStr := c.DefaultQuery("pageSize", "10")

		// 转换为整数
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		pageSize, err := strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 || pageSize > 100 {
			pageSize = 10
		}

		// 获取用户列表
		users, total, err := service.GetUsers(db, page, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, GetUsersResponse{
				Success: false,
				Error:   "获取用户列表失败",
			})
			return
		}

		// 构建统计信息
		stats := map[string]interface{}{
			"total":        total,
			"withPassword": 0, // TODO: 从数据库统计
			"wechatLogin":   total, // 目前所有用户都是微信登录
		}

		// 返回嵌套的数据结构（前端期望的格式）
		c.JSON(http.StatusOK, GetUsersResponse{
			Success: true,
			Data: map[string]interface{}{
				"users":     users,
				"statistics": stats,
				"pagination": map[string]interface{}{
					"total":     total,
					"page":      page,
					"pageSize":  pageSize,
				},
			},
		})
	}
}

// SetPhonePasswordRequest 设置手机号密码请求
type SetPhonePasswordRequest struct {
	UserID      string `json:"userId" binding:"required"`
	PhoneNumber string  `json:"phoneNumber" binding:"required"`
	Password    string  `json:"password" binding:"required,min=6"`
}

// SetPhonePassword 设置手机号密码
func SetPhonePassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req SetPhonePasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "无效的请求参数",
			})
			return
		}

		// 设置手机号和密码
		if err := service.SetPhonePassword(db, req.UserID, req.PhoneNumber, req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "设置失败",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
		})
	}
}

// VerifyAdmin 验证管理员
// 注意：此路由已被 RequireAdmin 中间件保护，能到达这里的都是管理员
func VerifyAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取用户信息
		userID := c.GetString("userId")

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"isAdmin": true,
			"userId":  userID,
		})
	}
}
