import api from './api';

export const login = async (telefono, password) => {
  try {
    const response = await api.post('auth/login/', { telefono, password });
    // Se espera que el backend retorne { user, access, refresh }
    const { user, access, refresh } = response.data;
    // Guardar en localStorage
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || {};
    throw {
      telefono: errorData.telefono?.[0] || '',
      password: errorData.password?.[0] || '',
      nonField: errorData.non_field_errors?.[0] || 'Error de conexión'
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
  // Ajusta la ruta según tu backend
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
  // POST /citas/ con citaData => {doctor, especialidad, fecha_hora, ...}
  const response = await api.post('citas/', citaData);
  return response.data;
};
