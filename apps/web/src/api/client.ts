import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('runway_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Don't intercept refresh or login/register requests themselves
    if (
      err.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh' ||
      originalRequest.url === '/auth/login' ||
      originalRequest.url === '/auth/register'
    ) {
      if (err.response?.status === 401 && (originalRequest.url === '/auth/refresh' || originalRequest._retry)) {
        // Refresh failed or retry failed — clear auth (React router handles redirect)
        localStorage.removeItem('runway_token');
        localStorage.removeItem('runway_refresh_token');
        localStorage.removeItem('runway_user');
      }
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem('runway_refresh_token');
    if (!refreshToken) {
      localStorage.removeItem('runway_token');
      localStorage.removeItem('runway_user');
      return Promise.reject(err);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      localStorage.setItem('runway_token', data.token);
      processQueue(null, data.token);
      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      localStorage.removeItem('runway_token');
      localStorage.removeItem('runway_refresh_token');
      localStorage.removeItem('runway_user');
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
