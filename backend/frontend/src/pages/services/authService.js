// src/services/authService.js
import api from './api';

export const login = async (telefono, password) => {
  try {
    // OJO: sin slash inicial -> "auth/login/"
    const response = await api.post('auth/login/', { telefono, password });

    // Backend envía => { user, access, refresh }
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
      nonField: errorData.non_field_errors?.[0] || 'Error de conexión',
    };
  }
};

export const logout = () => {
  // Si luego quieres, aquí se puede llamar también a api.post('auth/logout/')
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

export const getAccessToken = () => {
  return localStorage.getItem('accessToken');
};

export const registerPatient = async (data) => {
  // Registro de pacientes: POST /auth/register/
  const response = await api.post('auth/register/', data);
  return response.data;
};

// Verificación de sesión (usa el endpoint /auth/verify/ del backend)
export const verifyAuth = async () => {
  try {
    const response = await api.get('auth/verify/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Wrapper viejo para crear cita.
 * Idealmente debes usar crearCita de citasService.js,
 * pero lo dejamos por si algún componente aún lo llama.
 */
export const createAppointment = async (citaData) => {
  const response = await api.post('citas/', citaData);
  return response.data;
};
