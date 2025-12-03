// src/utils/clinicRules.js

/**
 * Determina si una cita requiere consentimiento informado.
 *
 * Regla:
 *  - Preferimos el flag `requiere_consentimiento` si viene en la cita o en la especialidad.
 *  - Si no viene, inferimos por el nombre de la especialidad (Dermatología).
 */
const normalizarTexto = (valor) => {
  if (!valor) return "";
  return valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

export const requiereConsentimiento = (cita) => {
  if (!cita) return false;

  // 1) Flag explícito en la cita
  if (cita.requiere_consentimiento !== undefined) {
    return Boolean(cita.requiere_consentimiento);
  }

  // 2) Flag explícito en la especialidad anidada
  const esp = cita.especialidad || {};
  if (esp.requiere_consentimiento !== undefined) {
    return Boolean(esp.requiere_consentimiento);
  }

  // 3) Inferir por nombre de especialidad (acepta varias variantes)
  const candidatos = [esp.nombre, cita.especialidad_nombre, cita.especialidad_label];

  for (const nombre of candidatos) {
    const n = normalizarTexto(nombre);
    if (!n) continue;
    if (n === "dermatologia" || n.includes("dermatolog")) {
      return true;
    }
  }

  return false;
};
