// frontend/src/pages/doctores/DoctorPacienteDetallePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  Navigate,
} from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getPacienteById,
  getCitasByPaciente,
} from "../../services/pacientesService";
import { getReportesByPaciente } from "../../services/reportesService";
import { getRecetasByPaciente } from "../../services/recetasService";
import { getPagosByPaciente } from "../../services/pagosService";
import { requiereConsentimiento } from "../../utils/clinicRules";

import RecetaModal from "../../components/citas/RecetaModal";

import "./DoctorPacienteDetallePage.css";

const mapTipoCita = (tipo) => {
  if (tipo === "I") return "Inicial";
  if (tipo === "S") return "Subsecuente";
  return tipo || "-";
};

const formatearFechaHora = (fechaStr) => {
  if (!fechaStr) return "-";
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return fechaStr;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const DoctorPacienteDetallePage = () => {
  const navigate = useNavigate();
  const { pacienteId } = useParams();
  const location = useLocation();

  const [user] = useState(() => getCurrentUser());

  const [paciente, setPaciente] = useState(location.state?.paciente || null);
  const [citas, setCitas] = useState([]);

  const [reportes, setReportes] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [pagos, setPagos] = useState([]);

  const [loadingPaciente, setLoadingPaciente] = useState(true);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [loadingReportes, setLoadingReportes] = useState(true);
  const [loadingRecetas, setLoadingRecetas] = useState(true);
  const [loadingPagos, setLoadingPagos] = useState(true);

  const [error, setError] = useState("");

  const [showRecetaModal, setShowRecetaModal] = useState(false);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDoctorOrAdmin = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"].includes(
    user.role
  );

  useEffect(() => {
    if (!isDoctorOrAdmin) {
      setError("No tienes permiso para ver el detalle de este paciente.");
      setLoadingPaciente(false);
      setLoadingCitas(false);
      setLoadingReportes(false);
      setLoadingRecetas(false);
      setLoadingPagos(false);
      return;
    }

    if (!pacienteId) {
      setError("Paciente no especificado.");
      setLoadingPaciente(false);
      setLoadingCitas(false);
      setLoadingReportes(false);
      setLoadingRecetas(false);
      setLoadingPagos(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const init = async () => {
      try {
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        // 1) Cargar datos del paciente (solo si no venía en location.state)
        if (!paciente) {
          try {
            const res = await getPacienteById(pacienteId, controller.signal);
            if (isMounted) {
              setPaciente(res);
            }
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar paciente:", err);
              const detail =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                "Error al cargar los datos del paciente.";
              setError((prev) => prev || detail);
            }
          } finally {
            if (isMounted) {
              setLoadingPaciente(false);
            }
          }
        } else if (isMounted) {
          // Ya traíamos el paciente desde la navegación previa
          setLoadingPaciente(false);
        }

        // 2) Cargar citas del paciente
        try {
          const citasData = await getCitasByPaciente(
            pacienteId,
            controller.signal
          );
          if (isMounted) {
            setCitas(Array.isArray(citasData) ? citasData : []);
          }
        } catch (err) {
          if (!controller.signal.aborted && isMounted) {
            console.error("Error al cargar citas del paciente:", err);
            const detail =
              err.response?.data?.detail ||
              err.response?.data?.error ||
              "Error al cargar el historial de citas.";
            setError((prev) => prev || detail);
          }
        } finally {
          if (isMounted) {
            setLoadingCitas(false);
          }
        }

        // 3) Cargar reportes clínicos
        try {
          const reportesData = await getReportesByPaciente(
            pacienteId,
            controller.signal
          );
          if (isMounted) {
            setReportes(Array.isArray(reportesData) ? reportesData : []);
          }
        } catch (err) {
          if (!controller.signal.aborted && isMounted) {
            console.error("Error al cargar reportes del paciente:", err);
            const detail =
              err.response?.data?.detail ||
              err.response?.data?.error ||
              "Error al cargar las consultas clínicas del paciente.";
            setError((prev) => prev || detail);
          }
        } finally {
          if (isMounted) {
            setLoadingReportes(false);
          }
        }

        // 4) Cargar recetas
        try {
          const recetasData = await getRecetasByPaciente(
            pacienteId,
            controller.signal
          );
          if (isMounted) {
            setRecetas(Array.isArray(recetasData) ? recetasData : []);
          }
        } catch (err) {
          if (!controller.signal.aborted && isMounted) {
            console.error("Error al cargar recetas del paciente:", err);
            const detail =
              err.response?.data?.detail ||
              err.response?.data?.error ||
              "Error al cargar las recetas del paciente.";
            setError((prev) => prev || detail);
          }
        } finally {
          if (isMounted) {
            setLoadingRecetas(false);
          }
        }

        // 5) Cargar pagos
        try {
          const pagosData = await getPagosByPaciente(
            pacienteId,
            controller.signal
          );
          if (isMounted) {
            setPagos(Array.isArray(pagosData) ? pagosData : []);
          }
        } catch (err) {
          if (!controller.signal.aborted && isMounted) {
            console.error("Error al cargar pagos del paciente:", err);
            const detail =
              err.response?.data?.detail ||
              err.response?.data?.error ||
              "Error al cargar el historial de pagos.";
            setError((prev) => prev || detail);
          }
        } finally {
          if (isMounted) {
            setLoadingPagos(false);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error inicializando detalle del paciente:", err);
          setError(
            (prev) => prev || "Error inesperado al cargar la información."
          );
          setLoadingPaciente(false);
          setLoadingCitas(false);
          setLoadingReportes(false);
          setLoadingRecetas(false);
          setLoadingPagos(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDoctorOrAdmin, pacienteId, navigate, paciente]);

  const loading =
    loadingPaciente ||
    loadingCitas ||
    loadingReportes ||
    loadingRecetas ||
    loadingPagos;

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

  const handleVolver = () => {
    navigate("/doctor/pacientes");
  };

  const handleIniciarConsulta = () => {
    if (!paciente?.id) return;

    navigate(`/doctor/pacientes/${paciente.id}/consulta`, {
      state: {
        paciente,
        ultimaCita,
        from: "doctor-paciente-detalle",
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

  return (
    <>
      <Navbar />
      <div className="doctor-paciente-container">
        <div className="doctor-paciente-page">
          <div className="doctor-paciente-content">
            {loading ? (
              <div className="doctor-paciente-loading">
                Cargando información del paciente...
              </div>
            ) : error ? (
              <div className="row">
                <div className="col-12 mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleVolver}
                  >
                    ← Volver a pacientes
                  </button>
                </div>
                <div className="col-12">
                  <div className="doctor-paciente-error-card mb-0">
                    {error}
                  </div>
                </div>
              </div>
            ) : !paciente ? (
              <div className="row">
                <div className="col-12 mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleVolver}
                  >
                    ← Volver a pacientes
                  </button>
                </div>
                <div className="col-12">
                  <div className="alert alert-warning mb-0">
                    No se encontró la información del paciente.
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="doctor-paciente-header">
                  <div className="doctor-paciente-header-content">
                    <div className="doctor-paciente-header-left">
                      <h1 className="doctor-paciente-title">
                        {paciente.nombre} {paciente.apellidos}
                      </h1>
                      <p className="doctor-paciente-subtitle">
                        Vista consolidada del historial clínico, recetas y
                        pagos del paciente.
                      </p>
                      <div className="doctor-paciente-meta">
                        <span>
                          Edad:{" "}
                          <strong>{paciente.edad ?? "-"}</strong> años · Sexo:{" "}
                          <strong>{paciente.sexo || "-"}</strong>
                        </span>
                        <span>
                          Teléfono:{" "}
                          <strong>{paciente.telefono || "-"}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="doctor-paciente-header-right">
                      <div className="doctor-paciente-actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={handleVolver}
                        >
                          ← Volver a pacientes
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleIniciarConsulta}
                          disabled={!paciente}
                        >
                          Iniciar consulta
                        </button>
                      </div>

                      <div className="doctor-paciente-summary-chip d-none d-md-block">
                        <strong>Total citas:</strong> {citas.length} ·{" "}
                        <strong>Subsecuentes:</strong>{" "}
                        {citasSubsecuentes.length}
                        <br />
                        <strong>Última cita:</strong>{" "}
                        {ultimaCita
                          ? formatearFechaHora(ultimaCita.fecha_hora)
                          : "Sin citas"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 1: Resumen + historial de citas */}
                <div className="row g-4 doctor-paciente-row">
                  {/* Resumen rápido */}
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm h-100 doctor-paciente-section-card paciente-resumen-card">
                      <div className="card-body">
                        <h2 className="paciente-section-title">
                          Resumen clínico rápido
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
                            <strong>Última cita:</strong>{" "}
                            {ultimaCita
                              ? formatearFechaHora(ultimaCita.fecha_hora)
                              : "Sin citas registradas"}
                          </li>
                          <li>
                            <strong>Último estado:</strong>{" "}
                            {ultimaCita?.estado || "N/A"}
                          </li>
                          <li>
                            <strong>Consentimiento:</strong>{" "}
                            {!requiereConsentimiento(ultimaCita)
                              ? "No aplica"
                              : ultimaCita?.consentimiento_completado
                              ? "Completo"
                              : "Pendiente"}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Historial de citas */}
                  <div className="col-12 col-lg-8">
                    <div className="card shadow-sm doctor-paciente-section-card">
                      <div className="card-body">
                        <h2 className="paciente-section-title">
                          Historial de citas
                        </h2>

                        {citas.length === 0 ? (
                          <p className="paciente-empty-text mb-0">
                            Este paciente aún no tiene citas registradas contigo.
                          </p>
                        ) : (
                          <div className="table-responsive doctor-paciente-table-wrapper">
                            <table className="table table-sm table-hover align-middle mb-0 doctor-paciente-table">
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

                {/* ROW 2: Reportes clínicos y Recetas */}
                <div className="row g-4 mt-4 doctor-paciente-row">
                  {/* Reportes / consultas */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm h-100 doctor-paciente-section-card">
                      <div className="card-body">
                        <h2 className="paciente-section-title">
                          Consultas clínicas (reportes)
                        </h2>

                        {reportes.length === 0 ? (
                          <p className="paciente-empty-text mb-0">
                            Aún no hay consultas clínicas registradas para este
                            paciente.
                          </p>
                        ) : (
                          <div className="table-responsive doctor-paciente-table-wrapper">
                            <table className="table table-sm table-hover align-middle mb-0 doctor-paciente-table">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Estado</th>
                                  <th>Resumen</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportes.map((reporte) => {
                                  const fechaReporte = formatearFechaHora(
                                    reporte.fecha ||
                                      reporte.created_at ||
                                      reporte.updated_at
                                  );
                                  return (
                                    <tr key={reporte.id}>
                                      <td>{fechaReporte}</td>
                                      <td>{reporte.estado || "-"}</td>
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

                  {/* Recetas */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm h-100 doctor-paciente-section-card">
                      <div className="card-body">
                        <h2 className="paciente-section-title">
                          Recetas médicas
                        </h2>

                        {recetas.length === 0 ? (
                          <p className="paciente-empty-text mb-0">
                            Aún no hay recetas registradas para este paciente.
                          </p>
                        ) : (
                          <div className="table-responsive doctor-paciente-table-wrapper">
                            <table className="table table-sm table-hover align-middle mb-0 doctor-paciente-table">
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

                {/* ROW 3: Historial de pagos */}
                <div className="row g-4 mt-4 doctor-paciente-row">
                  <div className="col-12">
                    <div className="card shadow-sm doctor-paciente-section-card">
                      <div className="card-body">
                        <h2 className="paciente-section-title">
                          Historial de pagos
                        </h2>

                        {pagos.length === 0 ? (
                          <p className="paciente-empty-text mb-0">
                            No se han registrado pagos para este paciente.
                          </p>
                        ) : (
                          <div className="table-responsive doctor-paciente-table-wrapper">
                            <table className="table table-sm table-hover align-middle mb-0 doctor-paciente-table">
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

                {/* Modal de receta desde ficha del paciente */}
                <RecetaModal
                  show={showRecetaModal}
                  onClose={() => {
                    setShowRecetaModal(false);
                    setRecetaSeleccionada(null);
                  }}
                  paciente={paciente}
                  cita={
                    recetaSeleccionada &&
                    recetaSeleccionada.cita &&
                    typeof recetaSeleccionada.cita === "object"
                      ? recetaSeleccionada.cita
                      : null
                  }
                  recetaInicial={recetaSeleccionada}
                  onRecetaGuardada={handleRecetaGuardadaDesdeDetalle}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DoctorPacienteDetallePage;
