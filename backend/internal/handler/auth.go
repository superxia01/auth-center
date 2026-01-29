package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/keenchase/auth-center/internal/config"
	"github.com/keenchase/auth-center/internal/service"
	"gorm.io/gorm"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Code     string `json:"code"`
	Type     string `json:"type"` // "mp" 或 "open"
	CallbackURL string `json:"callbackUrl"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	UserID   string `json:"userId,omitempty"`
	Error    string `json:"error,omitempty"`
}

// WeChatLogin 微信登录
func WeChatLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, LoginResponse{
				Success: false,
				Error:   "无效的请求参数",
			})
			return
		}

		// 获取配置
		cfg := config.Load()

		// 获取微信 Access Token
		isMP := req.Type == "mp"
		wxResp, err := service.GetWeChatAccessToken(cfg, req.Code, isMP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "微信认证失败",
			})
			return
		}

		// 获取用户信息
		userInfo, err := service.GetWeChatUserInfo(wxResp.AccessToken, wxResp.OpenID, isMP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "获取用户信息失败",
			})
			return
		}

		// 获取或创建用户
		appID := cfg.WeChatAppID
		if isMP {
			appID = cfg.WeChatMPAppID
		}

		accountType := "web"
		if isMP {
			accountType = "mp"
		}

		user, err := service.FindOrCreateUserByUnionID(
			db,
			wxResp.UnionID,
			wxResp.OpenID,
			appID,
			accountType,
			userInfo,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "用户创建失败",
			})
			return
		}

		// 生成 JWT Token
		token, err := service.GenerateToken(user.UserID, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "生成Token失败",
			})
			return
		}

		// 创建会话
		_, err = service.CreateSession(db, user.UserID, token, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "创建会话失败",
			})
			return
		}

		c.JSON(http.StatusOK, LoginResponse{
			Success: true,
			Token:   token,
			UserID:  user.UserID,
		})
	}
}

// WeChatCallback 微信公众号回调
func WeChatCallback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		state := c.Query("state")

		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "缺少授权码",
			})
			return
		}

		// 重定向到前端，带上授权码
		callbackURL := state // 从 state 参数获取回调 URL
		if callbackURL == "" {
			callbackURL = "http://localhost:3000/auth-complete"
		}

		redirectURL := callbackURL + "?code=" + code + "&type=mp"
		c.Redirect(http.StatusFound, redirectURL)
	}
}

// OpenPlatformCallback 开放平台回调
func OpenPlatformCallback(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		state := c.Query("state")

		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "缺少授权码",
			})
			return
		}

		// 重定向到前端，带上授权码
		callbackURL := state
		if callbackURL == "" {
			callbackURL = "http://localhost:3000/auth-complete"
		}

		redirectURL := callbackURL + "?code=" + code + "&type=open"
		c.Redirect(http.StatusFound, redirectURL)
	}
}

// VerifyTokenRequest Token 验证请求
type VerifyTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// VerifyToken 验证 Token
func VerifyToken(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req VerifyTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "无效的请求参数",
			})
			return
		}

		cfg := config.Load()

		// 验证 Token
		_, err := service.ValidateToken(req.Token, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "无效的Token",
			})
			return
		}

		// 检查会话是否有效
		user, err := service.GetUserByToken(db, req.Token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "会话已过期",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"userId": user.UserID,
				"unionId": user.UnionID,
			},
		})
	}
}

// GetUserInfo 获取用户信息
func GetUserInfo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userId")

		var user struct {
			UserID    string `json:"userId"`
			UnionID   string `json:"unionId"`
			Email     string `json:"email"`
			Phone     string `json:"phone"`
		}

		if err := db.Table("users").Where("userId = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "用户不存在",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    user,
		})
	}
}

// PasswordLoginRequest 密码登录请求
type PasswordLoginRequest struct {
	PhoneNumber string `json:"phoneNumber" binding:"required"`
	Password    string `json:"password" binding:"required"`
}

// PasswordLogin 密码登录
func PasswordLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req PasswordLoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "无效的请求参数",
			})
			return
		}

		// 验证密码
		user, err := service.VerifyPassword(db, req.PhoneNumber, req.Password)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "手机号或密码错误",
			})
			return
		}

		if user == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "用户不存在",
			})
			return
		}

		// 生成 JWT Token
		cfg := config.Load()
		token, err := service.GenerateToken(user.UserID, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "生成Token失败",
			})
			return
		}

		// 创建会话
		_, err = service.CreateSession(db, user.UserID, token, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "创建会话失败",
			})
			return
		}

		c.JSON(http.StatusOK, LoginResponse{
			Success: true,
			Token:   token,
			UserID:  user.UserID,
		})
	}
}

// SignOut 登出
func SignOut(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "缺少授权令牌",
			})
			return
		}

		// 提取 Bearer Token
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// 删除会话
		if err := service.DeleteSession(db, token); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "登出失败",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
		})
	}
}
