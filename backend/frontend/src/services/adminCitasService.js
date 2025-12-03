// src/services/adminCitasService.js
import api from "./api";

/**
 * Listar citas para el panel de ADMIN.
 *
 * Filtros opcionales (todos son params GET):
 *  - estado: "P" | "C" | "X"
 *  - especialidad: id de Especialidad
 *  - doctor: id de doctor
 *  - paciente: id de paciente
 *  - fecha_desde: "YYYY-MM-DD"
 *  - fecha_hasta: "YYYY-MM-DD"
 *
 * Endpoint backend: GET /citas/
 */
export const getCitasAdmin = async (params = {}, signal) => {
  const response = await api.get("citas/", {
    params,
    signal,
  });
  return response.data;
};

/**
 * Reprogramar cita.
 *
 * Endpoint backend: PATCH /citas/<id>/reprogramar/
 * Payload: { fecha_hora: "2025-12-31T10:30:00" }
 */
export const reprogramarCita = async (citaId, payload, signal) => {
  const response = await api.patch(`citas/${citaId}/reprogramar/`, payload, {
    signal,
  });
  return response.data;
};

/**
 * Confirmar / cancelar desde endpoint de procesar cita.
 *
 * Dependiendo de cómo tengas mapeado el endpoint en urls.py
 * ajusta la URL:
 *
 * - Si tu path es /citas/<id>/procesar/ → usa "citas/${id}/procesar/"
 * - Si lo mapeaste como /citas/<id>/confirmar/ → usa "citas/${id}/confirmar/"
 *
 * Aquí asumo /citas/<id>/procesar/; si te da 404, solo cambia la ruta.
 */
export const confirmarCita = async (citaId, accion = "confirmar", signal) => {
  const response = await api.post(
    `citas/${citaId}/procesar/`,
    { accion },
    { signal }
  );
  return response.data;
};

/**
 * Cancelación vía endpoint de paciente/admin:
 *
 * Endpoint backend: POST /citas/<id>/cancelar/
 *   - PACIENTE: respeta regla de 7 días
 *   - ADMIN: puede cancelar cualquier cita P/C
 */
export const cancelarCitaAdmin = async (citaId, signal) => {
  const response = await api.post(
    `citas/${citaId}/cancelar/`,
    {},
    { signal }
  );
  return response.data;
};

/**
 * Catálogo de especialidades para filtros.
 *
 * Endpoint backend: GET /especialidades/
 */
export const getEspecialidades = async (signal) => {
  const response = await api.get("especialidades/", { signal });
  return response.data;
};
