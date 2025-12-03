// src/services/doctorService.js
import api from "./api";

/**
 * Obtener pagos relacionados con el doctor.
 *
 * Estrategia:
 * - Si el backend ya filtra por request.user (rol doctor), no pasa nada si no mandas params.
 * - Si también soporta filtro por doctor, usamos doctorId como query param.
 *
 * @param {number|string} [doctorId]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getPagosByDoctor = async (doctorId, signal) => {
  const params = {};

  // En caso de que el backend tenga filtro por doctor,
  // esto no rompe si no existe, simplemente lo ignora.
  if (doctorId) {
    params.doctor = doctorId;
  }

  const res = await api.get("pagos/", {
    params,
    signal,
  });

  return res.data || [];
};
