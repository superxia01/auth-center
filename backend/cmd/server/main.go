package main

import (
	"log"
	"os"

	"github.com/keenchase/auth-center/internal/config"
	"github.com/keenchase/auth-center/internal/handler"
	"github.com/keenchase/auth-center/internal/middleware"
	"github.com/keenchase/auth-center/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("警告: 无法加载 .env 文件: %v", err)
	}

	// 初始化配置
	cfg := config.Load()

	// 初始化数据库
	db, err := repository.InitDB(cfg)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	// 设置 Gin 模式
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建路由
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"service": "auth-center",
		})
	})

	// API 路由组
	api := r.Group("/api")
	{
		// 认证相关
		auth := api.Group("/auth")
		{
			auth.POST("/wechat/login", handler.WeChatLogin(db))
			auth.GET("/wechat/callback", handler.WeChatCallback(db))
			auth.POST("/wechat/open-platform-callback", handler.OpenPlatformCallback(db))
			auth.POST("/verify-token", handler.VerifyToken(db))
			auth.GET("/user-info", middleware.Auth(db), handler.GetUserInfo(db))
			auth.POST("/password/login", handler.PasswordLogin(db))
			auth.POST("/signout", handler.SignOut(db))
		}

		// 管理员功能
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(db))
		admin.Use(middleware.RequireRole(db, "SUPER_ADMIN"))
		{
			admin.GET("/users", handler.GetUsers(db))
			admin.POST("/set-phone-password", handler.SetPhonePassword(db))
			admin.POST("/verify", handler.VerifyAdmin(db))
		}
	}

	// 启动服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("服务器启动在端口 %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
