-- 登录流水表：记录用户何时登录过哪些业务系统
-- Date: 2026-02-11

CREATE TABLE IF NOT EXISTS user_login_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  source_host VARCHAR(255) NOT NULL,
  login_method VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX user_login_log_user_id_idx ON user_login_log(user_id);
CREATE INDEX user_login_log_created_at_idx ON user_login_log(created_at);
