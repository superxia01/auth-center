# 账号中心 (Auth Center)

统一的用户认证服务，支持微信登录、密码登录等多种认证方式。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 3. 生成 Prisma Client

```bash
npm run db:push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署

### Docker 部署

```bash
docker-compose up -d
```

### PM2 部署

```bash
npm run build
pm2 start ecosystem.config.js
```

## API 文档

详见 [API_README.md](./API_README.md)

## 技术栈

- Next.js 15
- Prisma
- PostgreSQL
- JWT (jose)
- 微信开放平台 & 公众号
