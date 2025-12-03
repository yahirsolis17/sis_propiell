// src/pages/doctores/DoctorReportePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import Navbar from "../../components/Navbar";
import TableLayout from "../../components/TableLayout";
import RecetaModal from "../../components/citas/RecetaModal";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getReportes,
  getReportesByPaciente,
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

  const [loadingPaciente, setLoadingPaciente] = useState(false); // reservado si después vuelves a pedir paciente directo
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

          // Reportes del paciente
          try {
            const reportesData = await getReportesByPaciente(
              pacienteId,
              controller.signal
            );
            if (isMounted) {
              setPacienteReportes(
                Array.isArray(reportesData) ? reportesData : []
              );

              // Tomar datos básicos del paciente del primer reporte
              if (reportesData.length > 0 && reportesData[0].paciente) {
                const pacienteData = reportesData[0].paciente;
                if (typeof pacienteData === "object") {
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

          // Citas del paciente
          try {
            const citasData = await getCitasByPaciente(
              pacienteId,
              controller.signal
            );
            if (isMounted) setCitas(Array.isArray(citasData) ? citasData : []);

            // Si no tenemos paciente por reportes, intentamos desde citas
            if (
              isMounted &&
              !paciente &&
              citasData.length > 0 &&
              citasData[0].paciente
            ) {
              const pacienteData = citasData[0].paciente;
              if (typeof pacienteData === "object") {
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

          // Recetas
          try {
            const recetasData = await getRecetasByPaciente(
              pacienteId,
              controller.signal
            );
            if (isMounted)
              setRecetas(Array.isArray(recetasData) ? recetasData : []);
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar recetas:", err);
            }
          } finally {
            if (isMounted) setLoadingRecetas(false);
          }

          // Pagos
          try {
            const pagosData = await getPagosByPaciente(
              pacienteId,
              controller.signal
            );
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
            setLoadingPaciente(false);
          }
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDoctorOrAdmin, pacienteId, estadoFilter, navigate, user.id, user.role, paciente]);

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
    const pid =
      typeof pacienteField === "object"
        ? pacienteField.id || pacienteField.pk
        : reporte.paciente_id || reporte.paciente;

    if (!pid) return;

    navigate(`/doctor/reportes/paciente/${pid}`);
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
  const columnsLista = [
    {
      id: "fecha",
      label: "Fecha",
      render: (reporte) => formatearFechaHora(getFechaReporteBase(reporte)),
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

  // 🧱 Columnas modo detalle: historial de citas
  const columnsCitas = [
    {
      id: "fecha_hora",
      label: "Fecha y hora",
      render: (cita) => formatearFechaHora(cita.fecha_hora),
    },
    {
      id: "tipo",
      label: "Tipo",
      render: (cita) => mapTipoCita(cita.tipo),
    },
    {
      id: "estado",
      label: "Estado",
      render: (cita) => cita.estado || "-",
    },
    {
      id: "pago",
      label: "Pago",
      render: (cita) => {
        const ultimoPago = (cita.pagos || [])[0];
        if (!ultimoPago) {
          return <span className="text-muted">Sin pago registrado</span>;
        }
        return (
          <>
            {ultimoPago.estado_pago_display} · {ultimoPago.metodo_pago_display}
          </>
        );
      },
    },
    {
      id: "consentimiento",
      label: "Consentimiento",
      render: (cita) => {
        if (!requiereConsentimiento(cita)) {
          return (
            <span className="badge bg-light text-muted">No aplica</span>
          );
        }
        return cita.consentimiento_completado ? (
          <span className="badge bg-success">Completo</span>
        ) : (
          <span className="badge bg-secondary">Pendiente</span>
        );
      },
    },
  ];

  // 🧱 Columnas modo detalle: reportes del paciente
  const columnsReportesPaciente = [
    {
      id: "fecha",
      label: "Fecha",
      render: (reporte) =>
        formatearFechaHora(getFechaReporteBase(reporte)),
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
      label: "Resumen",
      render: (reporte) => (
        <span className="small">
          {reporte.resumen || reporte.diagnostico || "-"}
        </span>
      ),
    },
  ];

  // 🧱 Columnas modo detalle: recetas del paciente
  const columnsRecetasPaciente = [
    {
      id: "fecha",
      label: "Fecha",
      render: (receta) =>
        formatearFechaHora(
          receta.fecha || receta.created_at || receta.updated_at
        ),
    },
    {
      id: "cita",
      label: "Cita",
      render: (receta) => {
        const citaTexto = receta.cita?.fecha_hora
          ? formatearFechaHora(receta.cita.fecha_hora)
          : receta.cita_fecha
          ? formatearFechaHora(receta.cita_fecha)
          : receta.cita
          ? `ID ${receta.cita}`
          : "-";
        return <span className="small">{citaTexto}</span>;
      },
    },
    {
      id: "detalle",
      label: "Detalle",
      render: (receta) => {
        const detalle =
          receta.indicaciones_generales ||
          receta.notas ||
          (Array.isArray(receta.medicamentos) &&
            receta.medicamentos[0]?.nombre) ||
          "-";
        return <span className="small">{detalle}</span>;
      },
    },
    {
      id: "acciones",
      label: "Acciones",
      render: (receta) => (
        <div className="text-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleAbrirRecetaDesdeTabla(receta)}
          >
            Ver / editar
          </button>
        </div>
      ),
    },
  ];

  // 🧱 Columnas modo detalle: pagos del paciente
  const columnsPagosPaciente = [
    {
      id: "fecha",
      label: "Fecha",
      render: (pago) =>
        formatearFechaHora(
          pago.fecha || pago.created_at || pago.updated_at
        ),
    },
    {
      id: "metodo",
      label: "Método",
      render: (pago) =>
        pago.metodo_pago_display || pago.metodo_pago || "-",
    },
    {
      id: "estado",
      label: "Estado",
      render: (pago) => {
        const estado =
          pago.estado_pago_display ||
          (pago.verificado ? "Verificado" : "Pendiente");
        return <span>{estado}</span>;
      },
    },
    {
      id: "total",
      label: "Total",
      render: (pago) => pago.total ?? pago.monto ?? "-",
    },
    {
      id: "pagado",
      label: "Pagado",
      render: (pago) =>
        pago.pagado != null
          ? pago.pagado
          : pago.verificado
          ? pago.total ?? "-"
          : "-",
    },
  ];

  // ================================
  // RENDERIZADO MODO DETALLE
  // ================================
  if (pacienteId) {
    const loadingDetalle =
      loadingCitas ||
      loadingPacienteReportes ||
      loadingRecetas ||
      loadingPagos ||
      loadingPaciente;

    const tieneDatos =
      pacienteReportes.length > 0 ||
      citas.length > 0 ||
      recetas.length > 0 ||
      pagos.length > 0;

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
                          {paciente
                            ? `${paciente.nombre} ${paciente.apellidos}`
                            : `Paciente #${pacienteId}`}
                        </h1>
                        <p className="doctor-reporte-subtitle">
                          Vista consolidada del historial clínico, recetas y
                          pagos del paciente.
                        </p>
                        {paciente && (
                          <div className="doctor-reporte-meta">
                            <span>
                              Edad:{" "}
                              <strong>{paciente.edad ?? "-"}</strong> años ·
                              Sexo: <strong>{paciente.sexo || "-"}</strong>
                            </span>
                            <span>
                              Teléfono:{" "}
                              <strong>{paciente.telefono || "-"}</strong>
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
                              <strong>Registros de pago:</strong>{" "}
                              {pagos.length}
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

                          <TableLayout
                            columns={columnsCitas}
                            data={citasOrdenadas}
                            loading={loadingCitas}
                            emptyMessage="Este paciente aún no tiene citas registradas contigo."
                            enableSearch={false}
                            enablePagination={false}
                            striped
                            hover
                            rowKey="id"
                          />
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

                          <TableLayout
                            columns={columnsReportesPaciente}
                            data={pacienteReportes}
                            loading={loadingPacienteReportes}
                            emptyMessage="Aún no hay consultas clínicas registradas para este paciente."
                            enableSearch={false}
                            enablePagination={false}
                            striped
                            hover
                            rowKey="id"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-6">
                      <div className="card shadow-sm h-100 doctor-reporte-section-card">
                        <div className="card-body">
                          <h2 className="paciente-section-title">
                            Recetas médicas
                          </h2>

                          <TableLayout
                            columns={columnsRecetasPaciente}
                            data={recetas}
                            loading={loadingRecetas}
                            emptyMessage="Aún no hay recetas registradas para este paciente."
                            enableSearch={false}
                            enablePagination={false}
                            striped
                            hover
                            rowKey="id"
                          />
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

                          <TableLayout
                            columns={columnsPagosPaciente}
                            data={pagos}
                            loading={loadingPagos}
                            emptyMessage="No se han registrado pagos para este paciente."
                            enableSearch={false}
                            enablePagination={false}
                            striped
                            hover
                            rowKey="id"
                          />
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
                <span className="doctor-reporte-count">{totalReportes}</span>
                <span className="doctor-reporte-label">
                  Reporte{totalReportes === 1 ? "" : "s"}
                </span>
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

          {/* TABLA LISTA */}
          <section className="doctor-reporte-table-card">
            <TableLayout
              title="Reportes clínicos"
              columns={columnsLista}
              data={reportesOrdenadosFiltrados}
              loading={loading}
              emptyMessage="No se encontraron reportes clínicos con los filtros actuales."
              enableSearch={false}
              enablePagination={false}
              striped
              hover
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
