# 微信内登录失败修复指南

## 🔍 问题诊断

**错误信息**：
```json
{
  "error": "登录失败: 获取微信 Access Token 失败: 微信 API 错误: invalid appsecret",
  "success": false
}
```

**问题原因**：
- PC 登录成功 ✅ → 开放平台配置正确
- 微信内登录失败 ❌ → 公众号 `WECHAT_MP_SECRET` 配置错误

## 📋 诊断步骤

### 1. 检查服务器环境变量

登录到服务器，检查环境变量配置：

```bash
# 方式1：检查 systemd 服务配置
sudo systemctl cat auth-center-backend | grep WECHAT_MP

# 方式2：检查 .env 文件（如果使用）
cat /var/www/auth-center-backend/.env | grep WECHAT_MP

# 方式3：检查进程环境变量
sudo cat /proc/$(pgrep -f auth-center)/environ | tr '\0' '\n' | grep WECHAT_MP
```

### 2. 验证配置值

确认以下环境变量是否正确设置：

```bash
# 公众号 AppID（应该以 wx 开头）
echo $WECHAT_MP_APPID

# 公众号 AppSecret（应该是32位字符串）
echo $WECHAT_MP_SECRET
```

## 🔧 修复步骤

### 步骤 1：获取正确的公众号 AppSecret

1. **登录微信公众平台**
   - 访问：https://mp.weixin.qq.com
   - 使用管理员账号登录

2. **查看 AppSecret**
   - 进入【开发】->【基本配置】
   - 找到【AppSecret(应用密钥)】
   - 如果显示为 `******`，需要点击【重置】生成新的 AppSecret
   - ⚠️ **注意**：重置后旧的 AppSecret 会立即失效

3. **确认 AppID**
   - 在同一页面确认【AppID(应用ID)】
   - 确保与服务器配置的 `WECHAT_MP_APPID` 一致

### 步骤 2：更新服务器环境变量

#### 方式 A：使用 systemd 服务配置

```bash
# 1. 编辑服务配置文件
sudo systemctl edit --full auth-center-backend

# 2. 在 [Service] 部分添加或更新环境变量
[Service]
Environment="WECHAT_MP_APPID=wx你的公众号AppID"
Environment="WECHAT_MP_SECRET=你的公众号AppSecret"

# 3. 重新加载配置并重启服务
sudo systemctl daemon-reload
sudo systemctl restart auth-center-backend

# 4. 检查服务状态
sudo systemctl status auth-center-backend
```

#### 方式 B：使用 .env 文件

```bash
# 1. 编辑 .env 文件
sudo nano /var/www/auth-center-backend/.env

# 2. 添加或更新以下配置
WECHAT_MP_APPID=wx你的公众号AppID
WECHAT_MP_SECRET=你的公众号AppSecret

# 3. 重启服务
sudo systemctl restart auth-center-backend
```

### 步骤 3：验证修复

1. **检查日志**
   ```bash
   sudo journalctl -u auth-center-backend -f
   ```

2. **测试微信内登录**
   - 在微信内打开业务系统
   - 点击"微信登录"
   - 确认是否成功登录

## ⚠️ 常见问题

### Q1: AppSecret 显示为 `******`，无法查看

**解决方案**：
- 点击【重置】按钮生成新的 AppSecret
- 更新服务器配置后，旧的 AppSecret 会失效
- 确保在重置后立即更新服务器配置

### Q2: 配置更新后仍然报错

**检查清单**：
- ✅ 确认 AppID 和 AppSecret 匹配（来自同一个公众号）
- ✅ 确认环境变量名称正确（`WECHAT_MP_APPID` 和 `WECHAT_MP_SECRET`）
- ✅ 确认服务已重启（`sudo systemctl restart auth-center-backend`）
- ✅ 确认没有多余的空格或引号
- ✅ 检查日志确认配置已加载

### Q3: 如何确认配置已生效

在代码中添加临时日志（仅用于调试）：

```go
// backend/internal/service/wechat.go
func GetWeChatAccessToken(cfg *config.Config, code string, isMP bool) (*WeChatOAuthResponse, error) {
    var appID, appSecret string
    
    if isMP {
        appID = cfg.WeChatMPAppID
        appSecret = cfg.WeChatMPSecret
        // 临时日志（调试用）
        log.Printf("🔍 公众号配置 - AppID: %s, AppSecret长度: %d", appID, len(appSecret))
    } else {
        appID = cfg.WeChatAppID
        appSecret = cfg.WeChatAppSecret
    }
    // ...
}
```

## 📝 配置示例

### 正确的环境变量格式

```bash
# 开放平台（PC登录）
WECHAT_APP_ID=wx开放平台AppID
WECHAT_APP_SECRET=开放平台AppSecret

# 公众号（微信内登录）
WECHAT_MP_APPID=wx公众号AppID
WECHAT_MP_SECRET=公众号AppSecret
```

### 注意事项

1. **不要混淆**：
   - `WECHAT_APP_ID` / `WECHAT_APP_SECRET` → 开放平台（PC扫码）
   - `WECHAT_MP_APPID` / `WECHAT_MP_SECRET` → 公众号（微信内）

2. **AppSecret 格式**：
   - 通常是32位字符串
   - 区分大小写
   - 不要包含多余的空格或引号

3. **安全性**：
   - 不要在代码中硬编码
   - 不要提交到 Git
   - 使用环境变量或密钥管理服务

## 🔗 相关文档

- [微信公众平台文档](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html)
- [auth-center README](./README.md)
