import axios from 'axios';
import { message } from 'antd';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('talentflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 统一错误提示：优先展示后端返回的业务信息
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const detail = Array.isArray(data?.message) ? data.message.join('；') : data?.message;
      if (status === 401) {
        localStorage.removeItem('talentflow_token');
        localStorage.removeItem('talentflow_user');
        if (!location.pathname.startsWith('/login')) location.href = '/login';
      } else if (status === 403) {
        message.error(detail || '您没有权限执行此操作');
      } else if (status === 404) {
        message.error(detail || '请求的资源不存在');
      } else if (status >= 400) {
        message.error(detail || '操作失败，请稍后重试');
      }
    } else {
      message.error('网络异常，请检查连接');
    }
    return Promise.reject(error);
  },
);
