// src/services/tratamientoService.js
import api from "./api";

/**
 * Obtener el tratamiento asociado al paciente autenticado.
 *
 * Endpoint: GET tratamiento/
 *
 * Backend:
 *  - Usa request.user para resolver el tratamiento.
 *  - Si no existe tratamiento, normalmente responderá 404.
 */
export const getTratamientoActual = async (signal) => {
  const response = await api.get("tratamiento/", { signal });
  return response.data;
};

/**
 * Actualizar el tratamiento actual del paciente autenticado.
 *
 * Endpoint: PATCH tratamiento/
 *
 * Ejemplos de data:
 *  {
 *    frecuencia_dias: 30,
 *    notas: "Ajuste de frecuencia",
 *  }
 */
export const actualizarTratamiento = async (data) => {
  const response = await api.patch("tratamiento/", data);
  return response.data;
};

/**
 * Finalizar un tratamiento por ID.
 *
 * Endpoint: POST tratamientos/<pk>/finalizar/
 *
 * Params:
 *  - tratamientoId (obligatorio)
 *  - motivo        (opcional, string)
 *
 * El backend:
 *  - Valida que el usuario sea el doctor responsable o ADMIN.
 *  - Marca activo = false e invoca Tratamiento.finalizar(...)
 */
export const finalizarTratamientoPorId = async ({
  tratamientoId,
  motivo,
} = {}) => {
  if (!tratamientoId) {
    throw new Error("ID de tratamiento requerido para finalizar.");
  }

  const payload = {};

  if (motivo) {
    payload.motivo = motivo;
  }

  const response = await api.post(
    `tratamientos/${tratamientoId}/finalizar/`,
    payload
  );

  return response.data;
};

/**
 * Helper: finalizar el tratamiento "actual" del paciente autenticado.
 *
 * Flujo:
 *  1) GET tratamiento/  → obtiene el tratamiento asociado al paciente.
 *  2) POST tratamientos/<id>/finalizar/ con el motivo (si se envía).
 *
 * Útil para vistas de paciente que solo conocen "mi tratamiento",
 * sin manejar IDs explícitos.
 */
export const finalizarTratamientoActual = async ({ motivo, signal } = {}) => {
  const tratamiento = await getTratamientoActual(signal);

  if (!tratamiento || !tratamiento.id) {
    throw new Error(
      "No se encontró tratamiento asociado al paciente para finalizar."
    );
  }

  return finalizarTratamientoPorId({
    tratamientoId: tratamiento.id,
    motivo,
  });
};

/**
 * Alias de conveniencia:
 *  finalizarTratamiento(...) → finalizarTratamientoActual(...)
 *
 * Esto permite reusar posibles llamadas antiguas sin romperlas.
 */
export const finalizarTratamiento = finalizarTratamientoActual;

/**
 * Export agrupado:
 *   import tratamientoService from "../services/tratamientoService";
 */
const tratamientoService = {
  getTratamientoActual,
  actualizarTratamiento,
  finalizarTratamientoPorId,
  finalizarTratamientoActual,
  finalizarTratamiento,
};

export default tratamientoService;
