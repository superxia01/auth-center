package handler

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

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

// isWechatBrowser 检测是否在微信内置浏览器
func isWechatBrowser(userAgent string) bool {
	return containsIgnoreCase(userAgent, "MicroMessenger") ||
		containsIgnoreCase(userAgent, "wxwork") ||
		containsIgnoreCase(userAgent, "WeChat")
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || indexOfIgnoreCase(s, substr) >= 0))
}

func indexOfIgnoreCase(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// WeChatLogin 微信登录（支持 POST 和 GET）
// POST: 使用 code 换取 token（已登录后回调）
// GET: 重定向到微信授权页面（智能检测：PC扫码 or 微信内授权）
func WeChatLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// GET 请求：重定向到微信授权页面
		if c.Request.Method == "GET" {
			handleWeChatLoginRedirect(c)
			return
		}

		// POST 请求：使用 code 换取 token
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

		// 获取用户信息（仅公众号需要调用此接口）
		userInfo, err := service.GetWeChatUserInfo(wxResp.AccessToken, wxResp.OpenID, isMP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Error:   "获取用户信息失败",
			})
			return
		}

		// 提取 UnionID（注意：公众号和开放平台的 unionid 获取位置不同）
		var unionID string
		if isMP {
			// 公众号：unionid 在 userinfo 响应中
			unionID = service.GetStringValue(userInfo, "unionid")
		} else {
			// 开放平台：unionid 在 access_token 响应中
			unionID = wxResp.UnionID
		}

		// 验证 unionID 不为空
		if unionID == "" {
			c.JSON(http.StatusBadRequest, LoginResponse{
				Success: false,
				Error:   "无法获取用户唯一标识，请确保应用已绑定到微信开放平台",
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
			unionID,
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

// handleWeChatLoginRedirect 处理微信登录重定向（智能检测）
func handleWeChatLoginRedirect(c *gin.Context) {
	cfg := config.Load()
	callbackURL := c.Query("callbackUrl")
	if callbackURL == "" {
		callbackURL = "/"
	}

	// 验证回调 URL（简单验证：必须以 https://os.crazyaigc.com 开头）
	if !isValidCallbackURL(callbackURL) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_CALLBACK_URL",
				"message": "回调 URL 不在允许的域名列表中",
			},
		})
		return
	}

	// 获取 Host（优先使用 X-Forwarded-Host，因为可能有 Nginx 代理）
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.GetHeader("Host")
	}
	// 移除端口号
	if idx := len(host) - 1; idx >= 0 && host[idx] >= '0' && host[idx] <= '9' {
		for i := idx; i >= 0; i-- {
			if host[i] == ':' {
				host = host[:i]
				break
			}
		}
	}
	if host == "" {
		host = "os.crazyaigc.com"
	}

	// 检测是否在微信内置浏览器
	userAgent := c.GetHeader("User-Agent")
	isInWeChat := isWechatBrowser(userAgent)

	if isInWeChat {
		// 微信内置浏览器：使用公众号授权
		if cfg.WeChatMPAppID == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "公众号配置缺失",
			})
			return
		}

		redirectURI := fmt.Sprintf("https://%s/api/auth/wechat/mp-redirect", host)
		state := callbackURL
		authURL := fmt.Sprintf(
			"https://open.weixin.qq.com/connect/oauth2/authorize?appid=%s&redirect_uri=%s&response_type=code&scope=snsapi_userinfo&state=%s#wechat_redirect",
			cfg.WeChatMPAppID,
			redirectURI,
			state,
		)
		c.Redirect(http.StatusFound, authURL)
	} else {
		// PC 浏览器：使用开放平台扫码登录
		if cfg.WeChatAppID == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "微信开放平台配置缺失",
			})
			return
		}

		redirectURI := fmt.Sprintf("https://%s/api/auth/wechat/open-platform-redirect", host)
		state := callbackURL
		authURL := fmt.Sprintf(
			"https://open.weixin.qq.com/connect/qrconnect?appid=%s&redirect_uri=%s&response_type=code&scope=snsapi_login&state=%s#wechat_redirect",
			cfg.WeChatAppID,
			redirectURI,
			state,
		)
		c.Redirect(http.StatusFound, authURL)
	}
}

// isValidCallbackURL 验证回调 URL
func isValidCallbackURL(callbackURL string) bool {
	// 允许根路径
	if callbackURL == "/" {
		return true
	}

	cfg := config.Load()

	// 解析 URL
	parsedURL, err := url.Parse(callbackURL)
	if err != nil {
		return false
	}

	hostname := parsedURL.Hostname()

	// 解析白名单域名
	allowedDomains := strings.Split(cfg.AllowedCallbackDomains, ",")
	for i := range allowedDomains {
		allowedDomains[i] = strings.TrimSpace(allowedDomains[i])
	}

	// 检查域名是否在白名单中
	for _, allowedDomain := range allowedDomains {
		// 精确匹配
		if hostname == allowedDomain {
			// 非 localhost 必须使用 HTTPS
			if hostname != "localhost" && parsedURL.Scheme != "https" {
				return false
			}
			return true
		}

		// 通配符匹配 (*.example.com)
		if strings.HasPrefix(allowedDomain, "*.") {
			baseDomain := allowedDomain[2:]
			if hostname == baseDomain || strings.HasSuffix(hostname, "."+baseDomain) {
				// 非 localhost 必须使用 HTTPS
				if hostname != "localhost" && parsedURL.Scheme != "https" {
					return false
				}
				return true
			}
		}
	}

	return false
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
		// 尝试从多个地方获取code参数
		code := c.Query("code")

		// 如果URL参数中没有code，尝试从POST body获取
		if code == "" && c.Request.Method == "POST" {
			var req struct {
				Code string `json:"code"`
			}
			if err := c.ShouldBindJSON(&req); err == nil {
				code = req.Code
			}
		}

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
			callbackURL = "/admin/dashboard"
		}

		redirectURL := callbackURL + "?code=" + code + "&type=open"
		c.Redirect(http.StatusFound, redirectURL)
	}
}

// WeChatMPRedirect 公众号授权重定向（接收微信回调）
func WeChatMPRedirect(db *gorm.DB) gin.HandlerFunc {
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
			callbackURL = "/admin/dashboard"
		}

		redirectURL := callbackURL + "?code=" + code + "&type=mp"
		c.Redirect(http.StatusFound, redirectURL)
	}
}

// OpenPlatformRedirect 开放平台授权重定向（接收微信回调）
func OpenPlatformRedirect(db *gorm.DB) gin.HandlerFunc {
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
			callbackURL = "/admin/dashboard"
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
