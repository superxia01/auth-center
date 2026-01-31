// 基础类型定义
export interface User {
  userId: string;
  unionId: string;
  email?: string;
  phone?: string;
}

export interface LoginRequest {
  code: string;
  type: 'mp' | 'open';
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  userId?: string;
  error?: string;
}
