// src/services/adminUsersService.js
import api from "./api";

/**
 * Listar usuarios administrables (pacientes + especialistas).
 *
 * Backend esperado:
 *  - ViewSet DRF registrado como "admin-users"
 *  - Rutas típicas:
 *      GET    admin-users/           → lista
 *      POST   admin-users/           → crear
 *      GET    admin-users/:id/       → detalle
 *      PATCH  admin-users/:id/       → actualizar parcial
 *      DELETE admin-users/:id/       → eliminar (si lo permites)
 *
 * IMPORTANTE:
 * Si descubres que tu endpoint real es /api/api/admin-users/,
 * cambia BASE_PATH a "api/admin-users/".
 */

const BASE_PATH = "admin-users/";

/**
 * Obtener lista de usuarios (con filtros opcionales).
 *
 * @param {Object} params - filtros opcionales (role, search, etc. si el backend los soporta)
 * @param {AbortSignal} signal - para cancelar la petición (opcional)
 * @returns {Promise<Array>}
 */
export const getAdminUsers = async (params = {}, signal) => {
  const response = await api.get(BASE_PATH, {
    params,
    signal,
  });
  return response.data;
};

/**
 * Obtener detalle de un usuario por ID.
 *
 * @param {number|string} userId
 * @param {AbortSignal} signal
 * @returns {Promise<Object>}
 */
export const getAdminUserById = async (userId, signal) => {
  if (!userId) {
    throw new Error("ID de usuario es obligatorio");
  }

  const response = await api.get(`${BASE_PATH}${userId}/`, {
    signal,
  });
  return response.data;
};

/**
 * Crear un nuevo usuario (paciente o especialista).
 *
 * El payload debe alinearse con AdminUserSerializer:
 *  - nombre, apellidos, telefono, role
 *  - opcionales: edad, sexo, peso
 *  - password (obligatorio al crear)
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const createAdminUser = async (data) => {
  const response = await api.post(BASE_PATH, data);
  return response.data;
};

/**
 * Actualizar usuario (parcialmente).
 *
 * Se usa PATCH para no tener que mandar todos los campos siempre.
 * Sirve tanto para editar datos generales como para toggle de is_active.
 *
 * @param {number|string} userId
 * @param {Object} data - campos a actualizar
 * @returns {Promise<Object>}
 */
export const updateAdminUser = async (userId, data) => {
  if (!userId) {
    throw new Error("ID de usuario es obligatorio para actualizar");
  }

  const response = await api.patch(`${BASE_PATH}${userId}/`, data);
  return response.data;
};

/**
 * Eliminar usuario (si tu backend lo permite).
 * Ojo: en muchos sistemas clínicos NO se usa delete duro, solo desactivar.
 *
 * @param {number|string} userId
 * @returns {Promise<void>}
 */
export const deleteAdminUser = async (userId) => {
  if (!userId) {
    throw new Error("ID de usuario es obligatorio para eliminar");
  }

  await api.delete(`${BASE_PATH}${userId}/`);
};
