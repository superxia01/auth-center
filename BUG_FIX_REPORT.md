# Bug 修复报告 - 2026-02-06

## 📋 问题总结

### 问题1：PR-business PC扫码登录失败
- **现象**：PC扫码时，auth-center 回调 `/login?code=xxx&state=xxx`，但前端只处理 token，导致登录失败
- **根本原因**：
  1. auth-center 可能未部署最新代码（仍在返回 code + type）
  2. 前端需要兼容过渡期

### 问题2：superpixel 用户重复创建
- **现象**：并发登录时，可能创建多个相同用户
- **根本原因**：`getOrCreateUserByAuthCenterID` 方法存在并发竞态条件

---

## ✅ 修复内容

### 修复1：PR-business 前端兼容 code + token

**文件**：`/Users/xia/Documents/GitHub/pr-business/frontend/src/pages/Login.tsx`

**修改内容**：
- ✅ 优先处理 token 参数（V3.1 模式）
- ✅ 兼容处理 code + state 参数（旧模式）
- ✅ 代码示例：

```typescript
// ✅ V3.1 统一 Token 模式（优先）
if (token) {
  // 调用 /api/v1/user/me 获取用户信息
  return
}

// ✅ 兼容旧模式：code + state
if (code) {
  // 调用 /api/v1/auth/wechat 用 code 换 token
  return
}
```

**好处**：
- ✅ 无论 auth-center 返回 token 还是 code，都能正常登录
- ✅ 平滑过渡到 V3.1

---

### 修复2：superpixel 前端兼容 code + token

**文件**：`/Users/xia/Documents/GitHub/superpixel/frontend/src/pages/AuthCallbackPage.tsx`

**修改内容**：
- ✅ 优先处理 token 参数（V3.1 模式）
- ✅ 兼容处理 code + state 参数（旧模式）
- ✅ 统一的错误处理和用户体验

---

### 修复3：superpixel 用户创建并发安全

**文件**：`/Users/xia/Documents/GitHub/superpixel/backend/internal/service/auth_center_service.go`

**修改内容**：
- ✅ `getOrCreateUserByAuthCenterID` 方法添加重试机制
- ✅ 检测唯一索引冲突（duplicate key error）
- ✅ 冲突时重新查询用户（可能已被其他请求创建）
- ✅ 最多重试3次

**代码示例**：

```go
// 并发安全：重试机制
maxRetries := 3
for i := 0; i < maxRetries; i++ {
    err := s.userRepo.Create(ctx, newUser)
    if err == nil {
        return newUser, nil // 创建成功
    }

    // 检查是否是唯一索引冲突
    if strings.Contains(err.Error(), "duplicate") {
        // 重新查询用户（可能已被其他请求创建）
        user, err := s.userRepo.GetByAuthCenterUserID(ctx, authCenterUserID)
        if err == nil {
            return user, nil // 返回已存在的用户
        }
        time.Sleep(time.Millisecond * 10) // 短暂等待
        continue // 重试
    }

    return nil, err // 其他错误
}
```

**好处**：
- ✅ 避免并发时重复创建用户
- ✅ 自动处理唯一索引冲突
- ✅ 提高系统健壮性

---

## 📊 修改文件统计

| 业务系统 | 文件 | 修改内容 |
|---------|------|---------|
| **pr-business** | frontend/src/pages/Login.tsx | 前端兼容 code + token |
| **superpixel** | frontend/src/pages/AuthCallbackPage.tsx | 前端兼容 code + token |
| **superpixel** | backend/internal/service/auth_center_service.go | 用户创建并发安全 |
| **总计** | 3 个文件 | - |

---

## 🎯 给团队的建议

### 1. 立即部署 auth-center V3.1

**重要**：前端兼容只是临时方案，**必须尽快部署 auth-center 最新代码**！

**如何验证 auth-center 版本**：
1. 发起微信登录
2. 查看回调 URL：
   - 旧版本：`/login?code=xxx&state=xxx`
   - 新版本：`/login?token=eyJhbGci...`

**部署 auth-center**：
```bash
# 上海服务器
ssh shanghai-tencent

cd /var/www/auth-center-backend
git pull origin main
go build -o bin/server cmd/server/main.go
sudo systemctl restart auth-center-backend
sudo systemctl status auth-center-backend
```

### 2. 测试验证

**测试步骤**：
1. PC 浏览器扫码登录
2. 微信内登录
3. 并发登录测试（打开多个浏览器窗口同时登录）

**预期结果**：
- ✅ PC 扫码：回调 token（新代码）或 code（旧代码，兼容）
- ✅ 微信内：回调 token
- ✅ 并发登录：不会创建重复用户

### 3. 监控日志

**查看并发冲突日志**：
```bash
# superpixel 后端日志
ssh shanghai-tencent
sudo journalctl -u superpixel-backend -f | grep "并发冲突"
```

**预期输出**：
```
[getOrCreateUserByAuthCenterID] 并发冲突，用户已被创建，返回现有用户
```

### 4. 移除兼容代码

**当所有业务系统都部署 auth-center V3.1 后**，可以移除前端兼容代码：

```typescript
// ❌ 删除这个兼容逻辑
if (code) {
  // 旧模式处理
}

// ✅ 只保留这个
if (token) {
  // V3.1 统一 Token 模式
}
```

---

## 🔍 技术细节

### 并发问题分析

**问题场景**：
```
时间线：
T1: 请求A 查询用户 → 不存在
T2: 请求B 查询用户 → 不存在
T3: 请求A 创建用户 → 成功
T4: 请求B 创建用户 → ❌ 唯一索引冲突
```

**解决方案**：
- 检测唯一索引冲突
- 重新查询用户（可能已被创建）
- 最多重试3次

**为什么不用 GORM FirstOrCreate**：
- `FirstOrCreate` 也会遇到并发问题
- 需要手动处理冲突，提高成功率

---

## 📞 技术支持

**问题反馈**：
- 发现问题请及时反馈
- 提供详细的错误日志和复现步骤

**联系方式**：
- 技术支持：support@crazyaigc.com
- 文档：https://docs.crazyaigc.com/auth-center

---

**修复完成时间**：2026-02-06
**修复人员**：Claude Code
**版本**：V3.1 并发安全修复
