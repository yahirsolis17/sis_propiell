// frontend/src/pages/doctores/DoctorRecetasPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getRecetas } from "../../services/recetasService";
import RecetaModal from "../../components/citas/RecetaModal";

// 👉 Importamos el formateador centralizado
import { formatearFechaHora } from "../../components/clinicFormatters";

// 👉 Nuevo: usamos el TableLayout global
import TableLayout from "../../components/TableLayout";

import "./DoctorRecetasPage.css";

// 📅 Fuente de fecha para la receta según el backend (nuevo + compatibilidad)
const getFechaRecetaBase = (receta) => {
  return (
    receta.fecha_emision ||
    receta.fecha ||
    receta.creado_en ||
    receta.actualizado_en ||
    receta.created_at ||
    receta.updated_at ||
    receta.fecha_receta
  );
};

const getPacienteNombre = (receta) => {
  const p = receta?.paciente;
  if (!p) {
    if (receta?.paciente_nombre) return receta.paciente_nombre;
    if (receta?.paciente_full_name) return receta.paciente_full_name;
    if (receta?.paciente_id) return `Paciente #${receta.paciente_id}`;
    if (typeof receta?.paciente === "number") {
      return `Paciente #${receta.paciente}`;
    }
    return "Paciente no especificado";
  }

  if (typeof p === "string") return p;
  if (p.nombre || p.apellidos) {
    return `${p.nombre || ""} ${p.apellidos || ""}`.trim();
  }
  if (p.full_name) return p.full_name;
  if (p.id) return `Paciente #${p.id}`;
  return "Paciente no especificado";
};

const getCitaTexto = (receta) => {
  const c = receta.cita;
  if (c && typeof c === "object") {
    if (c.fecha_hora) {
      return formatearFechaHora(c.fecha_hora);
    }
    if (c.id) return `Cita #${c.id}`;
  }

  if (receta.cita_fecha) {
    return formatearFechaHora(receta.cita_fecha);
  }
  if (typeof receta.cita === "number") {
    return `Cita #${receta.cita}`;
  }

  return "Sin cita asociada";
};

const getDetalleReceta = (receta) => {
  if (receta.indicaciones_generales) return receta.indicaciones_generales;
  if (receta.notas) return receta.notas;

  if (Array.isArray(receta.medicamentos) && receta.medicamentos.length > 0) {
    const m0 = receta.medicamentos[0];
    const partes = [
      m0.nombre,
      m0.dosis,
      m0.frecuencia,
      m0.duracion,
      m0.via_administracion || m0.via,
    ]
      .filter(Boolean)
      .join(" · ");
    return partes || m0.nombre || "Medicamentos prescritos";
  }

  return "-";
};

