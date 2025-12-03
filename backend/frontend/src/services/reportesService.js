// src/services/reportesService.js
import api from "./api";

/**
 * Listar reportes clínicos (ReportePaciente).
 *
 * Filtros opcionales:
 *  - paciente
 *  - doctor
 *  - cita
 *  - estado (BORRADOR / FINAL)
 *
 * Endpoint: GET reportes/
 *
 * Ejemplos:
 *  getReportes(); // todos (según permisos)
 *  getReportes({ paciente: 12 });
 *  getReportes({ doctor: 5, estado: "FINAL" });
 */
export const getReportes = async (params = {}, signal) => {
  const response = await api.get("reportes/", {
    params,
    signal,
  });

  return response.data;
};

/**
 * Helper: listar reportes por paciente.
 *
 * Endpoint: GET reportes/?paciente=<id>
 */
export const getReportesByPaciente = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido para listar reportes.");
  }

  return getReportes({ paciente: pacienteId }, signal);
};

/**
 * Obtener detalle de un reporte.
 *
 * Endpoint: GET reportes/<id>/
 */
export const getReporteById = async (reporteId, signal) => {
  if (!reporteId) {
    throw new Error("ID de reporte requerido.");
  }

  const response = await api.get(`reportes/${reporteId}/`, { signal });
  return response.data;
};

/**
 * Crear reporte clínico (consulta).
 *
 * Data típica:
 *  {
 *    paciente: <id>,
 *    cita: <id> | null,
 *    resumen: "...",
 *    diagnostico: "...",
 *    recomendaciones: "...",
 *    estado: "BORRADOR" | "FINAL"
 *  }
 *
 * Endpoint: POST reportes/
 */
export const crearReporte = async (data) => {
  const response = await api.post("reportes/", data);
  return response.data;
};

/**
 * Actualizar reporte clínico (actualización parcial).
 *
 * Endpoint: PATCH reportes/<id>/
 */
export const actualizarReporte = async (reporteId, data) => {
  if (!reporteId) {
    throw new Error("ID de reporte requerido para actualizar.");
  }

  const response = await api.patch(`reportes/${reporteId}/`, data);
  return response.data;
};

/**
 * Eliminar reporte clínico.
 *
 * Endpoint: DELETE reportes/<id>/
 *
 * Nota: DRF normalmente responde 204 sin cuerpo.
 */
export const eliminarReporte = async (reporteId) => {
  if (!reporteId) {
    throw new Error("ID de reporte requerido para eliminar.");
  }

  const response = await api.delete(`reportes/${reporteId}/`);
  return response.data;
};

/**
 * Helper específico: obtener (si existe) el reporte único asociado a una cita.
 *
 * - Si no hay reporte => devuelve null.
 * - Si hay uno o más => devuelve el primero.
 *
 * Esto asume que el backend garantiza que solo haya un reporte por cita.
 */
export const getReporteUnicoPorCita = async ({ citaId, signal } = {}) => {
  if (!citaId) return null;

  const data = await getReportes({ cita: citaId }, signal);

  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
};

/**
 * Export agrupado:
 *   import reportesService from "../services/reportesService";
 */
const reportesService = {
  getReportes,
  getReportesByPaciente,
  getReporteById,
  crearReporte,
  actualizarReporte,
  eliminarReporte,
  getReporteUnicoPorCita,
};

export default reportesService;
