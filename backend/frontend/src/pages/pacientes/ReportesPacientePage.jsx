// src/pages/pacientes/PacienteReportesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getReportesByPaciente } from "../../services/reportesService";
import {
  formatearFechaHora,
  mapEstadoReporte,
} from "../../components/clinicFormatters";
import "./ReportesPacientePage.css";

// 📅 Fecha base del reporte (mismo criterio que en DoctorReportesPage)
const getFechaReporteBase = (reporte) => {
  return (
    reporte.fecha_reporte ||
    reporte.fecha ||
    reporte.creado_en ||
    reporte.actualizado_en ||
    reporte.created_at ||
    reporte.updated_at
  );
};

const ReportesPacientePage = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());

  const [reportes, setReportes] = useState([]);
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
      setError("No tienes permiso para ver el historial de consultas.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchReportes = async () => {
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

        const data = await getReportesByPaciente(user.id, controller.signal);
        if (!isMounted) return;

        setReportes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar reportes del paciente:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar el historial de consultas.";
          setError(detail);
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
          setLoadingFiltro(false);
        }
      }
    };

    fetchReportes();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isPaciente, navigate, user.id]);

  const reportesFiltrados = useMemo(() => {
    if (!Array.isArray(reportes)) return [];

    // 1) Solo mostramos reportes FINAL al paciente
    const visibles = reportes.filter((reporte) => {
      const estado = (reporte.estado || "").toUpperCase();
      return estado === "FINAL";
    });

    // 2) Orden por fecha (más recientes primero) usando la misma fecha base
    const ordenados = visibles.sort((a, b) => {
      const fa = new Date(getFechaReporteBase(a) || 0);
      const fb = new Date(getFechaReporteBase(b) || 0);
      return fb - fa;
    });

    // 3) Filtro de búsqueda
    const q = search.trim().toLowerCase();
    if (!q) return ordenados;

    return ordenados.filter((reporte) => {
      const resumen = (reporte.resumen || "").toLowerCase();
      const diagnostico = (reporte.diagnostico || "").toLowerCase();
      const recomendaciones = (reporte.recomendaciones || "").toLowerCase();
      return (
        resumen.includes(q) ||
        diagnostico.includes(q) ||
        recomendaciones.includes(q)
      );
    });
  }, [reportes, search]);

  const handleVolver = () => {
    navigate("/dashboard/paciente");
  };

  if (!isPaciente) {
    return (
      <>
        <Navbar />
        <div className="paciente-reportes-container">
          <div className="paciente-reportes-page">
            <div className="paciente-reportes-content">
              <div className="reportes-permission-denied">
                <h5 className="reportes-permission-denied-title">
                  Acceso no autorizado
                </h5>
                <p className="reportes-permission-denied-message">
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
      
      <div className="paciente-reportes-container">
        <div className="paciente-reportes-page">
          <div className="paciente-reportes-content">
            {/* Header principal */}
            <header className="paciente-reportes-main-header">
              <div className="paciente-reportes-header-content">
                <div className="paciente-reportes-header-left">
                  <h2 className="paciente-reportes-title">Historial de consultas</h2>
                  <p className="paciente-reportes-subtitle">
                    Aquí puedes revisar las consultas clínicas que han sido
                    registradas por tu especialista.
                  </p>
                </div>
                
                <div className="paciente-reportes-header-right">
                  <div className="reportes-summary-card">
                    <div className="reportes-count">{reportesFiltrados.length}</div>
                    <div className="reportes-label">Consultas</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Card principal */}
            <div className="paciente-reportes-main-card">
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
                <div className="reportes-error">{error}</div>
              )}

              {/* Card de búsqueda */}
              <div className="reportes-search-card">
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-8">
                    <label className="reportes-search-label">
                      Buscar en mis consultas
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej. acné, dermatitis, control, seguimiento..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-4 text-md-end">
                    {loadingFiltro && loading && (
                      <div className="reportes-filter-loading">
                        Cargando / filtrando historial...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenido de la tabla */}
              <div className="p-4 pt-0">
                {loading ? (
                  <div className="reportes-loading">
                    Cargando historial de consultas...
                  </div>
                ) : reportesFiltrados.length === 0 ? (
                  <div className="reportes-empty">
                    <h4>No se encontraron consultas</h4>
                    <p>
                      Aún no tienes consultas clínicas registradas como{" "}
                      <strong>Final</strong> o no coinciden con la búsqueda.
                    </p>
                  </div>
                ) : (
                  <div className="reportes-table-wrapper">
                    <table className="reportes-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportesFiltrados.map((reporte) => {
                          const fechaReporte = formatearFechaHora(
                            getFechaReporteBase(reporte)
                          );

                          const detalle =
                            reporte.resumen ||
                            reporte.diagnostico ||
                            reporte.recomendaciones ||
                            "-";

                          return (
                            <tr key={reporte.id}>
                              <td>{fechaReporte}</td>
                              <td>
                                <span className="badge bg-success">
                                  {mapEstadoReporte(reporte.estado)}
                                </span>
                              </td>
                              <td
                                className="small"
                                style={{ maxWidth: "500px" }}
                              >
                                <div className="text-truncate">
                                  {detalle}
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

export default ReportesPacientePage;