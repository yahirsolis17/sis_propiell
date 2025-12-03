// src/components/clinicFormatters.js

/**
 * Helpers reutilizables para formatear etiquetas y fechas
 * en el contexto clínico (citas, reportes, pagos, etc.).
 *
 * La idea es centralizar aquí toda la lógica de "display" para
 * que las tablas (doctor/paciente/admin) sean consistentes.
 */

/**
 * Formatear fecha y hora en formato legible para MX.
 *
 * - Si la fecha es inválida → devuelve el string original.
 * - Si no hay fecha → devuelve "-".
 */
export const formatearFechaHora = (fechaStr) => {
  if (!fechaStr) return "-";

  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) {
    return fechaStr;
  }

  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

/**
 * Mapear estado de reporte clínico.
 *
 * Entrada: "BORRADOR" | "FINAL" | null
 * Salida: etiqueta amigable.
 */
export const mapEstadoReporte = (estado) => {
  if (!estado) return "Sin estado";

  const v = estado.toString().toUpperCase();
  if (v === "BORRADOR") return "Borrador";
  if (v === "FINAL") return "Final";

  // fallback por si en el futuro se agregan más estados
  return v;
};

/**
 * Mapear código de estado de cita.
 *
 * Entrada: "P" | "C" | "X"
 */
export const mapEstadoCita = (estadoCodigo) => {
  if (!estadoCodigo) return "Sin estado";

  const v = estadoCodigo.toString().toUpperCase();
  if (v === "P") return "Pendiente";
  if (v === "C") return "Confirmada";
  if (v === "X") return "Cancelada";

  return estadoCodigo;
};

/**
 * Mapear tipo de cita.
 *
 * Entrada: "I" | "S"
 */
export const mapTipoCita = (tipo) => {
  if (!tipo) return "Inicial";

  const v = tipo.toString().toUpperCase();
  if (v === "I") return "Inicial";
  if (v === "S") return "Subsecuente";

  return tipo;
};

/**
 * Mapear método de pago.
 *
 * Entrada: "TRANSFERENCIA" | "CONSULTORIO"
 */
export const mapMetodoPago = (metodo) => {
  if (!metodo) return "Sin método";

  const v = metodo.toString().toUpperCase();
  if (v === "TRANSFERENCIA") return "Transferencia / Depósito";
  if (v === "CONSULTORIO") return "Pago en consultorio";

  return metodo;
};

/**
 * Mapear estado de pago.
 *
 * Entrada: "PENDIENTE" | "APROBADO" | "RECHAZADO"
 */
export const mapEstadoPago = (estado) => {
  if (!estado) return "Sin estado";

  const v = estado.toString().toUpperCase();
  if (v === "PENDIENTE") return "Pendiente de revisión";
  if (v === "APROBADO") return "Aprobado";
  if (v === "RECHAZADO") return "Rechazado";

  return estado;
};
