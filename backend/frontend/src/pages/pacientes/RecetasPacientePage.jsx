// src/pages/pacientes/RecetasPacientePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getRecetasByPaciente } from "../../services/recetasService";
import "./RecetasPacientePage.css";

const formatearFechaHora = (fechaStr) => {
  if (!fechaStr) return "-";
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return fechaStr;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getDoctorNombre = (receta) => {
  const d = receta?.doctor || receta?.medico || receta?.doctor_name;
  if (!d) return "No especificado";

  if (typeof d === "string") return d;

  if (d.nombre || d.apellidos) {
    return `${d.nombre || ""} ${d.apellidos || ""}`.trim();
  }
  if (d.full_name) return d.full_name;
  if (d.username) return d.username;

  return "No especificado";
};

const getCitaTexto = (receta) => {
  const c = receta.cita;
  if (c && typeof c === "object") {
    if (c.fecha_hora) return formatearFechaHora(c.fecha_hora);
    if (c.id) return `Cita #${c.id}`;
  }

  if (receta.cita_fecha) return formatearFechaHora(receta.cita_fecha);
  if (typeof receta.cita === "number") return `Cita #${receta.cita}`;

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

const RecetasPacientePage = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());

  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiltro, setLoadingFiltro] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || "").toUpperCase();
  const isPaciente = role === "PACIENTE";

  useEffect(() => {
    if (!isPaciente) {
      setError("No tienes permiso para ver tus recetas médicas.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchRecetas = async () => {
      try {
        setError("");
        setLoading(true);
        setLoadingFiltro(true);

        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        const data = await getRecetasByPaciente(user.id, controller.signal);
        if (!isMounted) return;

        setRecetas(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar recetas del paciente:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar el historial de recetas.";
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
  }, [isPaciente, navigate, user.id]);

  const recetasFiltradas = useMemo(() => {
    if (!Array.isArray(recetas)) return [];

    // 🔑 Importante: clonamos antes de ordenar para no mutar el estado
    const ordenadas = [...recetas].sort((a, b) => {
      const fa = new Date(
        a.fecha || a.created_at || a.updated_at || a.fecha_receta
      );
      const fb = new Date(
        b.fecha || b.created_at || b.updated_at || b.fecha_receta
      );
      return fb - fa;
    });

    const q = search.trim().toLowerCase();
    if (!q) return ordenadas;

    return ordenadas.filter((receta) => {
      const doctorNombre = getDoctorNombre(receta).toLowerCase();
      const citaTexto = getCitaTexto(receta).toLowerCase();
      const detalle = getDetalleReceta(receta).toLowerCase();
      return (
        doctorNombre.includes(q) ||
        citaTexto.includes(q) ||
        detalle.includes(q)
      );
    });
  }, [recetas, search]);

  const handleVolver = () => {
    navigate("/dashboard/paciente");
  };

  if (!isPaciente) {
    return (
      <>
        <Navbar />
        <div className="paciente-recetas-container">
          <div className="paciente-recetas-page">
            <div className="paciente-recetas-content">
              <div className="recetas-permission-denied">
                <h5 className="recetas-permission-denied-title">
                  Acceso no autorizado
                </h5>
                <p className="recetas-permission-denied-message">
                  No tienes permiso para acceder a esta sección.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <div className="paciente-recetas-container">
        <div className="paciente-recetas-page">
          <div className="paciente-recetas-content">
            {/* Header principal */}
            <header className="paciente-recetas-main-header">
              <div className="paciente-recetas-header-content">
                <div className="paciente-recetas-header-left">
                  <h2 className="paciente-recetas-title">Mis recetas médicas</h2>
                  <p className="paciente-recetas-subtitle">
                    Consulta las recetas que te han emitido tus especialistas.
                  </p>
                </div>
                
                <div className="paciente-recetas-header-right">
                  <div className="recetas-summary-card">
                    <div className="recetas-count">{recetasFiltradas.length}</div>
                    <div className="recetas-label">Recetas</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Card principal */}
            <div className="paciente-recetas-main-card">
              {/* Botón de volver */}
              <div className="d-flex justify-content-end p-4 pb-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleVolver}
                >
                  ← Volver a mi panel
                </button>
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="recetas-error m-4">{error}</div>
              )}

              {/* Card de búsqueda */}
              <div className="recetas-search-card m-4 mt-0">
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-8">
                    <label className="recetas-search-label">
                      Buscar en mis recetas
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej. nombre del medicamento, diagnóstico, doctor..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-4 text-md-end">
                    {loadingFiltro && (
                      <div className="recetas-filter-loading">
                        Cargando / filtrando recetas...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla de recetas */}
              <div className="p-4 pt-0">
                {loading ? (
                  <div className="recetas-loading">
                    Cargando historial de recetas...
                  </div>
                ) : recetasFiltradas.length === 0 ? (
                  <div className="recetas-empty">
                    <h4>No se encontraron recetas</h4>
                    <p>
                      Aún no tienes recetas registradas o no coinciden con la
                      búsqueda.
                    </p>
                  </div>
                ) : (
                  <div className="recetas-table-wrapper">
                    <table className="recetas-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Médico</th>
                          <th>Cita</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recetasFiltradas.map((receta) => {
                          const fechaReceta = formatearFechaHora(
                            receta.fecha ||
                              receta.created_at ||
                              receta.updated_at ||
                              receta.fecha_receta
                          );

                          return (
                            <tr key={receta.id}>
                              <td>{fechaReceta}</td>
                              <td className="small">{getDoctorNombre(receta)}</td>
                              <td className="small">{getCitaTexto(receta)}</td>
                              <td
                                className="small"
                                style={{ maxWidth: "500px" }}
                              >
                                <div className="text-truncate">
                                  {getDetalleReceta(receta)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecetasPacientePage;