package service

import (
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/keenchase/auth-center/internal/models"
	"gorm.io/gorm"
)

// VerifyPassword 验证密码
func VerifyPassword(db *gorm.DB, phoneNumber, password string) (*models.User, error) {
	var user models.User
	if err := db.Where("phone_number = ?", phoneNumber).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // 用户不存在
		}
		return nil, err
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, err
	}

	return &user, nil
}

// UpdateLastLogin 更新最后登录时间
func UpdateLastLogin(db *gorm.DB, userID string) error {
	now := time.Now()
	return db.Model(&models.User{}).Where("user_id = ?", userID).Update("last_login_at", now).Error
}

// SetPhonePassword 设置手机号和密码
func SetPhonePassword(db *gorm.DB, userID, phoneNumber, password string) error {
	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// 更新用户
	return db.Model(&models.User{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"phone_number":  phoneNumber,
		"password_hash": string(hashedPassword),
	}).Error
}

// GetUsers 获取用户列表（分页）
func GetUsers(db *gorm.DB, page, pageSize int) ([]map[string]interface{}, int64, error) {
	var users []models.User
	var total int64

	// 计算总数
	if err := db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询用户，预加载账号和会话信息
	offset := (page - 1) * pageSize
	if err := db.Preload("Accounts").Preload("Sessions").Limit(pageSize).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	// 转换为返回格式，包含所有字段
	result := make([]map[string]interface{}, len(users))
	for i, user := range users {
		// 构建账号信息列表
		accounts := make([]map[string]interface{}, len(user.Accounts))
		for j, acc := range user.Accounts {
			accounts[j] = map[string]interface{}{
				"id":         acc.ID,
				"provider":   acc.Provider,
				"appId":      acc.AppID,
				"openId":     acc.OpenID,
				"type":       acc.Type,
				"nickname":   acc.Nickname,
				"avatarUrl":  acc.AvatarURL,
				"createdAt":  acc.CreatedAt,
			}
		}

		// 构建会话信息列表
		sessions := make([]map[string]interface{}, len(user.Sessions))
		for j, sess := range user.Sessions {
			sessions[j] = map[string]interface{}{
				"id":         sess.ID,
				"token":      sess.Token,
				"deviceInfo": sess.DeviceInfo,
				"expiresAt":  sess.ExpiresAt,
				"createdAt":  sess.CreatedAt,
			}
		}

		// 检查登录方式
		loginMethods := map[string]bool{
			"wechat":  false,
			"password": false,
		}
		hasPassword := user.PasswordHash != ""
		if hasPassword {
			loginMethods["password"] = true
		}
		for _, acc := range user.Accounts {
			if acc.Provider == "wechat" {
				loginMethods["wechat"] = true
			}
		}

		result[i] = map[string]interface{}{
			"userId":       user.UserID,
			"unionId":      user.UnionID,
			"phoneNumber":  user.PhoneNumber,
			"email":        user.Email,
			"createdAt":    user.CreatedAt,
			"updatedAt":    user.UpdatedAt,
			"lastLoginAt":  user.LastLoginAt,
			"accounts":     accounts,
			"sessions":     sessions,
			"loginMethods": loginMethods,
		}
	}

	return result, total, nil
}

// GetSessions 获取用户的所有会话
func GetSessions(db *gorm.DB, userID string) ([]map[string]interface{}, error) {
	var sessions []models.Session

	if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, len(sessions))
	for i, sess := range sessions {
		result[i] = map[string]interface{}{
			"id":         sess.ID,
			"token":      sess.Token,
			"deviceInfo": sess.DeviceInfo,
			"expiresAt":  sess.ExpiresAt,
			"createdAt":  sess.CreatedAt,
		}
	}

	return result, nil
}
