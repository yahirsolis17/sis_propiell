// src/services/pacientesService.js
import api from "./api";
import {
  getCitasByPaciente as getCitasByPacienteCore,
  reprogramarCita as reprogramarCitaCore,
} from "./citasService";

/**
 * Obtener listado de pacientes visibles para el usuario actual.
 *
 * Backend:
 *  - PACIENTE: solo él mismo
 *  - DOCTOR: solo pacientes con citas con él
 *  - ADMIN: todos
 *
 * Endpoint: GET /pacientes/
 */
export const getPacientes = async (signal) => {
  const response = await api.get("pacientes/", { signal });
  return response.data;
};

/**
 * Obtener detalle de un paciente concreto.
 *
 * Endpoint: GET /pacientes/<id>/
 */
export const getPacienteById = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido.");
  }

  const response = await api.get(`pacientes/${pacienteId}/`, { signal });
  return response.data;
};

/**
 * Obtener pagos de un paciente específico.
 *
 * Endpoint DRF: GET /pagos/?paciente=<id>
 *
 * Se usa en el dashboard del paciente para mostrar su historial
 * de pagos (transferencia + consultorio).
 */
export const getPagosByPaciente = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido.");
  }

  const response = await api.get("pagos/", {
    params: { paciente: pacienteId },
    signal,
  });

  return response.data;
};

/**
 * Listar citas asociadas a un paciente.
 *
 * GET citas/?paciente=<id>
 */
export const getCitasByPaciente = async (pacienteId, signal) => {
  // Reutilizamos la lógica y normalización de citasService (incluye requiere_consentimiento)
  return getCitasByPacienteCore(pacienteId, signal);
};

/**
 * Reprogramar cita desde el flujo del PACIENTE.
 *
 * Backend:
 *  - Endpoint: PATCH /citas/<id>/reprogramar/
 *  - Body (mismo contrato que el doctor):
 *      { fechaISO: "YYYY-MM-DD", hora: "HH:MM" }
 */
export const reprogramarCitaPaciente = async (citaId, { fechaISO, hora }, signal) =>
  reprogramarCitaCore(citaId, { fechaISO, hora }, signal);

/**
 * Cancelar cita desde el dashboard del PACIENTE.
 *
 * Backend:
 *  - Endpoint: POST /citas/<id>/cancelar/
 *  - Sin body
 */
export const cancelarCitaPaciente = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }

  const response = await api.post(
    `citas/${citaId}/cancelar/`,
    null,
    { signal }
  );
  return response.data;
};
