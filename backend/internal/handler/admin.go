package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/keenchase/auth-center/internal/config"
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
	Data    []map[string]interface{} `json:"data"`
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Error   string      `json:"error,omitempty"`
}

// GetUsers 获取用户列表
func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GetUsersRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, GetUsersResponse{
				Success: false,
				Error:   "无效的请求参数",
			})
			return
		}

		// 参数验证
		if req.Page < 1 || req.PageSize < 1 || req.PageSize > 100 {
			c.JSON(http.StatusBadRequest, GetUsersResponse{
				Success: false,
				Error:   "分页参数无效",
			})
			return
		}

		// 获取用户列表
		users, total, err := service.GetUsers(db, req.Page, req.PageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, GetUsersResponse{
				Success: false,
				Error:   "获取用户列表失败",
			})
			return
		}

		c.JSON(http.StatusOK, GetUsersResponse{
			Success: true,
			Data:    users,
			Total:   total,
			Page:    req.Page,
			PageSize: req.PageSize,
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

// VerifyAdminRequest 验证管理员请求
type VerifyAdminRequest struct {
	UnionID string `json:"unionId" binding:"required"`
}

// VerifyAdmin 验证管理员
func VerifyAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req VerifyAdminRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "无效的请求参数",
			})
			return
		}

		cfg := config.Load()

		// 检查是否是管理员
		if cfg.AdminWeChatOpenID == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "管理员未配置",
			})
			return
		}

		// 验证 UnionID 是否匹配
		var user struct {
			UnionID string `json:"unionId"`
		}
		if err := db.Table("users").Where("unionId = ?", req.UnionID).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "用户不存在",
			})
			return
		}

		if user.UnionID != cfg.AdminWeChatOpenID {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "无管理员权限",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"isAdmin": true,
		})
	}
}
