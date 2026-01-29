package config

import (
	"os"
)

// Config 应用配置
type Config struct {
	// 数据库配置
	DatabaseURL string

	// JWT 密钥
	JWTSecret string

	// 微信开放平台配置
	WeChatAppID     string
	WeChatAppSecret  string

	// 微信公众号配置
	WeChatMPAppID     string
	WeChatMPSecret    string

	// 管理员配置
	AdminWeChatOpenID string

	// 环境变量
	Environment string
}

// Load 从环境变量加载配置
func Load() *Config {
	return &Config{
		DatabaseURL:         getEnv("AUTH_CENTER_DATABASE_URL", ""),
		JWTSecret:           getEnv("AUTH_CENTER_SECRET", ""),
		WeChatAppID:         getEnv("WECHAT_APP_ID", ""),
		WeChatAppSecret:     getEnv("WECHAT_APP_SECRET", ""),
		WeChatMPAppID:        getEnv("WECHAT_MP_APPID", ""),
		WeChatMPSecret:       getEnv("WECHAT_MP_SECRET", ""),
		AdminWeChatOpenID:    getEnv("ADMIN_WECHAT_OPENID", ""),
		Environment:          getEnv("NODE_ENV", "development"),
	}
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
