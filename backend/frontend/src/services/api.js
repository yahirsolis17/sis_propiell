import axios from 'axios';

// Lee la variable de entorno VITE_API_URL; si no existe, usa localhost para desarrollo.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/';
console.log("baseURL:", baseURL); // Para confirmar el valor

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
  console.log("Request Config:", config); // Log de la configuración de la request
  return config;
});

// Interceptor para manejar errores y refrescar token si es necesario
api.interceptors.response.use(
  response => {
    console.log("Response:", response);
    return response;
  },
  async error => {
    console.error("Response Error:", error.response);
    console.error("Request Error:", error.request);
    console.error("Error Message:", error.message);
    
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error("No hay refresh token");
        console.log("Intentando refrescar token...");
        const { data } = await axios.post(`${baseURL}auth/refresh/`, { refresh: refreshToken });
        console.log("Token refrescado:", data);
        localStorage.setItem('accessToken', data.access);
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return axios(originalRequest);
      } catch (e) {
        console.error("Error al refrescar token:", e);
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
