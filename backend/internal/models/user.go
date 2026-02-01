package models

import (
	"time"
)

// User 用户表
type User struct {
	UserID       string         `gorm:"primaryKey;column:user_id;type:uuid;default:gen_random_uuid()" json:"userId"`
	UnionID      string         `gorm:"uniqueIndex;column:union_id;type:varchar(255)" json:"unionId"`
	PhoneNumber  *string        `gorm:"uniqueIndex;column:phone_number;type:varchar(255)" json:"phoneNumber,omitempty"`
	PasswordHash string         `gorm:"column:password_hash;type:varchar(255)" json:"-"`
	Email        *string        `gorm:"uniqueIndex;column:email;type:varchar(255)" json:"email,omitempty"`
	LastLoginAt  *time.Time     `gorm:"column:last_login_at;type:timestamp with time zone" json:"lastLoginAt,omitempty"`
	CreatedAt    time.Time      `gorm:"column:created_at;type:timestamp with time zone" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;type:timestamp with time zone" json:"updatedAt"`
	Accounts     []UserAccount  `gorm:"foreignKey:UserID;references:UserID" json:"accounts,omitempty"`
	Sessions     []Session      `gorm:"foreignKey:UserID;references:UserID" json:"sessions,omitempty"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// UserAccount 用户登录账户表
type UserAccount struct {
	ID        string    `gorm:"primaryKey;column:id;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"index;column:user_id;type:uuid;not null" json:"userId"`
	Provider  string    `gorm:"column:provider;type:varchar(50);not null" json:"provider"` // wechat
	AppID     string    `gorm:"column:app_id;type:varchar(100);not null" json:"appId"`
	OpenID    string    `gorm:"column:open_id;type:varchar(255);not null" json:"openId"`
	Type      string    `gorm:"column:type;type:varchar(20);not null" json:"type"` // web, mp, miniapp, app
	Nickname  string    `gorm:"column:nickname;type:varchar(255)" json:"nickname,omitempty"`
	AvatarURL string    `gorm:"column:avatar_url;type:text" json:"avatarUrl,omitempty"`
	CreatedAt time.Time `gorm:"column:created_at;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// 唯一索引
	User *User `gorm:"foreignKey:UserID;references:UserID" json:"-"`
}

// TableName 指定表名
func (UserAccount) TableName() string {
	return "user_accounts"
}

// Session 会话表
type Session struct {
	ID         string       `gorm:"primaryKey;column:id;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID     string       `gorm:"index;column:user_id;type:uuid;not null" json:"userId"`
	Token      string       `gorm:"uniqueIndex;column:token;type:varchar(500);not null" json:"token"`
	DeviceInfo *string      `gorm:"column:device_info;type:jsonb" json:"deviceInfo,omitempty"`
	ExpiresAt  *time.Time   `gorm:"column:expires_at;type:timestamp without time zone;not null" json:"expiresAt"`
	CreatedAt  time.Time    `gorm:"column:created_at;type:timestamp without time zone" json:"createdAt"`

	User *User `gorm:"foreignKey:UserID;references:UserID" json:"-"`
}

// TableName 指定表名
func (Session) TableName() string {
	return "sessions"
}
