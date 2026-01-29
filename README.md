# 账号中心 (Auth Center)

统一的用户认证服务，支持微信登录、密码登录等多种认证方式。

## 项目架构

本项目采用前后端分离架构：

```
auth-center/
├── frontend/          # Next.js 前端
│   ├── src/
│   │   ├── app/      # 页面
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── next.config.js
├── backend/           # Go 后端
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── handler/    # HTTP 处理器
│   │   ├── service/    # 业务逻辑
│   │   ├── repository/ # 数据访问
│   │   ├── middleware/ # 中间件
│   │   ├── models/     # 数据模型
│   │   └── config/     # 配置
│   └── go.mod
├── prisma/            # 数据库模型
├── docker-compose.yml
└── README.md
```

## 技术栈

### 前端
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Axios

### 后端
- Go 1.21+
- Gin (Web 框架)
- GORM (ORM)
- PostgreSQL Driver
- JWT (认证)

### 数据库
- PostgreSQL (auth_center_db)

## 快速开始

### 1. 安装前端依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 3. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

访问 http://localhost:3000

### 4. 启动后端服务器

```bash
cd backend
go run cmd/server/main.go
```

后端服务器运行在 http://localhost:8080

## API 端点

### 认证相关

- `POST /api/auth/wechat/login` - 微信登录入口
- `GET /api/auth/wechat/callback` - 公众号回调
- `POST /api/auth/wechat/open-platform-callback` - 开放平台回调
- `POST /api/auth/verify-token` - Token 验证
- `GET /api/auth/user-info` - 获取用户信息
- `POST /api/auth/password/login` - 密码登录
- `POST /api/auth/signout` - 登出

### 管理员功能

- `GET /api/admin/users` - 用户列表
- `POST /api/admin/set-phone-password` - 设置手机号密码
- `POST /api/admin/verify` - 管理员验证

### 系统

- `GET /health` - 健康检查

## 当前进度

### ✅ 已完成

- [x] 前后端分离的项目结构
- [x] Go 后端项目初始化
- [x] 数据库模型（GORM）
- [x] 中间件（CORS, Logger, Auth）
- [x] 依赖包安装
- [x] 代码编译成功

### 🚧 进行中

- [ ] Handler 实现（微信登录、Token 管理）
- [ ] JWT Token 签发和验证逻辑
- [ ] 微信 API 集成
- [ ] 前后端联调

### 📋 待完成

- [ ] 单元测试
- [ ] 集成测试
- [ ] Docker 配置
- [ ] 生产环境部署
- [ ] CI/CD 流水线

## 许可证

MIT
