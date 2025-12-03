// src/pages/doctores/DoctorReportePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useLocation } from "react-router-dom";

import Navbar from "../../components/Navbar";
import TableLayout from "../../components/TableLayout";
import RecetaModal from "../../components/citas/RecetaModal";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { 
  getReportes, 
  getReportesByPaciente 
} from "../../services/reportesService";
import { getCitasByPaciente } from "../../services/pacientesService";
import { getRecetasByPaciente } from "../../services/recetasService";
import { getPagosByPaciente } from "../../services/pagosService";
import {
  formatearFechaHora,
  mapEstadoReporte,
} from "../../components/clinicFormatters";
import { requiereConsentimiento } from "../../utils/clinicRules";

import "./DoctorReportesPage.css";

// 📅 Fecha base del reporte
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

const getPacienteNombre = (reporte) => {
  const p = reporte?.paciente;
  if (!p) {
    if (reporte?.paciente_nombre) return reporte.paciente_nombre;
    if (reporte?.paciente_full_name) return reporte.paciente_full_name;
    if (reporte?.paciente_id) return `Paciente #${reporte.paciente_id}`;
    if (typeof reporte?.paciente === "number") {
      return `Paciente #${reporte.paciente}`;
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

const mapTipoCita = (tipo) => {
  if (tipo === "I") return "Inicial";
  if (tipo === "S") return "Subsecuente";
  return tipo || "-";
};

const DoctorReportePage = () => {
  const navigate = useNavigate();
  const { pacienteId } = useParams();
  const location = useLocation();
  const [user] = useState(() => getCurrentUser());

  // Estados para lista de reportes
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiltro, setLoadingFiltro] = useState(false);
  const [error, setError] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [search, setSearch] = useState("");

  // Estados para detalle de paciente (si se selecciona uno)
  const [paciente, setPaciente] = useState(null);
  const [citas, setCitas] = useState([]);
  const [pacienteReportes, setPacienteReportes] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [pagos, setPagos] = useState([]);
  
  const [loadingPaciente, setLoadingPaciente] = useState(false);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [loadingPacienteReportes, setLoadingPacienteReportes] = useState(false);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [loadingPagos, setLoadingPagos] = useState(false);

  const [showRecetaModal, setShowRecetaModal] = useState(false);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDoctorOrAdmin = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"].includes(
    user.role
  );

  // Efecto principal para cargar reportes o detalle de paciente
  useEffect(() => {
    if (!isDoctorOrAdmin) {
      setError("No tienes permiso para ver los reportes clínicos.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      try {
        setError("");
        
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        // MODO DETALLE: Si hay pacienteId, cargar detalle completo
        if (pacienteId) {
          setLoadingCitas(true);
          setLoadingPacienteReportes(true);
          setLoadingRecetas(true);
          setLoadingPagos(true);

          // NO cargamos datos del paciente directamente (evitamos el 403)

          // Cargar reportes del paciente primero
          try {
            const reportesData = await getReportesByPaciente(pacienteId, controller.signal);
            if (isMounted) {
              setPacienteReportes(Array.isArray(reportesData) ? reportesData : []);
              
              // Extraer datos básicos del paciente del primer reporte
              if (reportesData.length > 0 && reportesData[0].paciente) {
                const pacienteData = reportesData[0].paciente;
                if (typeof pacienteData === 'object') {
                  setPaciente(pacienteData);
                }
              }
            }
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar reportes del paciente:", err);
            }
          } finally {
            if (isMounted) setLoadingPacienteReportes(false);
          }

          // Cargar citas
          try {
            const citasData = await getCitasByPaciente(pacienteId, controller.signal);
            if (isMounted) setCitas(Array.isArray(citasData) ? citasData : []);
            
            // Si no tenemos datos del paciente de los reportes, intentar de las citas
            if (isMounted && !paciente && citasData.length > 0 && citasData[0].paciente) {
              const pacienteData = citasData[0].paciente;
              if (typeof pacienteData === 'object') {
                setPaciente(pacienteData);
              }
            }
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar citas:", err);
            }
          } finally {
            if (isMounted) setLoadingCitas(false);
          }

          // Cargar recetas
          try {
            const recetasData = await getRecetasByPaciente(pacienteId, controller.signal);
            if (isMounted) setRecetas(Array.isArray(recetasData) ? recetasData : []);
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar recetas:", err);
            }
          } finally {
            if (isMounted) setLoadingRecetas(false);
          }

          // Cargar pagos
          try {
            const pagosData = await getPagosByPaciente(pacienteId, controller.signal);
            if (isMounted) setPagos(Array.isArray(pagosData) ? pagosData : []);
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar pagos:", err);
            }
          } finally {
            if (isMounted) setLoadingPagos(false);
          }

        } else {
          // MODO LISTA: Cargar todos los reportes
          setLoading(true);

          const params = {};
          if (user.role !== "ADMIN") {
            params.doctor = user.id;
          }
          if (estadoFilter) {
            params.estado = estadoFilter;
          }

          const data = await getReportes(params, controller.signal);
          if (!isMounted) return;

          setReportes(Array.isArray(data) ? data : []);
          setLoading(false);
        }

      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar datos:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar los datos.";
          setError(detail);
          
          // Resetear loadings en caso de error
          if (!pacienteId) {
            setLoading(false);
          } else {
            setLoadingCitas(false);
            setLoadingPacienteReportes(false);
            setLoadingRecetas(false);
            setLoadingPagos(false);
          }
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDoctorOrAdmin, pacienteId, estadoFilter, navigate, user.id, user.role]);

  // Efecto para "Actualizando resultados..." al escribir en búsqueda (solo en modo lista)
  useEffect(() => {
    if (!loading && !pacienteId) {
      setLoadingFiltro(true);
      const t = setTimeout(() => setLoadingFiltro(false), 200);
      return () => clearTimeout(t);
    }
  }, [search, loading, pacienteId]);

  // Memos para datos procesados (modo lista)
  const reportesOrdenadosFiltrados = useMemo(() => {
    if (pacienteId || !Array.isArray(reportes)) return [];

    const ordenados = [...reportes].sort((a, b) => {
      const fa = new Date(getFechaReporteBase(a) || 0);
      const fb = new Date(getFechaReporteBase(b) || 0);
      return fb - fa;
    });

    const q = search.trim().toLowerCase();
    if (!q) return ordenados;

    return ordenados.filter((reporte) => {
      const pacienteNombre = getPacienteNombre(reporte).toLowerCase();
      const resumen = (reporte.resumen || "").toLowerCase();
      const diagnostico = (reporte.diagnostico || "").toLowerCase();
      const recomendaciones = (reporte.recomendaciones || "").toLowerCase();

      return (
        pacienteNombre.includes(q) ||
        resumen.includes(q) ||
        diagnostico.includes(q) ||
        recomendaciones.includes(q)
      );
    });
  }, [reportes, search, pacienteId]);

  // Memos para datos del paciente (modo detalle)
  const citasOrdenadas = useMemo(() => {
    if (!Array.isArray(citas)) return [];
    return [...citas].sort(
      (a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)
    );
  }, [citas]);

  const citasSubsecuentes = useMemo(
    () => citas.filter((c) => c.tipo === "S"),
    [citas]
  );

  const ultimaCita = citasOrdenadas[0] || null;

  // Handlers
  const handleRowClick = (reporte) => {
    const pacienteField = reporte?.paciente;
    const pacienteId =
      typeof pacienteField === "object"
        ? pacienteField.id || pacienteField.pk
        : reporte.paciente_id || reporte.paciente;

    if (!pacienteId) return;

    // Navegar a la vista de detalle del mismo paciente
    navigate(`/doctor/reportes/paciente/${pacienteId}`);
  };

  const handleVolverALista = () => {
    navigate("/doctor/reportes");
  };

  const handleIniciarConsulta = () => {
    if (!pacienteId) return;

    navigate(`/doctor/pacientes/${pacienteId}/consulta`, {
      state: {
        paciente: paciente || { id: pacienteId },
        ultimaCita,
        from: "doctor-reportes-detalle",
      },
    });
  };

  const handleAbrirRecetaDesdeTabla = (receta) => {
    if (!paciente) return;
    setRecetaSeleccionada(receta);
    setShowRecetaModal(true);
  };

  const handleRecetaGuardadaDesdeDetalle = (recetaActualizada) => {
    setRecetas((prev) =>
      prev.map((r) => (r.id === recetaActualizada.id ? recetaActualizada : r))
    );
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

  const roleLabel =
    user.role === "DERMATOLOGO"
      ? "Dermatólogo"
      : user.role === "PODOLOGO"
      ? "Podólogo"
      : user.role === "TAMIZ"
      ? "Tamiz"
      : user.role;

  // 🧱 Columnas para TableLayout (modo lista)
  const columns = [
    {
      id: "fecha",
      label: "Fecha",
      render: (reporte) =>
        formatearFechaHora(getFechaReporteBase(reporte)),
    },
    {
      id: "paciente",
      label: "Paciente",
      render: (reporte) => (
        <span className="small">{getPacienteNombre(reporte)}</span>
      ),
    },
    {
      id: "estado",
      label: "Estado",
      render: (reporte) => (
        <span
          className={`badge ${
            (reporte.estado || "").toUpperCase() === "FINAL"
              ? "bg-success"
              : "bg-secondary"
          }`}
        >
          {mapEstadoReporte(reporte.estado)}
        </span>
      ),
    },
    {
      id: "resumen",
      label: "Resumen / diagnóstico",
      render: (reporte) => {
        const resumenCorto =
          reporte.resumen ||
          reporte.diagnostico ||
          reporte.recomendaciones ||
          "-";
        return (
          <span
            className="small text-truncate d-inline-block"
            style={{ maxWidth: 380 }}
          >
            {resumenCorto}
          </span>
        );
      },
    },
  ];

  // ================================
  // RENDERIZADO MODO DETALLE
  // ================================
  if (pacienteId) {
    const loadingDetalle = loadingCitas || loadingPacienteReportes || loadingRecetas || loadingPagos;
    const tieneDatos = pacienteReportes.length > 0 || citas.length > 0 || recetas.length > 0 || pagos.length > 0;

    return (
      <>
        <Navbar />
        <div className="doctor-reporte-container">
          <div className="doctor-reporte-page">
            <div className="doctor-reporte-content">
              {loadingDetalle ? (
                <div className="doctor-reporte-loading">
                  Cargando información del paciente...
                </div>
              ) : error ? (
                <div className="row">
                  <div className="col-12 mb-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleVolverALista}
                    >
                      ← Volver a reportes
                    </button>
                  </div>
                  <div className="col-12">
                    <div className="doctor-reporte-error-card mb-0">
                      {error}
                    </div>
                  </div>
                </div>
              ) : !tieneDatos ? (
                <div className="row">
                  <div className="col-12 mb-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleVolverALista}
                    >
                      ← Volver a reportes
                    </button>
                  </div>
                  <div className="col-12">
                    <div className="alert alert-warning mb-0">
                      No se encontró información clínica para este paciente.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* HEADER DEL DETALLE */}
                  <div className="doctor-reporte-header">
                    <div className="doctor-reporte-header-content">
                      <div className="doctor-reporte-header-left">
                        <h1 className="doctor-reporte-title">
                          {paciente ? `${paciente.nombre} ${paciente.apellidos}` : `Paciente #${pacienteId}`}
                        </h1>
                        <p className="doctor-reporte-subtitle">
                          Vista consolidada del historial clínico, recetas y pagos del paciente.
                        </p>
                        {paciente && (
                          <div className="doctor-reporte-meta">
                            <span>
                              Edad: <strong>{paciente.edad ?? "-"}</strong> años · Sexo:{" "}
                              <strong>{paciente.sexo || "-"}</strong>
                            </span>
                            <span>
                              Teléfono: <strong>{paciente.telefono || "-"}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="doctor-reporte-header-right">
                        <div className="doctor-reporte-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={handleVolverALista}
                          >
                            ← Volver a reportes
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleIniciarConsulta}
                          >
                            Nueva consulta
                          </button>
                        </div>

                        <div className="doctor-reporte-summary-chip d-none d-md-block">
                          <strong>Total citas:</strong> {citas.length} ·{" "}
                          <strong>Subsecuentes:</strong> {citasSubsecuentes.length}
                          <br />
                          <strong>Última cita:</strong>{" "}
                          {ultimaCita
                            ? formatearFechaHora(ultimaCita.fecha_hora)
                            : "Sin citas"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RESUMEN + HISTORIAL DE CITAS */}
                  <div className="row g-4 doctor-reporte-row">
                    <div className="col-12 col-lg-4">
                      <div className="card shadow-sm h-100 doctor-reporte-section-card paciente-resumen-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Resumen clínico
                          </h2>
                          <ul className="paciente-resumen-list mb-0">
                            <li>
                              <strong>Total de citas:</strong> {citas.length}
                            </li>
                            <li>
                              <strong>Citas subsecuentes:</strong>{" "}
                              {citasSubsecuentes.length}
                            </li>
                            <li>
                              <strong>Reportes clínicos:</strong>{" "}
                              {pacienteReportes.length}
                            </li>
                            <li>
                              <strong>Recetas médicas:</strong> {recetas.length}
                            </li>
                            <li>
                              <strong>Registros de pago:</strong> {pagos.length}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-8">
                      <div className="card shadow-sm doctor-reporte-section-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Historial de citas
                          </h2>

                          {citas.length === 0 ? (
                            <p className="paciente-empty-text mb-0">
                              Este paciente aún no tiene citas registradas contigo.
                            </p>
                          ) : (
                            <div className="table-responsive doctor-reporte-table-wrapper">
                              <table className="table table-sm table-hover align-middle mb-0 doctor-reporte-table">
                                <thead>
                                  <tr>
                                    <th>Fecha y hora</th>
                                    <th>Tipo</th>
                                    <th>Estado</th>
                                    <th>Pago</th>
                                    <th>Consentimiento</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {citasOrdenadas.map((cita) => {
                                    const ultimoPago = (cita.pagos || [])[0];
                                    return (
                                      <tr key={cita.id}>
                                        <td>
                                          {formatearFechaHora(cita.fecha_hora)}
                                        </td>
                                        <td>{mapTipoCita(cita.tipo)}</td>
                                        <td>{cita.estado}</td>
                                        <td>
                                          {ultimoPago ? (
                                            <>
                                              {ultimoPago.estado_pago_display} ·{" "}
                                              {ultimoPago.metodo_pago_display}
                                            </>
                                          ) : (
                                            <span className="text-muted">
                                              Sin pago registrado
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          {requiereConsentimiento(cita) ? (
                                            cita.consentimiento_completado ? (
                                              <span className="badge bg-success">
                                                Completo
                                              </span>
                                            ) : (
                                              <span className="badge bg-secondary">
                                                Pendiente
                                              </span>
                                            )
                                          ) : (
                                            <span className="badge bg-light text-muted">
                                              No aplica
                                            </span>
                                          )}
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

                  {/* REPORTES CLÍNICOS Y RECETAS */}
                  <div className="row g-4 mt-4 doctor-reporte-row">
                    <div className="col-12 col-lg-6">
                      <div className="card shadow-sm h-100 doctor-reporte-section-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Consultas clínicas (reportes)
                          </h2>

                          {pacienteReportes.length === 0 ? (
                            <p className="paciente-empty-text mb-0">
                              Aún no hay consultas clínicas registradas para este paciente.
                            </p>
                          ) : (
                            <div className="table-responsive doctor-reporte-table-wrapper">
                              <table className="table table-sm table-hover align-middle mb-0 doctor-reporte-table">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Resumen</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pacienteReportes.map((reporte) => {
                                    const fechaReporte = formatearFechaHora(
                                      getFechaReporteBase(reporte)
                                    );
                                    return (
                                      <tr key={reporte.id}>
                                        <td>{fechaReporte}</td>
                                        <td>
                                          <span
                                            className={`badge ${
                                              (reporte.estado || "").toUpperCase() === "FINAL"
                                                ? "bg-success"
                                                : "bg-secondary"
                                            }`}
                                          >
                                            {mapEstadoReporte(reporte.estado)}
                                          </span>
                                        </td>
                                        <td className="small">
                                          {reporte.resumen ||
                                            reporte.diagnostico ||
                                            "-"}
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

                    <div className="col-12 col-lg-6">
                      <div className="card shadow-sm h-100 doctor-reporte-section-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Recetas médicas
                          </h2>

                          {recetas.length === 0 ? (
                            <p className="paciente-empty-text mb-0">
                              Aún no hay recetas registradas para este paciente.
                            </p>
                          ) : (
                            <div className="table-responsive doctor-reporte-table-wrapper">
                              <table className="table table-sm table-hover align-middle mb-0 doctor-reporte-table">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Cita</th>
                                    <th>Detalle</th>
                                    <th className="text-end">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recetas.map((receta) => {
                                    const fechaReceta = formatearFechaHora(
                                      receta.fecha ||
                                        receta.created_at ||
                                        receta.updated_at
                                    );

                                    const citaTexto =
                                      receta.cita?.fecha_hora
                                        ? formatearFechaHora(
                                            receta.cita.fecha_hora
                                          )
                                        : receta.cita_fecha
                                        ? formatearFechaHora(receta.cita_fecha)
                                        : receta.cita
                                        ? `ID ${receta.cita}`
                                        : "-";

                                    const detalle =
                                      receta.indicaciones_generales ||
                                      receta.notas ||
                                      (Array.isArray(receta.medicamentos) &&
                                        receta.medicamentos[0]?.nombre) ||
                                      "-";

                                    return (
                                      <tr key={receta.id}>
                                        <td>{fechaReceta}</td>
                                        <td className="small">{citaTexto}</td>
                                        <td className="small">{detalle}</td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() =>
                                              handleAbrirRecetaDesdeTabla(receta)
                                            }
                                          >
                                            Ver / editar
                                          </button>
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

                  {/* HISTORIAL DE PAGOS */}
                  <div className="row g-4 mt-4 doctor-reporte-row">
                    <div className="col-12">
                      <div className="card shadow-sm doctor-reporte-section-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Historial de pagos
                          </h2>

                          {pagos.length === 0 ? (
                            <p className="paciente-empty-text mb-0">
                              No se han registrado pagos para este paciente.
                            </p>
                          ) : (
                            <div className="table-responsive doctor-reporte-table-wrapper">
                              <table className="table table-sm table-hover align-middle mb-0 doctor-reporte-table">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Método</th>
                                    <th>Estado</th>
                                    <th>Total</th>
                                    <th>Pagado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pagos.map((pago) => {
                                    const fechaPago = formatearFechaHora(
                                      pago.fecha ||
                                        pago.created_at ||
                                        pago.updated_at
                                    );
                                    const metodo =
                                      pago.metodo_pago_display ||
                                      pago.metodo_pago ||
                                      "-";
                                    const estado =
                                      pago.estado_pago_display ||
                                      (pago.verificado
                                        ? "Verificado"
                                        : "Pendiente");

                                    return (
                                      <tr key={pago.id}>
                                        <td>{fechaPago}</td>
                                        <td>{metodo}</td>
                                        <td>{estado}</td>
                                        <td>{pago.total ?? pago.monto ?? "-"}</td>
                                        <td>
                                          {pago.pagado != null
                                            ? pago.pagado
                                            : pago.verificado
                                            ? pago.total ?? "-"
                                            : "-"}
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

                  {/* Modal de receta */}
                  <RecetaModal
                    show={showRecetaModal}
                    onClose={() => {
                      setShowRecetaModal(false);
                      setRecetaSeleccionada(null);
                    }}
                    paciente={paciente || { id: pacienteId }}
                    cita={
                      recetaSeleccionada &&
                      recetaSeleccionada.cita &&
                      typeof recetaSeleccionada.cita === "object"
                        ? recetaSeleccionada.cita
                        : null
                    }
                    // Compat: soporta ambas firmas del modal
                    initialReceta={recetaSeleccionada}
                    recetaInicial={recetaSeleccionada}
                    onSaved={handleRecetaGuardadaDesdeDetalle}
                    onRecetaGuardada={handleRecetaGuardadaDesdeDetalle}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ================================
  // RENDERIZADO MODO LISTA
  // ================================
  const totalReportes = reportes.length;

  return (
    <>
      <Navbar />

      <div className="doctor-reporte-page">
        <div className="doctor-reporte-wrapper">
          {/* HEADER */}
          <header className="doctor-reporte-header">
            <div className="doctor-reporte-header-left">
              <h1 className="doctor-reporte-title">
                Consultas clínicas (reportes)
              </h1>
              <p className="doctor-reporte-subtitle">
                {user.nombre} {user.apellidos} ·{" "}
                <span className="doctor-role-pill">{roleLabel}</span>
              </p>
            </div>

            <div className="doctor-reporte-header-right">
              <span className="doctor-reporte-badge-count">
                Registros: <strong>{totalReportes}</strong> reporte
                {totalReportes === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm doctor-reporte-back-btn"
                onClick={() => navigate("/doctor/pacientes")}
              >
                ← Volver a pacientes
              </button>
            </div>
          </header>

          {/* ERROR GLOBAL */}
          {error && (
            <div className="alert alert-danger doctor-reporte-error">
              {error}
            </div>
          )}

          {/* FILTROS */}
          <section className="doctor-reporte-filters-card">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-4">
                <label className="doctor-reporte-filters-label">
                  Estado del reporte
                </label>
                <select
                  className="form-select form-select-sm doctor-reporte-select"
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="FINAL">Final</option>
                  <option value="BORRADOR">Borrador</option>
                </select>
              </div>

              <div className="col-12 col-md-5">
                <label className="doctor-reporte-filters-label">
                  Buscar (paciente / resumen / diagnóstico)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm doctor-reporte-search-input"
                  placeholder="Ej. Juan Pérez, acné, dermatitis..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-3 text-md-end">
                {loadingFiltro && !loading && (
                  <span className="doctor-reporte-filters-status">
                    Actualizando resultados...
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* TABLA */}
          <section className="doctor-reporte-table-card">
            <TableLayout
              title="Reportes clínicos"
              columns={columns}
              data={reportesOrdenadosFiltrados}
              loading={loading}
              emptyMessage="No se encontraron reportes clínicos con los filtros actuales."
              enableSearch={false}
              enablePagination={false}
              striped={true}
              hover={true}
              rowKey="id"
              onRowClick={handleRowClick}
            />
          </section>
        </div>
      </div>
    </>
  );
};

export default DoctorReportePage;
