#!/bin/bash
# 检查微信配置脚本

echo "🔍 检查微信配置..."
echo ""

# 检查环境变量
echo "📋 环境变量检查："
echo "WECHAT_APP_ID: ${WECHAT_APP_ID:0:10}..." # 只显示前10个字符
echo "WECHAT_APP_SECRET: ${WECHAT_APP_SECRET:0:10}..." # 只显示前10个字符
echo "WECHAT_MP_APPID: ${WECHAT_MP_APPID:0:10}..." # 只显示前10个字符
echo "WECHAT_MP_SECRET: ${WECHAT_MP_SECRET:0:10}..." # 只显示前10个字符
echo ""

# 检查是否为空
if [ -z "$WECHAT_MP_APPID" ]; then
    echo "❌ WECHAT_MP_APPID 未设置"
else
    echo "✅ WECHAT_MP_APPID 已设置"
fi

if [ -z "$WECHAT_MP_SECRET" ]; then
    echo "❌ WECHAT_MP_SECRET 未设置"
else
    echo "✅ WECHAT_MP_SECRET 已设置"
fi

echo ""
echo "💡 如果 WECHAT_MP_SECRET 未设置或错误，请："
echo "1. 登录微信公众平台 (https://mp.weixin.qq.com)"
echo "2. 进入【开发】->【基本配置】"
echo "3. 查看或重置 AppSecret"
echo "4. 更新服务器上的环境变量"
