package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/keenchase/auth-center/internal/models"
)

const (
	// TokenExpiration Token 有效期（7天）
	TokenExpiration = 7 * 24 * time.Hour
)

// Claims JWT 声明
type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

// GenerateToken 生成 JWT Token
func GenerateToken(userID string, secret string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			IssuedAt: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(TokenExpiration)),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken 验证 JWT Token
func ValidateToken(tokenString string, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok || token.Header["alg"] != "HS256" {
			return nil, errors.New("无效的签名算法")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效的 Token")
}

// CreateSession 创建会话
func CreateSession(db *gorm.DB, userID string, token string, deviceInfo map[string]interface{}) (string, error) {
	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(TokenExpiration)

	var deviceInfoJSON *string
	if deviceInfo != nil {
		// 简化处理，实际应该序列化
		deviceInfoStr := "{}"
		deviceInfoJSON = &deviceInfoStr
	}

	session := models.Session{
		ID:         sessionID,
		UserID:     userID,
		Token:      token,
		DeviceInfo: deviceInfoJSON,
		ExpiresAt:  &expiresAt,
	}

	if err := db.Create(&session).Error; err != nil {
		return "", err
	}

	return sessionID, nil
}

// DeleteSession 删除会话
func DeleteSession(db *gorm.DB, token string) error {
	return db.Where("token = ?", token).Delete(&models.Session{}).Error
}

// GetUserByToken 根据 Token 获取用户
func GetUserByToken(db *gorm.DB, token string) (*models.User, error) {
	var session models.Session
	if err := db.Where("token = ? AND expires_at > ?", token, time.Now()).First(&session).Error; err != nil {
		return nil, err
	}

	var user models.User
	if err := db.Where("user_id = ?", session.UserID).First(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}
