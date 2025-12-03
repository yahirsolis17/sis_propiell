// src/services/api.js
import axios from 'axios';

// Usa la URL del backend desde env (producción) y localhost como fallback
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';
console.log('baseURL:', baseURL);

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Interceptor para adjuntar el header Authorization en TODAS las peticiones
api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

// Interceptor de respuesta para refrescar el access token cuando expira
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es 401 y no hemos reintentado esta request todavía
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No hay refresh token');
        }

        // Usamos axios "crudo" para NO disparar de nuevo este mismo interceptor
        const refreshUrl = `${baseURL}auth/refresh/`;
        const { data } = await axios.post(refreshUrl, {
          refresh: refreshToken,
        });
        // Backend (TokenRefreshView) devuelve: { access: "nuevo-token" }

        // Guardar el nuevo access
        localStorage.setItem('accessToken', data.access);

        // Reintentar la petición original con el nuevo token
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return axios(originalRequest);
      } catch (e) {
        // Si falla el refresh, limpiamos todo y mandamos al login
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
