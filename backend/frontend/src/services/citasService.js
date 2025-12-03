// src/services/citasService.js
import api from "./api";

/**
 * Normalizador de Cita a nivel frontend.
 *
 * - Mantiene todos los campos originales (`...raw`).
 * - Garantiza que `requiere_consentimiento` llegue como boolean.
 */
const mapCita = (raw) => {
  if (!raw) return raw;

  return {
    ...raw,
    // Si el backend ya manda boolean, lo respetamos.
    // Si viene undefined/null, lo normalizamos a false.
    requiere_consentimiento:
      typeof raw.requiere_consentimiento === "boolean"
        ? raw.requiere_consentimiento
        : !!raw.requiere_consentimiento,
  };
};

/**
 * Obtener listado de especialidades disponibles.
 *
 * Endpoint: GET /especialidades/
 */
export const getEspecialidades = async (signal) => {
  const response = await api.get("especialidades/", { signal });
  return response.data;
};

/**
 * Obtener horarios disponibles para una especialidad y fecha concreta.
 *
 * fechaISO: "YYYY-MM-DD"
 * Endpoint: GET /horarios/disponibles/?especialidad=<id>&fecha=<YYYY-MM-DD>
 *
 * El backend devuelve:
 *  { horas_disponibles: ["09:00", "09:30", ...] }
 */
export const getHorariosDisponibles = async (
  especialidadId,
  fechaISO,
  signal
) => {
  const params = {
    especialidad: especialidadId,
    fecha: fechaISO,
  };

  const response = await api.get("horarios/disponibles/", {
    params,
    signal,
  });

  return response.data.horas_disponibles || [];
};

/**
 * Crear una cita (flujo PACIENTE).
 *
 * Espera:
 *  - especialidadId: number | string
 *  - fechaISO: "YYYY-MM-DD"
 *  - hora: "HH:MM"
 *  - tipo: "I" | "S" (por defecto "I")
 *  - metodoPagoPreferido (opcional): "TRANSFERENCIA" | "CONSULTORIO"
 *
 * Nota:
 *  - Se sigue usando FormData porque ya está probado y funcional.
 */
