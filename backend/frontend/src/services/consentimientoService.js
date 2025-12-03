// src/services/consentimientoService.js
import api from "./api";

/**
 * Obtener el consentimiento asociado a una cita.
 *
 * Endpoint: GET citas/<id>/consentimiento/
 */
export const getConsentimiento = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para obtener el consentimiento.");
  }

  const response = await api.get(`citas/${citaId}/consentimiento/`, {
    signal,
  });

  return response.data;
};

/**
 * 🔁 Alias: muchos componentes usan getConsentimientoByCitaId(citaId, signal)
 */
export const getConsentimientoByCitaId = async (citaId, signal) => {
  return getConsentimiento(citaId, signal);
};

/**
 * Guardar/actualizar consentimiento como PACIENTE (firma).
 *
 * Endpoint: POST citas/<id>/consentimiento/
 */
export const guardarConsentimientoPaciente = async ({ citaId, firmaFile }) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para guardar el consentimiento.");
  }

  const formData = new FormData();

  if (firmaFile) {
    formData.append("firma_paciente", firmaFile);
  }

  const response = await api.post(
    `citas/${citaId}/consentimiento/`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

/**
 * 🔁 Alias para compatibilidad:
 * guardarConsentimientoFirma(payload) → guardarConsentimientoPaciente(payload)
 */
export const guardarConsentimientoFirma = async (payload) => {
  return guardarConsentimientoPaciente(payload);
};

/**
 * Guardar/actualizar consentimiento como DOCTOR/ADMIN (campos médicos).
 *
 * Endpoint: POST citas/<id>/consentimiento/
 */
export const guardarConsentimientoMedico = async ({ citaId, data }) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para actualizar el consentimiento.");
  }

  const response = await api.post(`citas/${citaId}/consentimiento/`, data);
  return response.data;
};

/**
 * 🔁 Alias: guardarConsentimientoDatosMedico(citaId, payload)
 */
export const guardarConsentimientoDatosMedico = async (citaId, data) => {
  return guardarConsentimientoMedico({ citaId, data });
};

/**
 * Descargar el consentimiento en PDF (blob).
 *
 * Endpoint: GET citas/<id>/consentimiento/descargar/
 */
export const descargarConsentimientoPdf = async (citaId, signal) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para descargar el PDF.");
  }

  const response = await api.get(
    `citas/${citaId}/consentimiento/descargar/`,
    {
      responseType: "blob",
      signal,
    }
  );

  return response.data; // blob
};

/**
 * Alias genérico: descargarConsentimiento(citaId, signal)
 */
export const descargarConsentimiento = async (citaId, signal) => {
  return descargarConsentimientoPdf(citaId, signal);
};

/**
 * Alias específico para DoctorConsentimientoViewer:
 * descargarConsentimientoPDF(citaId) sin signal.
 */
export const descargarConsentimientoPDF = async (citaId) => {
  return descargarConsentimientoPdf(citaId);
};
