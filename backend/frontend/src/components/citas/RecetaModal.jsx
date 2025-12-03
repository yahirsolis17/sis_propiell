// frontend/src/components/recetas/RecetaModal.jsx
import React, { useEffect, useState } from "react";
import { crearReceta, actualizarReceta } from "../../services/recetasService";

// 👉 Usamos el formateador centralizado
import { formatearFechaHora } from "../../components/clinicFormatters";

const defaultMed = () => ({
  nombre: "",
  dosis: "",
  frecuencia: "",
  duracion: "",
  via_administracion: "",
  notas: "",
});

const RecetaModal = ({
  show,
  onClose,
  paciente,
  cita,
  initialReceta = null,
  onSaved, // callback(recetaGuardada)
}) => {
  const [indicacionesGenerales, setIndicacionesGenerales] = useState("");
  const [notas, setNotas] = useState("");
  const [medicamentos, setMedicamentos] = useState([defaultMed()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditMode = Boolean(initialReceta && initialReceta.id);

  // Resolver IDs desde receta existente o props
  const resolvePacienteId = () => {
    if (initialReceta?.paciente) {
      if (typeof initialReceta.paciente === "object") {
        return initialReceta.paciente.id;
      }
      return initialReceta.paciente;
    }
    if (paciente?.id) return paciente.id;
    return null;
  };

  const resolveCitaId = () => {
    if (initialReceta?.cita) {
      if (typeof initialReceta.cita === "object") {
        return initialReceta.cita.id;
      }
      return initialReceta.cita;
    }
    if (cita?.id) return cita.id;
    return null;
  };

  // Prefill / reset cuando se abre o cierra el modal
  useEffect(() => {
    if (!show) {
      // reset al cerrar
      setIndicacionesGenerales("");
      setNotas("");
      setMedicamentos([defaultMed()]);
      setError("");
      setSaving(false);
      return;
    }

    // show === true → prellenar si hay receta existente
    if (initialReceta) {
      setIndicacionesGenerales(initialReceta.indicaciones_generales || "");
      setNotas(initialReceta.notas || "");

      if (
        Array.isArray(initialReceta.medicamentos) &&
        initialReceta.medicamentos.length > 0
      ) {
        setMedicamentos(
          initialReceta.medicamentos.map((m) => ({
            nombre: m.nombre || "",
            dosis: m.dosis || "",
            frecuencia: m.frecuencia || "",
            duracion: m.duracion || "",
            via_administracion: m.via_administracion || m.via || "",
            notas: m.notas || "",
          }))
        );
      } else {
        setMedicamentos([defaultMed()]);
      }
    } else {
      // modo creación
      setIndicacionesGenerales("");
      setNotas("");
      setMedicamentos([defaultMed()]);
    }
  }, [show, initialReceta]);

  if (!show) return null;

  const handleChangeMed = (index, field, value) => {
    setMedicamentos((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleAddMed = () => {
    setMedicamentos((prev) => [...prev, defaultMed()]);
  };

  const handleRemoveMed = (index) => {
    setMedicamentos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pacienteId = resolvePacienteId();
    if (!pacienteId) {
      setError("No se encontró el paciente para emitir la receta.");
      return;
    }

    const medsValidos = medicamentos.filter(
      (m) => (m.nombre || "").trim().length > 0
    );
    if (medsValidos.length === 0) {
      setError("Agrega al menos un medicamento con nombre.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        paciente: pacienteId,
        cita: resolveCitaId(), // puede ser null (modo libre)
        indicaciones_generales: indicacionesGenerales,
        notas,
        medicamentos: medsValidos,
      };

      let res;
      if (isEditMode) {
        // 🔁 Actualizar la receta existente (misma cita, mismo paciente)
        res = await actualizarReceta(initialReceta.id, payload);
      } else {
        // 🆕 Crear nueva receta
        res = await crearReceta(payload);
      }

      if (onSaved) {
        onSaved(res);
      }

      onClose();
    } catch (err) {
      console.error("Error al guardar receta:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Error al guardar la receta. Revisa los datos.";
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const pacienteNombre =
    paciente?.nombre || paciente?.apellidos
      ? `${paciente?.nombre || ""} ${paciente?.apellidos || ""}`.trim()
      : initialReceta?.paciente_nombre ||
        initialReceta?.paciente_full_name ||
        (typeof initialReceta?.paciente === "number"
          ? `Paciente #${initialReceta.paciente}`
          : "Paciente no especificado");

  const citaInfo = (() => {
    const c = initialReceta?.cita || cita;
    if (c && typeof c === "object" && c.fecha_hora) {
      return formatearFechaHora(c.fecha_hora);
    }
    if (typeof c === "number") return `Cita #${c}`;
    return null;
  })();

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
      {/* Modal centrado */}
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content shadow doctor-receta-modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {isEditMode ? "Editar receta médica" : "Nueva receta médica"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={saving}
              />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  Paciente: <strong>{pacienteNombre}</strong>
                  {citaInfo && (
                    <>
                      {" "}
                      · Cita: <strong>{citaInfo}</strong>
                    </>
                  )}
                </p>

                {error && (
                  <div className="alert alert-danger py-2 small">{error}</div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Indicaciones generales
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={indicacionesGenerales}
                    onChange={(e) => setIndicacionesGenerales(e.target.value)}
                    placeholder="Dieta, cuidados generales, instrucciones adicionales..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Notas adicionales
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Notas internas, advertencias, etc."
                  />
                </div>

                <hr className="my-3" />

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Medicamentos</h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={handleAddMed}
                    disabled={saving}
                  >
                    + Agregar medicamento
                  </button>
                </div>

                {medicamentos.map((med, index) => (
                  <div
                    key={index}
                    className="border rounded-3 p-3 mb-2 bg-light doctor-receta-med-card"
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold small">
                        Medicamento #{index + 1}
                      </span>
                      {medicamentos.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveMed(index)}
                          disabled={saving}
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Nombre *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={med.nombre}
                          onChange={(e) =>
                            handleChangeMed(index, "nombre", e.target.value)
                          }
                          placeholder="Ej. Isotretinoína 20 mg"
                          required={index === 0}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Dosis</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={med.dosis}
                          onChange={(e) =>
                            handleChangeMed(index, "dosis", e.target.value)
                          }
                          placeholder="Ej. 1 tableta"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Frecuencia</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={med.frecuencia}
                          onChange={(e) =>
                            handleChangeMed(index, "frecuencia", e.target.value)
                          }
                          placeholder="Ej. cada 12 horas"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Duración</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={med.duracion}
                          onChange={(e) =>
                            handleChangeMed(index, "duracion", e.target.value)
                          }
                          placeholder="Ej. 30 días"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">
                          Vía de administración
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={med.via_administracion}
                          onChange={(e) =>
                            handleChangeMed(
                              index,
                              "via_administracion",
                              e.target.value
                            )
                          }
                          placeholder="Ej. Oral, tópica..."
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Notas</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={med.notas}
                          onChange={(e) =>
                            handleChangeMed(index, "notas", e.target.value)
                          }
                          placeholder="Indicaciones específicas de este medicamento..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? isEditMode
                      ? "Guardando cambios..."
                      : "Guardando receta..."
                    : isEditMode
                    ? "Guardar cambios"
                    : "Guardar receta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecetaModal;
