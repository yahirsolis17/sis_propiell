// src/services/citasService.js
import api from "./api";

/** ============================
 *  Citas del paciente
 *  ============================ */
export const getCitasByPaciente = (pacienteId, signal) =>
  api.get(`citas/?paciente=${pacienteId}`, { signal }).then((res) => res.data);

/** Pagos del paciente */
export const getPagosByPaciente = (pacienteId, signal) =>
  api.get(`pagos/?paciente=${pacienteId}`, { signal }).then((res) => res.data);

/** Crear cita inicial (JSON normal, sin FormData) */
export const createCita = (payload) =>
  api.post("citas/", payload).then((res) => res.data);

/** Subir comprobante de pago (multipart) */
export const uploadPagoComprobante = (formData) =>
  api
    .post("pagos/create/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);

/** Obtener una cita por id (usa el detail view /citas/<id>/) */
export const getCitaById = (citaId, signal) =>
  api.get(`citas/${citaId}/`, { signal }).then((res) => res.data);

/** Guardar / actualizar consentimiento (firma, testigos, etc.) */
export const saveConsentimiento = (citaId, formData) =>
  api
    .post(`citas/${citaId}/consentimiento/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
