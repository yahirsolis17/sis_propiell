// src/services/procedimientosService.js
import api from "./api";

/**
 * Listar procedimientos clínicos.
 *
 * Filtros opcionales:
 *  - paciente
 *  - doctor (solo tiene efecto real en backend para ADMIN a futuro)
 *  - cita
 *
 * Endpoint: GET procedimientos/
 *
 * Ejemplos:
 *  getProcedimientos();
 *  getProcedimientos({ cita: 10 });
 *  getProcedimientos({ paciente: 5 });
 */
export const getProcedimientos = async (params = {}, signal) => {
  const response = await api.get("procedimientos/", {
    params,
    signal,
  });

  return response.data;
};

/**
 * Listar procedimientos asociados a una cita concreta.
 *
 * Endpoint: GET procedimientos/?cita=<id>
 */
export const getProcedimientosByCita = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para listar procedimientos.");
  }

  return getProcedimientos({ cita: citaId }, signal);
};

/**
 * Listar procedimientos por paciente.
 *
 * Endpoint: GET procedimientos/?paciente=<id>
 */
export const getProcedimientosByPaciente = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido para listar procedimientos.");
  }

  return getProcedimientos({ paciente: pacienteId }, signal);
};

/**
 * Listar procedimientos por doctor.
 *
 * Nota:
 *  - Actualmente el backend filtra por doctor = request.user
 *    para roles médicos. El filtro por doctorId es útil
 *    principalmente para ADMIN cuando agreguemos ese filtro
 *    explícito en backend.
 *
 * Endpoint: GET procedimientos/?doctor=<id> (futuro)
 */
export const getProcedimientosByDoctor = async (doctorId, signal) => {
  if (!doctorId) {
    throw new Error("ID de doctor requerido para listar procedimientos.");
  }

  return getProcedimientos({ doctor: doctorId }, signal);
};

/**
 * Obtener detalle de un procedimiento.
 *
 * Endpoint: GET procedimientos/<id>/
 */
export const getProcedimientoById = async (procedimientoId, signal) => {
  if (!procedimientoId) {
    throw new Error("ID de procedimiento requerido.");
  }

  const response = await api.get(`procedimientos/${procedimientoId}/`, {
    signal,
  });

  return response.data;
};

/**
 * Crear nuevo procedimiento.
 *
 * Data típica desde el front:
 *  {
 *    cita: <id>,                 // obligatorio
 *    nombre: "...",
 *    descripcion: "...",
 *    costo: "123.45",
 *    // paciente / doctor se INFIEREN desde la cita en backend
 *  }
 *
 * Endpoint: POST procedimientos/
 */
export const crearProcedimiento = async (data) => {
  if (!data || !data.cita) {
    throw new Error(
      "Debes enviar al menos el campo 'cita' para crear un procedimiento."
    );
  }

  // El backend infiere paciente y doctor desde la cita;
  // limpiamos estos campos por seguridad si vienen en el payload.
  const payload = { ...data };
  delete payload.paciente;
  delete payload.doctor;

  const response = await api.post("procedimientos/", payload);
  return response.data;
};

/**
 * Actualizar procedimiento (PATCH parcial).
 *
 * Endpoint: PATCH procedimientos/<id>/
 */
export const actualizarProcedimiento = async (procedimientoId, data) => {
  if (!procedimientoId) {
    throw new Error("ID de procedimiento requerido para actualizar.");
  }

  const payload = { ...data };
  // Igual que en crear, no intentamos sobreescribir paciente/doctor
  delete payload.paciente;
  delete payload.doctor;

  const response = await api.patch(
    `procedimientos/${procedimientoId}/`,
    payload
  );

  return response.data;
};

/**
 * Eliminar procedimiento.
 *
 * Endpoint: DELETE procedimientos/<id>/
 */
export const eliminarProcedimiento = async (procedimientoId) => {
  if (!procedimientoId) {
    throw new Error("ID de procedimiento requerido para eliminar.");
  }

  const response = await api.delete(`procedimientos/${procedimientoId}/`);
  return response.data;
};

/**
 * Export agrupado para importar como módulo:
 *   import procedimientosService from "../services/procedimientosService";
 */
const procedimientosService = {
  getProcedimientos,
  getProcedimientosByCita,
  getProcedimientosByPaciente,
  getProcedimientosByDoctor,
  getProcedimientoById,
  crearProcedimiento,
  actualizarProcedimiento,
  eliminarProcedimiento,
};

export default procedimientosService;
