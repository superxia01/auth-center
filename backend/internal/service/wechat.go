package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/keenchase/auth-center/internal/config"
	"github.com/keenchase/auth-center/internal/models"
	"gorm.io/gorm"
)

// WeChatOAuthResponse 微信 OAuth 响应
type WeChatOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenID       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionID      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

// GetWeChatAccessToken 获取微信 Access Token
func GetWeChatAccessToken(cfg *config.Config, code string, isMP bool) (*WeChatOAuthResponse, error) {
	var appID, appSecret string

	if isMP {
		appID = cfg.WeChatMPAppID
		appSecret = cfg.WeChatMPSecret
	} else {
		appID = cfg.WeChatAppID
		appSecret = cfg.WeChatAppSecret
	}

	// 构建请求 URL
	apiURL := "https://api.weixin.qq.com/sns/oauth2/access_token"
	if isMP {
		apiURL = "https://api.weixin.qq.com/sns/oauth2/access_token" // 公众号使用相同接口
	}

	params := url.Values{}
	params.Set("appid", appID)
	params.Set("secret", appSecret)
	params.Set("code", code)
	params.Set("grant_type", "authorization_code")

	// 发送请求
	resp, err := http.Get(apiURL + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("请求微信 API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result WeChatOAuthResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.ErrCode != 0 {
		return nil, fmt.Errorf("微信 API 错误: %s", result.ErrMsg)
	}

	return &result, nil
}

// GetWeChatUserInfo 获取微信用户信息
func GetWeChatUserInfo(accessToken, openID string, isMP bool) (map[string]interface{}, error) {
	// 公众号和开放平台都需要调用 userinfo 接口获取用户信息（昵称、头像等）
	apiURL := "https://api.weixin.qq.com/sns/userinfo"
	params := url.Values{}
	params.Set("access_token", accessToken)
	params.Set("openid", openID)
	params.Set("lang", "zh_CN")

	resp, err := http.Get(apiURL + "?" + params.Encode())
	if err != nil {
		return nil, fmt.Errorf("请求微信 API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result["errcode"] != nil && result["errcode"].(float64) != 0 {
		return nil, fmt.Errorf("微信 API 错误: %v", result["errmsg"])
	}

	return result, nil
}

// FindOrCreateUserByUnionID 根据 UnionID 查找或创建用户
func FindOrCreateUserByUnionID(db *gorm.DB, unionID string, openID, appID, accountType string, userInfo map[string]interface{}) (*models.User, error) {
	// 先查找用户
	var user models.User
	err := db.Where("union_id = ?", unionID).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// 用户不存在，创建新用户
		// 让数据库自动生成 UUID（通过 gen_random_uuid()）
		user = models.User{
			UnionID: unionID,
		}

		if err := db.Create(&user).Error; err != nil {
			return nil, fmt.Errorf("创建用户失败: %w", err)
		}
	}

	// 创建或更新用户账户
	var account models.UserAccount
	err = db.Where(
		"user_id = ? AND provider = ? AND app_id = ? AND open_id = ?",
		user.UserID, "wechat", appID, openID,
	).First(&account).Error

	if err == gorm.ErrRecordNotFound {
		// 账户不存在，创建新账户
		account = models.UserAccount{
			UserID:    user.UserID,
			Provider:  "wechat",
			AppID:     appID,
			OpenID:    openID,
			Type:      accountType,
			Nickname:  GetStringValue(userInfo, "nickname"),
			AvatarURL: GetStringValue(userInfo, "headimgurl"),
		}

		if err := db.Create(&account).Error; err != nil {
			return nil, fmt.Errorf("创建用户账户失败: %w", err)
		}
	} else if err == nil {
		// 账户已存在，更新昵称和头像
		updates := map[string]interface{}{}
		if nickname := GetStringValue(userInfo, "nickname"); nickname != "" {
			updates["nickname"] = nickname
		}
		if avatarURL := GetStringValue(userInfo, "headimgurl"); avatarURL != "" {
			updates["avatar_url"] = avatarURL
		}
		if len(updates) > 0 {
			if err := db.Model(&account).Updates(updates).Error; err != nil {
				return nil, fmt.Errorf("更新用户账户失败: %w", err)
			}
		}
	}

	return &user, nil
}

// GetStringValue 从 map 中安全地获取字符串值
func GetStringValue(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// CompleteWeChatLoginResult 完成微信登录的结果
type CompleteWeChatLoginResult struct {
	UserID string
	Token  string
}

// CompleteWeChatLogin 完成微信登录流程
// 1. 获取微信 Access Token
// 2. 获取用户信息
// 3. 创建或更新用户
// 4. 生成 JWT Token
// 5. 创建会话
// 6. 更新最后登录时间
func CompleteWeChatLogin(db *gorm.DB, cfg *config.Config, code string, isMP bool) (*CompleteWeChatLoginResult, error) {
	// 1. 获取微信 Access Token
	wxResp, err := GetWeChatAccessToken(cfg, code, isMP)
	if err != nil {
		return nil, fmt.Errorf("获取微信 Access Token 失败: %w", err)
	}

	// 2. 获取用户信息（仅公众号需要调用此接口）
	userInfo, err := GetWeChatUserInfo(wxResp.AccessToken, wxResp.OpenID, isMP)
	if err != nil {
		return nil, fmt.Errorf("获取用户信息失败: %w", err)
	}

	// 3. 提取 UnionID（注意：公众号和开放平台的 unionid 获取位置不同）
	var unionID string
	if isMP {
		// 公众号：unionid 在 userinfo 响应中
		unionID = GetStringValue(userInfo, "unionid")
	} else {
		// 开放平台：unionid 在 access_token 响应中
		unionID = wxResp.UnionID
	}

	// 验证 unionID 不为空
	if unionID == "" {
		return nil, fmt.Errorf("无法获取用户唯一标识，请确保应用已绑定到微信开放平台")
	}

	// 4. 获取或创建用户
	appID := cfg.WeChatAppID
	if isMP {
		appID = cfg.WeChatMPAppID
	}

	accountType := "web"
	if isMP {
		accountType = "mp"
	}

	user, err := FindOrCreateUserByUnionID(
		db,
		unionID,
		wxResp.OpenID,
		appID,
		accountType,
		userInfo,
	)
	if err != nil {
		return nil, fmt.Errorf("获取或创建用户失败: %w", err)
	}

	// 5. 生成 JWT Token
	token, err := GenerateToken(user.UserID, cfg.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("生成 Token 失败: %w", err)
	}

	// 6. 创建会话
	_, err = CreateSession(db, user.UserID, token, nil)
	if err != nil {
		return nil, fmt.Errorf("创建会话失败: %w", err)
	}

	// 7. 更新最后登录时间
	if err := UpdateLastLogin(db, user.UserID); err != nil {
		// 记录错误但不中断登录流程
		fmt.Printf("警告: 更新最后登录时间失败: %v\n", err)
	}

	// 8. 返回结果
	return &CompleteWeChatLoginResult{
		UserID: user.UserID,
		Token:  token,
	}, nil
}
