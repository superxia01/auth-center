package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

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
	var apiURL string
	if isMP {
		apiURL = "https://api.weixin.qq.com/sns/userinfo"
	} else {
		apiURL = "https://api.open.weixin.qq.com/sns/userinfo"
	}

	params := url.Values{}
	params.Set("access_token", accessToken)
	params.Set("openid", openID)
	if isMP {
		params.Set("lang", "zh_CN")
	}

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
	err := db.Where("unionId = ?", unionID).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// 用户不存在，创建新用户
		userID := fmt.Sprintf("user-%s", time.Now().Format("20060102150405"))

		user = models.User{
			UserID:  userID,
			UnionID: unionID,
		}

		if err := db.Create(&user).Error; err != nil {
			return nil, fmt.Errorf("创建用户失败: %w", err)
		}
	}

	// 创建或更新用户账户
	var account models.UserAccount
	err = db.Where(
		"userId = ? AND provider = ? AND appId = ? AND openId = ?",
		user.UserID, "wechat", appID, openID,
	).First(&account).Error

	if err == gorm.ErrRecordNotFound {
		account = models.UserAccount{
			UserID:    user.UserID,
			Provider:  "wechat",
			AppID:     appID,
			OpenID:    openID,
			Type:      accountType,
			Nickname:  getStringValue(userInfo, "nickname"),
			AvatarURL: getStringValue(userInfo, "headimgurl"),
		}

		if err := db.Create(&account).Error; err != nil {
			return nil, fmt.Errorf("创建用户账户失败: %w", err)
		}
	}

	return &user, nil
}

// getStringValue 从 map 中安全地获取字符串值
func getStringValue(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}
