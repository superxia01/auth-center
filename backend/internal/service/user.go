package service

import (
	"golang.org/x/crypto/bcrypt"

	"github.com/keenchase/auth-center/internal/models"
	"gorm.io/gorm"
)

// VerifyPassword 验证密码
func VerifyPassword(db *gorm.DB, phoneNumber, password string) (*models.User, error) {
	var user models.User
	if err := db.Where("phoneNumber = ?", phoneNumber).First(&user).Error; err != nil {
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

// SetPhonePassword 设置手机号和密码
func SetPhonePassword(db *gorm.DB, userID, phoneNumber, password string) error {
	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// 更新用户
	return db.Model(&models.User{}).Where("userId = ?", userID).Updates(map[string]interface{}{
		"phoneNumber": phoneNumber,
		"passwordHash": string(hashedPassword),
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

	// 分页查询
	offset := (page - 1) * pageSize
	if err := db.Limit(pageSize).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	// 转换为返回格式
	result := make([]map[string]interface{}, len(users))
	for i, user := range users {
		result[i] = map[string]interface{}{
			"userId":      user.UserID,
			"unionId":     user.UnionID,
			"phoneNumber": user.PhoneNumber,
			"email":       user.Email,
			"createdAt":  user.CreatedAt,
			"updatedAt":  user.UpdatedAt,
		}
	}

	return result, total, nil
}