export const crearCita = async ({
  especialidadId,
  fechaISO,
  hora,
  tipo = "I",
  metodoPagoPreferido,
}) => {
  const formData = new FormData();
  formData.append("especialidad_id", especialidadId);
  formData.append("fecha_hora", `${fechaISO}T${hora}`);
  formData.append("tipo", tipo);

  if (metodoPagoPreferido) {
    formData.append("metodo_pago_preferido", metodoPagoPreferido);
  }

  try {
    const response = await api.post("citas/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    // Devuelve el objeto cita creado (incluye id) normalizado
    return mapCita(response.data);
  } catch (error) {
    console.error("Error al crear la cita (debug):", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

/**
 * Helper genérico para obtener citas con filtros combinados.
 *
 * Filtros opcionales:
 *   - pacienteId -> ?paciente=<id>
 *   - doctorId   -> ?doctor=<id>
 *   - estado     -> ?estado=<P|C|X>
 *
 * Endpoint: GET /citas/
 */
export const getCitas = async ({
  pacienteId,
  doctorId,
  estado,
  signal,
} = {}) => {
  const params = {};

  if (pacienteId) params.paciente = pacienteId;
  if (doctorId) params.doctor = doctorId;
  if (estado) params.estado = estado;

  const response = await api.get("citas/", {
    params,
    signal,
  });

  const data = response.data;

  // Si el backend devuelve lista, la mapeamos; si devuelve otra cosa, la regresamos tal cual.
  if (Array.isArray(data)) {
    return data.map(mapCita);
  }

  return data;
};

/**
 * Obtener citas del paciente (autenticado o específico).
 *
 * Endpoint: GET /citas/?paciente=<id?>
 */
export const getCitasByPaciente = async (pacienteId, signal) => {
  const params = {};

  if (pacienteId) {
    params.paciente = pacienteId;
  }

  const response = await api.get("citas/", {
    params,
    signal,
  });

  const data = response.data;
  return Array.isArray(data) ? data.map(mapCita) : data;
};

/**
 * Obtener citas del doctor.
 *
 * Puedes pasar:
 *  - doctorId (para ADMIN, por ejemplo)
 *  - estado: "P" | "C" | "X"
 *
 * Endpoint: GET /citas/?doctor=<id>&estado=<P|C|X>
 */
export const getCitasByDoctor = async (doctorId, { estado, signal } = {}) => {
  const params = {};

  if (doctorId) {
    params.doctor = doctorId;
  }
  if (estado) {
    params.estado = estado;
  }

  const response = await api.get("citas/", {
    params,
    signal,
  });

  const data = response.data;
  return Array.isArray(data) ? data.map(mapCita) : data;
};

/**
 * Obtener detalle de una cita concreta.
 *
 * Endpoint: GET /citas/<id>/
 */
export const getCitaById = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }

  const response = await api.get(`citas/${citaId}/`, { signal });
  return mapCita(response.data);
};

/**
 * Confirmar o cancelar una cita (uso DOCTOR).
 *
 * accion: "confirmar" | "cancelar"
 * Endpoint: POST /citas/<id>/confirmar/
 *
 * El backend responde con:
 *  {
 *    status: "...",
 *    estado: "C" | "X",
 *    pago_asociado: boolean
 *  }
 */
export const confirmarCita = async (citaId, accion, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }
  if (!accion) {
    throw new Error('La acción es requerida: "confirmar" o "cancelar".');
  }

  const response = await api.post(
    `citas/${citaId}/confirmar/`,
    { accion },
    { signal }
  );

  return response.data;
};

/**
 * Crear cita subsecuente automática (uso PACIENTE con tratamiento activo).
 *
 * Endpoint: POST /citas/subsecuente/
 */
export const crearCitaSubsecuente = async (signal) => {
  const response = await api.post("citas/subsecuente/", null, { signal });
  return response.data;
};

/**
 * Programar cita subsecuente en una fecha/hora concreta (uso DOCTOR/ADMIN).
 *
 * Endpoint: POST /citas/<id>/programar_subsecuente/
 *
 * Parámetros:
 *  - citaId: ID de la cita base.
 *  - fechaISO: "YYYY-MM-DD"
 *  - hora: "HH:MM"
 *  - frecuenciaDias (opcional): para inicializar/actualizar tratamiento.
 */
export const programarSubsecuenteDesdeCita = async (
  citaId,
  { fechaISO, hora, frecuenciaDias, signal } = {}
) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }
  if (!fechaISO || !hora) {
    throw new Error(
      "fechaISO y hora son requeridos para programar la cita subsecuente."
    );
  }

  const payload = {
    fecha_hora: `${fechaISO}T${hora}`,
  };

  if (typeof frecuenciaDias === "number") {
    payload.frecuencia_dias = frecuenciaDias;
  }

  const response = await api.post(
    `citas/${citaId}/programar_subsecuente/`,
    payload,
    { signal }
  );

  // El backend devuelve la cita subsecuente creada -> la normalizamos
 return mapCita(response.data);
};

/**
 * Reprogramar una cita existente (PACIENTE/DOCTOR/ADMIN).
 *
 * Endpoint: PATCH /citas/<id>/reprogramar/
 */
export const reprogramarCita = async (
  citaId,
  { fechaISO, hora, signal } = {}
) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }
  if (!fechaISO || !hora) {
    throw new Error(
      "fechaISO y hora son requeridos para reprogramar la cita."
    );
  }

  const payload = {
    fecha_hora: `${fechaISO}T${hora}`,
  };

  const response = await api.patch(`citas/${citaId}/reprogramar/`, payload, {
    signal,
  });

  // El backend devuelve la cita actualizada -> la normalizamos
  return mapCita(response.data);
};

/**
 * Alias para el flujo de PACIENTE.
 * Reutiliza la misma lógica y endpoint que el doctor (envía fecha_hora).
 */
export const reprogramarCitaPaciente = (citaId, { fechaISO, hora }, signal) =>
  reprogramarCita(citaId, { fechaISO, hora, signal });

/**
 * Cancelar cita por el PACIENTE.
 *
 * Endpoint: POST /citas/<id>/cancelar-paciente/
 */
export const cancelarCitaPaciente = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido.");
  }

  const response = await api.post(`citas/${citaId}/cancelar-paciente/`, null, {
    signal,
  });

  return response.data;
};

/**
 * Export default para import agrupado:
 *   import citasService from "../services/citasService";
 */
const citasService = {
  getEspecialidades,
  getHorariosDisponibles,
  crearCita,
  getCitas,
  getCitasByPaciente,
  getCitasByDoctor,
  getCitaById,
  confirmarCita,
  crearCitaSubsecuente,
  programarSubsecuenteDesdeCita,
  reprogramarCita,
  reprogramarCitaPaciente,
  cancelarCitaPaciente,
};

export default citasService;
