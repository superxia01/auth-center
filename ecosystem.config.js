module.exports = {
  apps: [{
    name: 'auth-center',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: '/home/ubuntu/auth-center',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      AUTH_CENTER_DATABASE_URL: 'postgresql://auth_center_user:password@localhost:5432/auth_center_db?sslmode=prefer',
      WECHAT_APP_ID: 'your_app_id',
      WECHAT_APP_SECRET: 'your_app_secret',
      WECHAT_MP_APPID: 'your_mp_appid',
      WECHAT_MP_SECRET: 'your_mp_secret',
      AUTH_CENTER_SECRET: 'your-secret-key-min-32-chars',
      ADMIN_WECHAT_OPENID: 'admin_openid',
      NEXTAUTH_URL: 'https://os.crazyaigc.com',
      ALLOWED_CALLBACK_DOMAINS: 'pr.crazyaigc.com,www.crazyaigc.com,os.crazyaigc.com'
    }
  }]
};
