import axios from 'axios';

// Asegúrate de que en el archivo .env esté: VITE_API_URL=https://sis-propiell.onrender.com/api/
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/';
console.log("baseURL:", baseURL);

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use(config => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  console.log("Request Config:", config);
  return config;
});

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
