import api from './api';

// Modifica el servicio authService.js
export const login = async (telefono, password) => {
  try {
    const response = await axios.post(
      'https://sis-propiell.onrender.com/auth/login/',
      { telefono, password },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000  // Timeout de 10 segundos
      }
    );

    // Verificar respuesta del servidor
    if (!response.data.access || !response.data.user) {
      throw new Error('Respuesta del servidor inválida');
    }

    return response.data;
  } catch (error) {
    // Mejor manejo de errores
    const errorData = error.response?.data || {};
    throw {
      telefono: errorData.telefono?.[0] || '',
      password: errorData.password?.[0] || '',
      nonField: errorData.nonField?.[0] || 'Error de conexión con el servidor'
    };
  }
};

export const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

export const getAccessToken = () => localStorage.getItem("accessToken");

export const registerPatient = async (data) => {
  const response = await api.post('auth/register/', data);
  return response.data;
};

export const verifyAuth = async () => {
  try {
    const response = await api.get('auth/verify/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const createAppointment = async (citaData) => {
  const response = await api.post('citas/', citaData);
  return response.data;
};
