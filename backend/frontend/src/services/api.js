import axios from 'axios';

// Usa la variable de entorno VITE_API_URL definida en Vercel; si no existe, usa localhost para desarrollo.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/';

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Interceptor para adjuntar el header Authorization
api.interceptors.request.use(config => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    // Si recibimos un 401 y no se ha reintentado
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error("No hay refresh token");

        const { data } = await axios.post(`${baseURL}auth/refresh/`, {
          refresh: refreshToken
        });
        // Guardamos el nuevo access token
        localStorage.setItem('accessToken', data.access);
        // Reintentamos la request original con el nuevo token
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return axios(originalRequest);
      } catch (e) {
        // Si falla, hacemos logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
