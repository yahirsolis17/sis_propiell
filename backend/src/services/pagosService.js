// src/services/pagosService.js
import api from "./api";

/**
 * Crear pago por TRANSFERENCIA (uso PACIENTE).
 *
 * Endpoint: POST pagos/create/
 * Backend:
 *  - valida que la cita pertenezca al paciente
 *  - solo permite un pago de transferencia por cita (PENDIENTE/APROBADO, no revertido)
 *  - usa 'total' (no 'monto') para calcular el importe
 *  - fija internamente metodo_pago = "TRANSFERENCIA" y estado_pago = "PENDIENTE"
 *
 * Params:
 *  - citaId          (obligatorio)
 *  - total           (opcional, recomendado)
 *  - monto           (opcional, legacy; se mapea a total si no viene total)
 *  - comprobanteFile (obligatorio para este flujo)
 */
export const crearPagoTransferencia = async ({
  citaId,
  monto,
  total,
  comprobanteFile,
}) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para crear el pago.");
  }

  const formData = new FormData();
  formData.append("cita", citaId);

  // Backend espera 'total'; si no se envía, usará 900.00 por defecto.
  const effectiveTotal = total ?? monto;
  if (effectiveTotal != null) {
    formData.append("total", effectiveTotal);
  }

  if (comprobanteFile) {
    formData.append("comprobante", comprobanteFile);
  }

  const response = await api.post("pagos/create/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

/**
 * Alias genérico para compatibilidad con código existente.
 *
 * Uso típico:
 *  crearPago({ citaId, comprobanteFile })
 */
export const crearPago = async (payload) => {
  return crearPagoTransferencia(payload);
};

/**
 * Crear pago en CONSULTORIO (uso DOCTOR/ADMIN).
 *
 * Endpoint: POST pagos/consultorio/
 *
 * Params:
 *  - citaId (obligatorio)
 *  - total  (opcional, recomendado)
 *  - monto  (opcional, legacy; se mapea a total si no viene total)
 */
export const crearPagoConsultorio = async ({ citaId, monto, total }) => {
  if (!citaId) {
    throw new Error("ID de cita requerido para crear el pago en consultorio.");
  }

  const effectiveTotal = total ?? monto;

  const data = {
    cita: citaId,
  };

  if (effectiveTotal != null) {
    data.total = effectiveTotal;
  }

  const response = await api.post("pagos/consultorio/", data);
  return response.data;
};

/**
 * Listar pagos según rol:
 *  - PACIENTE: sus pagos
 *  - DOCTOR: pagos ligados a sus citas
 *  - ADMIN: todos
 *
 * Filtros opcionales (query params):
 *  - paciente
 *  - metodo_pago
 *  - estado_pago
 *
 * Endpoint: GET pagos/
 */
export const getPagos = async (params = {}, signal) => {
  const response = await api.get("pagos/", {
    params,
    signal,
  });

  return response.data;
};

/**
 * Helper: listar pagos por paciente.
 *
 * Endpoint: GET pagos/?paciente=<id>
 */
export const getPagosByPaciente = async (pacienteId, signal) => {
  if (!pacienteId) {
    throw new Error("ID de paciente requerido para listar pagos.");
  }

  return getPagos({ paciente: pacienteId }, signal);
};

/**
 * Revertir / rechazar un pago existente (uso DOCTOR/ADMIN).
 *
 * Endpoint: POST pagos/<id>/revertir/
 *
 * Params:
 *  - pagoId        (obligatorio)
 *  - motivoReverso (opcional) → se envía como 'motivo_reverso'
 */
export const revertirPago = async ({ pagoId, motivoReverso }) => {
  if (!pagoId) {
    throw new Error("ID de pago requerido para revertir.");
  }

  const payload = {};

  if (motivoReverso) {
    payload.motivo_reverso = motivoReverso;
  }

  const response = await api.post(`pagos/${pagoId}/revertir/`, payload);
  return response.data;
};