const DoctorRecetasPage = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());

  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiltro, setLoadingFiltro] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  // 🔎 receta seleccionada para ver/editar
  const [selectedReceta, setSelectedReceta] = useState(null);
  const [showRecetaModal, setShowRecetaModal] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDoctorOrAdmin = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"].includes(
    user.role
  );

  useEffect(() => {
    if (!isDoctorOrAdmin) {
      setError("No tienes permiso para ver las recetas médicas.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchRecetas = async () => {
      try {
        setError("");
        setLoading(true);

        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        const params = {};

        // Filtrar por doctor en frontend si no es ADMIN
        if (user.role !== "ADMIN") {
          params.doctor = user.id;
        }

        const data = await getRecetas(params, controller.signal);
        if (!isMounted) return;

        setRecetas(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar recetas médicas:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar las recetas médicas.";
          setError(detail);
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
          setLoadingFiltro(false);
        }
      }
    };

    fetchRecetas();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDoctorOrAdmin, navigate, user.id, user.role]);

  // pequeño efecto para mostrar "Actualizando resultados..." al tipear
  useEffect(() => {
    if (!loading) {
      setLoadingFiltro(true);
      const t = setTimeout(() => setLoadingFiltro(false), 200);
      return () => clearTimeout(t);
    }
  }, [search, loading]);

  const recetasOrdenadasFiltradas = useMemo(() => {
    if (!Array.isArray(recetas)) return [];

    const ordenadas = [...recetas].sort((a, b) => {
      const fa = new Date(getFechaRecetaBase(a) || 0);
      const fb = new Date(getFechaRecetaBase(b) || 0);
      return fb - fa;
    });

    const q = search.trim().toLowerCase();
    if (!q) return ordenadas;

    return ordenadas.filter((receta) => {
      const pacienteNombre = getPacienteNombre(receta).toLowerCase();
      const detalle = getDetalleReceta(receta).toLowerCase();
      const citaTexto = getCitaTexto(receta).toLowerCase();

      return (
        pacienteNombre.includes(q) ||
        detalle.includes(q) ||
        citaTexto.includes(q)
      );
    });
  }, [recetas, search]);

  const handleVerReceta = (receta) => {
    setSelectedReceta(receta);
    setShowRecetaModal(true);
  };

  const handleRecetaGuardada = (recetaActualizada) => {
    setRecetas((prev) =>
      prev.map((r) => (r.id === recetaActualizada.id ? recetaActualizada : r))
    );
    setSelectedReceta(recetaActualizada);
  };

  if (!isDoctorOrAdmin) {
    return (
      <>
        <Navbar />
        <div className="container my-4">
          <div className="alert alert-danger">
            No tienes permiso para acceder a esta sección.
          </div>
        </div>
      </>
    );
  }

  const totalRecetas = recetas.length;

  const roleLabel =
    user.role === "DERMATOLOGO"
      ? "Dermatólogo"
      : user.role === "PODOLOGO"
      ? "Podólogo"
      : user.role === "TAMIZ"
      ? "Tamiz"
      : user.role;

  // 🧱 Columnas para TableLayout
  const columns = [
    {
      id: "fecha",
      label: "Fecha",
      render: (receta) =>
        formatearFechaHora(getFechaRecetaBase(receta)) || "-",
    },
    {
      id: "paciente",
      label: "Paciente",
      render: (receta) => getPacienteNombre(receta),
    },
    {
      id: "cita",
      label: "Cita",
      render: (receta) => getCitaTexto(receta),
    },
    {
      id: "detalle",
      label: "Detalle",
      render: (receta) => (
        <div
          className="d-flex justify-content-between align-items-center gap-2"
          style={{ maxWidth: "420px" }}
        >
          <span className="text-truncate flex-grow-1">
            {getDetalleReceta(receta)}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary flex-shrink-0"
            onClick={() => handleVerReceta(receta)}
          >
            Ver / editar
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Navbar />

      <div className="doctor-recetas-page">
        <div className="doctor-recetas-wrapper">
          {/* HEADER */}
          <header className="doctor-recetas-header">
            <div className="doctor-recetas-header-left">
              <h1 className="doctor-recetas-title">Recetas médicas</h1>
              <p className="doctor-recetas-subtitle">
                {user.nombre} {user.apellidos} ·{" "}
                <span className="doctor-role-pill">{roleLabel}</span>
              </p>
            </div>

            <div className="doctor-recetas-header-right">
              <span className="doctor-recetas-badge-count">
                <span className="doctor-recetas-count">{totalRecetas}</span>
                <span className="doctor-recetas-label">
                  Receta{totalRecetas === 1 ? "" : "s"}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm doctor-recetas-back-btn"
                onClick={() => navigate("/doctor/pacientes")}
              >
                ← Volver a pacientes
              </button>
            </div>
          </header>

          {/* ERROR GLOBAL (se mantiene separado del TableLayout) */}
          {error && (
            <div className="alert alert-danger doctor-recetas-error">
              {error}
            </div>
          )}

          {/* CARD FILTROS / BÚSQUEDA */}
          <section className="doctor-recetas-filters-card">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="doctor-recetas-filters-label">
                  Buscar (paciente / cita / detalles)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm doctor-recetas-search-input"
                  placeholder="Ej. Juan, acné, isotretinoína..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-6 text-md-end">
                {loadingFiltro && !loading && (
                  <span className="doctor-recetas-filters-status">
                    Actualizando resultados...
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* CARD TABLA con TableLayout */}
          <section className="doctor-recetas-table-card">
            <TableLayout
              title="Recetas médicas"
              columns={columns}
              data={recetasOrdenadasFiltradas}
              loading={loading}
              emptyMessage="No se encontraron recetas con los filtros actuales."
              enableSearch={false}      // búsqueda ya se maneja arriba
              enablePagination={false}  // todo en memoria por ahora
              dense={false}
              striped={true}
              hover={true}
              rowKey="id"
            />
          </section>
        </div>
      </div>

      {/* Modal reutilizable para la receta seleccionada */}
      <RecetaModal
        show={showRecetaModal}
        onClose={() => {
          setShowRecetaModal(false);
          setSelectedReceta(null);
        }}
        paciente={
          selectedReceta?.paciente &&
          typeof selectedReceta.paciente === "object"
            ? selectedReceta.paciente
            : null
        }
        cita={
          selectedReceta?.cita && typeof selectedReceta.cita === "object"
            ? selectedReceta.cita
            : null
        }
        initialReceta={selectedReceta}
        onSaved={handleRecetaGuardada}
      />
    </>
  );
};

export default DoctorRecetasPage;
