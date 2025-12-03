// src/services/recetasService.js
import api from "./api";

/**
 * Listar recetas.
 *
 * Filtros opcionales:
 *  - paciente
 *  - doctor
 *  - cita
 *
 * Endpoint: GET recetas/
 *
 * Ejemplos:
 *  getRecetas();
 *  getRecetas({ paciente: 10 });
 *  getRecetas({ doctor: 3, cita: 42 });
 */
export const getRecetas = async (params = {}, signal) => {
  const response = await api.get("recetas/", {
    params,
    signal,
  });

  return response.data;
};

/**
 * Helper: listar recetas por paciente.
 *
 * Endpoint: GET recetas/?paciente=<id>
 */
export const getRecetasByPaciente = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido para listar recetas.");
  }

  return getRecetas({ paciente: pacienteId }, signal);
};

/**
 * Obtener detalle de una receta.
 *
 * Endpoint: GET recetas/<id>/
 */
export const getRecetaById = async (recetaId, signal) => {
  if (!recetaId) {
    throw new Error("ID de receta requerido.");
  }

  const response = await api.get(`recetas/${recetaId}/`, { signal });
  return response.data;
};

/**
 * Crear una receta.
 *
 * Data esperada (JSON):
 *  {
 *    paciente: <id>,
 *    cita: <id> | null,
 *    indicaciones_generales: "...",
 *    notas: "...",
 *    medicamentos: [
 *      { nombre, dosis, frecuencia, duracion, via_administracion, notas }
 *    ]
 *  }
 *
 * Endpoint: POST recetas/
 */
export const crearReceta = async (data) => {
  const response = await api.post("recetas/", data);
  return response.data;
};

/**
 * Actualizar una receta existente (actualización parcial).
 *
 * Endpoint: PATCH recetas/<id>/
 */
export const actualizarReceta = async (recetaId, data) => {
  if (!recetaId) {
    throw new Error("ID de receta requerido para actualizar.");
  }

  const response = await api.patch(`recetas/${recetaId}/`, data);
  return response.data;
};

/**
 * Eliminar una receta.
 *
 * Endpoint: DELETE recetas/<id>/
 */
export const eliminarReceta = async (recetaId) => {
  if (!recetaId) {
    throw new Error("ID de receta requerido para eliminar.");
  }

  const response = await api.delete(`recetas/${recetaId}/`);
  return response.data;
};

/**
 * Helper: obtener (si existe) la receta asociada a una cita.
 *
 * - Si no hay receta => devuelve null.
 * - Si hay una o más => devuelve la primera.
 *
 * Igual que con reportes, se asume una receta por cita por negocio.
 */
export const getRecetaUnicaPorCita = async ({ citaId, signal } = {}) => {
  if (!citaId) return null;

  const data = await getRecetas({ cita: citaId }, signal);

  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
};
