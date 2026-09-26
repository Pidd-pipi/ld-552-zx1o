import axios from 'axios';
import { message } from 'antd';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('talentflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.config?.skipErrorMessage) return Promise.reject(error);
    const status = error.response?.status;
    const detail = error.response?.data?.message;
    const text = Array.isArray(detail) ? detail.join('；') : detail;
    if (status === 401) {
      localStorage.removeItem('talentflow_token');
      localStorage.removeItem('talentflow_user');
      message.error('登录已过期，请重新登录');
      if (!location.pathname.endsWith('/login')) location.href = '/login';
    } else if (status === 403) {
      message.error(text || '您没有权限执行此操作');
    } else if (status === 404) {
      message.error(text || '请求的资源不存在');
    } else if (status === 422) {
      message.error(text || '表单校验错误');
    } else if (status && status >= 500) {
      message.error('服务器内部错误');
    } else if (error.request && !error.response) {
      message.error('网络异常，请稍后重试');
    } else if (text) {
      message.error(text);
    }
    return Promise.reject(error);
  },
);
