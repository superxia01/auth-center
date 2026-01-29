package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户表
type User struct {
	UserID       string         `gorm:"primaryKey;column:userId;type:varchar(36)" json:"userId"`
	UnionID      string         `gorm:"uniqueIndex;column:unionId;type:varchar(100)" json:"unionId"`
	PhoneNumber  string         `gorm:"uniqueIndex;column:phoneNumber;type:varchar(20)" json:"phoneNumber,omitempty"`
	PasswordHash string         `gorm:"column:passwordHash;type:varchar(255)" json:"-"`
	Email        string         `gorm:"uniqueIndex;column:email;type:varchar(255)" json:"email,omitempty"`
	CreatedAt    time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:updatedAt" json:"updatedAt"`
	Accounts     []UserAccount  `gorm:"foreignKey:UserID;references:UserID" json:"accounts,omitempty"`
	Sessions     []Session      `gorm:"foreignKey:UserID;references:UserID" json:"sessions,omitempty"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// UserAccount 用户登录账户表
type UserAccount struct {
	ID        string    `gorm:"primaryKey;column:id;type:varchar(36)" json:"id"`
	UserID    string    `gorm:"index;column:userId;type:varchar(36);not null" json:"userId"`
	Provider  string    `gorm:"column:provider;type:varchar(50);not null" json:"provider"` // wechat
	AppID     string    `gorm:"column:appId;type:varchar(100);not null" json:"appId"`
	OpenID    string    `gorm:"column:openId;type:varchar(255);not null" json:"openId"`
	Type      string    `gorm:"column:type;type:varchar(20);not null" json:"type"` // web, mp, miniapp, app
	Nickname  string    `gorm:"column:nickname;type:varchar(255)" json:"nickname,omitempty"`
	AvatarURL string    `gorm:"column:avatarUrl;type:text" json:"avatarUrl,omitempty"`
	CreatedAt time.Time `gorm:"column:createdAt;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// 唯一索引
	User *User `gorm:"foreignKey:UserID;references:UserID" json:"-"`
}

// TableName 指定表名
func (UserAccount) TableName() string {
	return "user_accounts"
}

// Session 会话表
type Session struct {
	ID         string       `gorm:"primaryKey;column:id;type:varchar(36)" json:"id"`
	UserID     string       `gorm:"index;column:userId;type:varchar(36);not null" json:"userId"`
	Token      string       `gorm:"uniqueIndex;column:token;type:varchar(500);not null" json:"token"`
	DeviceInfo *string      `gorm:"column:deviceInfo;type:json" json:"deviceInfo,omitempty"`
	ExpiresAt  *time.Time   `gorm:"column:expiresAt;type:timestamp" json:"expiresAt"`
	CreatedAt  time.Time    `gorm:"column:createdAt;default:CURRENT_TIMESTAMP" json:"createdAt"`

	User *User `gorm:"foreignKey:UserID;references:UserID" json:"-"`
}

// TableName 指定表名
func (Session) TableName() string {
	return "sessions"
}

// BeforeCreate GORM hook
func (s *Session) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = generateUUID()
	}
	return nil
}

// BeforeCreate GORM hook
func (u *UserAccount) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = generateUUID()
	}
	return nil
}

// generateUUID 生成 UUID
func generateUUID() string {
	return "uuid-" + time.Now().Format("20060102150405")
}
