package service

import (
	"net/url"
	"time"

	"github.com/keenchase/auth-center/internal/models"
	"gorm.io/gorm"
)

// LoginSourceItem 登录来源项（含最近登录时间）
type LoginSourceItem struct {
	SourceHost  string    `json:"sourceHost"`
	LastLoginAt time.Time `json:"lastLoginAt"`
}

// CreateLoginLog 记录用户登录流水（来源业务系统）
func CreateLoginLog(db *gorm.DB, userID, callbackURL, loginMethod string) error {
	sourceHost := parseHostFromCallbackURL(callbackURL)
	if sourceHost == "" {
		return nil // 无有效来源则不记录
	}

	log := models.UserLoginLog{
		UserID:      userID,
		SourceHost:  sourceHost,
		LoginMethod: loginMethod,
	}
	return db.Create(&log).Error
}

// parseHostFromCallbackURL 从 callbackURL 解析 host
func parseHostFromCallbackURL(callbackURL string) string {
	u, err := url.Parse(callbackURL)
	if err != nil || u.Host == "" {
		return ""
	}
	return u.Hostname()
}

// GetUserLoginSources 获取用户登录过的业务系统（去重，含最近登录时间）
func GetUserLoginSources(db *gorm.DB, userIDs []string) map[string][]LoginSourceItem {
	if len(userIDs) == 0 {
		return nil
	}

	var logs []models.UserLoginLog
	db.Where("user_id IN ? AND source_host != ''", userIDs).
		Select("user_id, source_host, created_at").
		Order("created_at DESC").
		Find(&logs)

	// user_id -> source_host -> latest created_at
	seen := make(map[string]map[string]time.Time)
	for _, log := range logs {
		if seen[log.UserID] == nil {
			seen[log.UserID] = make(map[string]time.Time)
		}
		if _, ok := seen[log.UserID][log.SourceHost]; !ok {
			seen[log.UserID][log.SourceHost] = log.CreatedAt
		}
	}

	result := make(map[string][]LoginSourceItem)
	for _, uid := range userIDs {
		if hosts := seen[uid]; len(hosts) > 0 {
			arr := make([]LoginSourceItem, 0, len(hosts))
			for h, t := range hosts {
				arr = append(arr, LoginSourceItem{SourceHost: h, LastLoginAt: t})
			}
			result[uid] = arr
		}
	}
	return result
}
