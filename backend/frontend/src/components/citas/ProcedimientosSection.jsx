// src/components/citas/ProcedimientosSection.jsx
import React, { useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import TableLayout from "../TableLayout";

/**
 * Sección de "Procedimientos" dentro de una consulta/reporte clínico.
 *
 * Props esperadas:
 * - procedimientos: array de objetos procedimiento. Sugerido:
 *    {
 *      id: number | string,
 *      nombre: string,
 *      descripcion?: string,
 *      costo?: number | string,
 *    }
 * - loading: boolean (cargando lista desde backend)
 * - readOnly: boolean (si true, oculta acciones y botón de agregar)
 *
 * - onCreate: async (payload) => Promise<void>
 * - onUpdate: async (id, payload) => Promise<void>
 * - onDelete: async (id) => Promise<void>
 *
 * El padre se encarga de:
 * - Traer los procedimientos del backend.
 * - Hacer refetch cuando estas operaciones terminen.
 * - Mostrar toasts globales si lo desea.
 */
const ProcedimientosSection = ({
  procedimientos = [],
  loading = false,
  readOnly = false,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  // Buscador interno
  const [search, setSearch] = useState("");

  // Modal de alta/edición
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // procedimiento o null
  const [formValues, setFormValues] = useState({
    nombre: "",
    descripcion: "",
    costo: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFormValues({
      nombre: "",
      descripcion: "",
      costo: "",
    });
    setFormError("");
    setEditing(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditing(null);
    setShowModal(true);
  };

  const openEditModal = (proc) => {
    setEditing(proc);
    setFormValues({
      nombre: proc.nombre || "",
      descripcion: proc.descripcion || "",
      costo:
        proc.costo !== null && proc.costo !== undefined
          ? String(proc.costo)
          : "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const nombre = formValues.nombre.trim();
    const descripcion = formValues.descripcion.trim();
    const costoStr = formValues.costo.trim();

    if (!nombre) {
      setFormError("El nombre del procedimiento es obligatorio.");
      return;
    }

    let costoValue = null;
    if (costoStr !== "") {
      const parsed = Number(costoStr.replace(",", "."));
      if (Number.isNaN(parsed) || parsed < 0) {
        setFormError(
          "El costo debe ser un número válido mayor o igual a 0."
        );
        return;
      }
      costoValue = parsed;
    }

    const payload = {
      nombre,
      descripcion: descripcion || null,
      costo: costoValue,
    };

    // Si no hay callbacks, no hacemos nada (modo mock/testing)
    const isEdit = !!editing;
    const handler = isEdit ? onUpdate : onCreate;
    if (!handler) {
      console.warn(
        "[ProcedimientosSection] No se proporcionó handler para",
        isEdit ? "onUpdate" : "onCreate"
      );
      setShowModal(false);
      resetForm();
      return;
    }

    try {
      setSubmitting(true);
      if (isEdit) {
        await handler(editing.id, payload);
      } else {
        await handler(payload);
      }
      // Éxito: cerramos modal, el padre debería hacer refetch
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error guardando procedimiento:", err);
      const backendError =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "No se pudo guardar el procedimiento. Intenta de nuevo.";
      setFormError(backendError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (proc) => {
    if (!onDelete) {
      console.warn(
        "[ProcedimientosSection] No se proporcionó onDelete."
      );
      return;
    }
    if (!proc?.id) return;

    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este procedimiento?"
    );
    if (!confirmed) return;

    try {
      await onDelete(proc.id);
      // El padre debe hacer refetch y/o mostrar toast
    } catch (err) {
      console.error("Error eliminando procedimiento:", err);
      const backendError =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "No se pudo eliminar el procedimiento.";
      // Mostramos el error como mensaje arriba de la tabla
      setFormError(backendError);
    }
  };

  // Filtro por search
  const filteredProcedimientos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return procedimientos;

    return procedimientos.filter((proc) => {
      const nombre = (proc.nombre || "").toLowerCase();
      const desc = (proc.descripcion || "").toLowerCase();
      return nombre.includes(q) || desc.includes(q);
    });
  }, [procedimientos, search]);

  // Columnas de la tabla
  const columns = [
    {
      id: "nombre",
      label: "Procedimiento",
      render: (proc) => proc.nombre || "-",
    },
    {
      id: "descripcion",
      label: "Descripción",
      render: (proc) =>
        proc.descripcion ? (
          <span className="small">{proc.descripcion}</span>
        ) : (
          <span className="text-muted small">Sin descripción</span>
        ),
    },
    {
      id: "costo",
      label: "Costo estimado",
      align: "right",
      render: (proc) => {
        if (
          proc.costo === null ||
          proc.costo === undefined ||
          proc.costo === ""
        ) {
          return <span className="text-muted small">N/D</span>;
        }
        const num = Number(proc.costo);
        if (Number.isNaN(num)) {
          return <span className="small">{proc.costo}</span>;
        }
        return (
          <span className="small">
            ${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
  ];

  if (!readOnly && (onUpdate || onDelete)) {
    columns.push({
      id: "acciones",
      label: "Acciones",
      align: "right",
      render: (proc) => (
        <div className="btn-group btn-group-sm" role="group">
          {onUpdate && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(proc);
              }}
            >
              <FiEdit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(proc);
              }}
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
      ),
    });
  }

  return (
    <section className="procedimientos-section">
      <TableLayout
        title="Procedimientos realizados en la consulta"
        toolbarRight={
          !readOnly && onCreate ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={openCreateModal}
            >
              <FiPlus size={14} className="me-1" />
              Agregar procedimiento
            </button>
          ) : null
        }
        columns={columns}
        data={filteredProcedimientos}
        loading={loading}
        emptyMessage="No se han registrado procedimientos para esta consulta."
        enableSearch={true}
        searchPlaceholder="Buscar por nombre o descripción..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[]}
        enablePagination={false}
        dense={true}
        striped={true}
        hover={true}
        rowKey="id"
      />

      {/* Mensaje de error global (por ejemplo, de eliminar) */}
      {formError && !showModal && (
        <div className="alert alert-danger mt-2 mb-0">
          {formError}
        </div>
      )}

      {/* Modal de alta/edición */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1050,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <h5 className="mb-3">
              {editing
                ? "Editar procedimiento"
                : "Agregar procedimiento"}
            </h5>

            {formError && (
              <div className="alert alert-danger">{formError}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">
                  Nombre del procedimiento
                </label>
                <input
                  type="text"
                  name="nombre"
                  className="form-control"
                  value={formValues.nombre}
                  onChange={handleInputChange}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  name="descripcion"
                  className="form-control"
                  rows={3}
                  value={formValues.descripcion}
                  onChange={handleInputChange}
                  disabled={submitting}
                  placeholder="Opcional: detalles, zona tratada, notas técnicas..."
                />
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Costo estimado (MXN)
                </label>
                <input
                  type="number"
                  name="costo"
                  className="form-control"
                  min="0"
                  step="0.01"
                  value={formValues.costo}
                  onChange={handleInputChange}
                  disabled={submitting}
                  placeholder="Opcional"
                />
                <div className="form-text">
                  Solo informativo; el cálculo económico global lo
                  puedes hacer en otra sección si lo deseas.
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Guardando..."
                    : editing
                    ? "Guardar cambios"
                    : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProcedimientosSection;
