package repository

import (
	"fmt"
	"log"
	"time"

	"github.com/keenchase/auth-center/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB 初始化数据库连接
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	// 配置 GORM
	newLogger := logger.New(
		log.New(log.Writer(), "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second, // 慢查询阈值
			LogLevel:                  logger.Info, // 日志级别
			IgnoreRecordNotFoundError: true,        // 忽略记录未找到错误
			Colorful:                  false,        // 禁用彩色打印
		},
	)

	// 连接数据库
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("数据库连接失败: %w", err)
	}

	// 数据库已存在，禁用 AutoMigrate
	// 生产环境中应该使用数据库迁移工具（如 golang-migrate）而不是 AutoMigrate
	log.Println("数据库连接成功")
	return db, nil
}
