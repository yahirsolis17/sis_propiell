// src/pages/doctores/DoctorConsultaPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  Navigate,
} from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";

import { getPacienteById } from "../../services/pacientesService";
import { getCitasByPaciente } from "../../services/citasService";

import {
  crearReporte,
  actualizarReporte,
  getReporteUnicoPorCita,
} from "../../services/reportesService";
import { getRecetaUnicaPorCita } from "../../services/recetasService";

// 🔹 Utilidades compartidas (para estado cita y fecha)
import {
  formatearFechaHora,
  mapEstadoCita,
} from "../../components/clinicFormatters";

// 🔹 Servicios de procedimientos
import {
  getProcedimientos,
  crearProcedimiento,
  actualizarProcedimiento,
  eliminarProcedimiento,
} from "../../services/procedimientosService";

// 🔹 Sección de procedimientos dentro de la consulta
import ProcedimientosSection from "../../components/citas/ProcedimientosSection";

import RecetaModal from "../../components/citas/RecetaModal";
import "./DoctorConsultaPage.css";

/**
 * Utils locales
 */
const mapTipoCita = (tipo) => {
  if (tipo === "I") return "Inicial";
  if (tipo === "S") return "Subsecuente";
  return tipo || "-";
};

/**
 * Página principal de consulta
 */
const DoctorConsultaPage = () => {
  const navigate = useNavigate();
  const { pacienteId } = useParams();
  const location = useLocation();

  const [user] = useState(() => getCurrentUser());

  const [paciente, setPaciente] = useState(location.state?.paciente || null);
  const [ultimaCita, setUltimaCita] = useState(
    location.state?.ultimaCita || null
  );

  const [loadingInit, setLoadingInit] = useState(true);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [resumen, setResumen] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");

  const [showRecetaModal, setShowRecetaModal] = useState(false);

  // reporte / receta existentes
  const [existingReporte, setExistingReporte] = useState(null);
  const [existingReceta, setExistingReceta] = useState(null);
  const [loadingConsultaPrev, setLoadingConsultaPrev] = useState(false);
  const [errorConsultaPrev, setErrorConsultaPrev] = useState("");

  // 🔹 Estado para procedimientos
  const [procedimientos, setProcedimientos] = useState([]);
  const [loadingProcedimientos, setLoadingProcedimientos] = useState(false);
  const [errorProcedimientos, setErrorProcedimientos] = useState("");
  const [procedimientosReloadKey, setProcedimientosReloadKey] = useState(0);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDoctorOrAdmin = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"].includes(
    user.role
  );

  useEffect(() => {
    if (!isDoctorOrAdmin) {
      setError("No tienes permiso para realizar consultas.");
      setLoadingInit(false);
      return;
    }

    if (!pacienteId) {
      setError("Paciente no especificado.");
      setLoadingInit(false);
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

        // 1) Cargar paciente si no viene en state
        if (!paciente) {
          try {
            const res = await getPacienteById(pacienteId, controller.signal);
            if (isMounted) {
              setPaciente(res);
            }
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar paciente en consulta:", err);
              const detail =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                "Error al cargar los datos del paciente.";
              setError((prev) => prev || detail);
            }
          }
        }

        // 2) Resolver última cita en caso de no venir por state
        if (!ultimaCita) {
          try {
            const citas = await getCitasByPaciente(
              pacienteId,
              controller.signal
            );
            const ordenadas = Array.isArray(citas)
              ? [...citas].sort(
                  (a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)
                )
              : [];
            if (ordenadas.length > 0 && isMounted) {
              setUltimaCita(ordenadas[0]);
            }
          } catch (err) {
            if (!controller.signal.aborted && isMounted) {
              console.error("Error al cargar citas en consulta:", err);
              const detail =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                "Error al cargar el historial de citas.";
              setError((prev) => prev || detail);
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error inicializando consulta:", err);
          setError((prev) => prev || "Error inesperado al cargar la consulta.");
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoadingInit(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDoctorOrAdmin, pacienteId, paciente, ultimaCita, navigate]);

  /**
   * Cuando ya tenemos paciente + última cita,
   * consultamos si esa cita ya tiene reporte/receta.
   */
  useEffect(() => {
    if (!paciente || !ultimaCita?.id) return;

    const controller = new AbortController();
    let isActive = true;

    const fetchConsultaPrev = async () => {
      try {
        setLoadingConsultaPrev(true);
        setErrorConsultaPrev("");

        const [reporte, receta] = await Promise.all([
          getReporteUnicoPorCita({
            citaId: ultimaCita.id,
            signal: controller.signal,
          }),
          getRecetaUnicaPorCita({
            citaId: ultimaCita.id,
            signal: controller.signal,
          }),
        ]);

        if (!isActive) return;

        if (reporte) {
          setExistingReporte(reporte);
          setResumen(reporte.resumen || "");
          setDiagnostico(reporte.diagnostico || "");
          setRecomendaciones(reporte.recomendaciones || "");
        } else {
          setExistingReporte(null);
        }

        if (receta) {
          setExistingReceta(receta);
        } else {
          setExistingReceta(null);
        }
      } catch (err) {
        if (!controller.signal.aborted && isActive) {
          console.error("Error al cargar datos previos de la consulta:", err);
          setErrorConsultaPrev(
            "No se pudo cargar la información previa de la consulta. Puedes continuar, pero revisa los datos con cuidado."
          );
        }
      } finally {
        if (!controller.signal.aborted && isActive) {
          setLoadingConsultaPrev(false);
        }
      }
    };

    fetchConsultaPrev();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [paciente, ultimaCita]);

  /**
   * 🔹 Cargar procedimientos asociados al reporte/cita
   */
  useEffect(() => {
    if (!ultimaCita?.id && !existingReporte?.id) return;

    const controller = new AbortController();
    let isActive = true;

    const fetchProcedimientos = async () => {
      try {
        setLoadingProcedimientos(true);
        setErrorProcedimientos("");

        const params = {};
        if (existingReporte?.id) {
          params.reporte = existingReporte.id;
        }
        if (ultimaCita?.id) {
          params.cita = ultimaCita.id;
        }

        const data = await getProcedimientos(params, controller.signal);

        if (!isActive) return;

        setProcedimientos(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!controller.signal.aborted && isActive) {
          console.error("Error al cargar procedimientos:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "No se pudieron cargar los procedimientos de esta consulta.";
          setErrorProcedimientos(detail);
        }
      } finally {
        if (!controller.signal.aborted && isActive) {
          setLoadingProcedimientos(false);
        }
      }
    };

    fetchProcedimientos();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [ultimaCita?.id, existingReporte?.id, procedimientosReloadKey]);

  const citaContextInfo = useMemo(() => {
    if (!ultimaCita) return "Sin cita asociada (modo libre).";
    const estadoNormalizado = mapEstadoCita(ultimaCita.estado);
    return `${mapTipoCita(ultimaCita.tipo)} · ${formatearFechaHora(
      ultimaCita.fecha_hora
    )} · Estado: ${estadoNormalizado}`;
  }, [ultimaCita]);

  const handleVolver = () => {
    const from = location.state?.from;
    if (from === "doctor-paciente-detalle") {
      navigate(`/doctor/pacientes/${pacienteId}`, {
        state: { paciente },
      });
    } else if (from === "doctor-citas") {
      navigate("/doctor/citas");
    } else {
      navigate("/doctor/pacientes");
    }
  };

  const handleSubmitConsulta = async (e) => {
    e.preventDefault();
    setSavingConsulta(true);
    setError("");
    setSuccessMessage("");

    if (!paciente?.id) {
      setError(
        "No se encontró el paciente. Vuelve al listado e intenta de nuevo."
      );
      setSavingConsulta(false);
      return;
    }

    try {
      const payload = {
        paciente: paciente.id,
        cita: ultimaCita?.id || null,
        resumen,
        diagnostico,
        recomendaciones,
        estado: "FINAL",
      };

      let res;
      if (existingReporte) {
        res = await actualizarReporte(existingReporte.id, payload);
        setExistingReporte(res);
        setSuccessMessage("Consulta actualizada correctamente.");
      } else {
        res = await crearReporte(payload);
        setExistingReporte(res);
        setSuccessMessage("Consulta guardada correctamente.");
      }

      // Si antes no había reporte y ahora sí, forzamos recarga de procedimientos
      setProcedimientosReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("Error al guardar consulta:", err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Error al guardar la consulta. Revisa los campos.";
      setError(detail);
    } finally {
      setSavingConsulta(false);
    }
  };

  const handleAbrirReceta = () => {
    if (!resumen && !diagnostico && !recomendaciones) {
      const confirmar = window.confirm(
        "No has escrito nada en la consulta. ¿Deseas abrir la receta de todos modos?"
      );
      if (!confirmar) return;
    }
    setShowRecetaModal(true);
  };

  const handleRecetaGuardada = (recetaGuardada) => {
    setExistingReceta(recetaGuardada);
    setSuccessMessage(
      existingReceta
        ? "Receta actualizada correctamente."
        : "Consulta (si fue guardada) y receta registradas."
    );
  };

  // 🔹 Handlers de CRUD de procedimientos
  const handleCreateProcedimiento = async (partialData) => {
    if (!paciente?.id) {
      setErrorProcedimientos(
        "No se encontró el paciente para asociar el procedimiento."
      );
      return;
    }

    if (!existingReporte?.id && !ultimaCita?.id) {
      setErrorProcedimientos(
        "Guarda primero la consulta para habilitar el registro de procedimientos."
      );
      return;
    }

    try {
      setErrorProcedimientos("");

      const payload = {
        ...partialData,
        paciente: paciente.id,
        doctor: user?.id || null,
        cita: ultimaCita?.id || null,
        reporte: existingReporte?.id || null,
      };

      const creado = await crearProcedimiento(payload);
      setProcedimientos((prev) => [...prev, creado]);
    } catch (err) {
      console.error("Error al crear procedimiento:", err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Error al registrar el procedimiento.";
      setErrorProcedimientos(detail);
    }
  };

  const handleUpdateProcedimiento = async (id, partialData) => {
    if (!id) return;
    try {
      setErrorProcedimientos("");

      const actualizado = await actualizarProcedimiento(id, partialData);

      setProcedimientos((prev) =>
        prev.map((p) => (p.id === id ? actualizado : p))
      );
    } catch (err) {
      console.error("Error al actualizar procedimiento:", err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Error al actualizar el procedimiento.";
      setErrorProcedimientos(detail);
    }
  };

  const handleDeleteProcedimiento = async (id) => {
    if (!id) return;
    try {
      setErrorProcedimientos("");
      await eliminarProcedimiento(id);
      setProcedimientos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error al eliminar procedimiento:", err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Error al eliminar el procedimiento.";
      setErrorProcedimientos(detail);
    }
  };

  if (!isDoctorOrAdmin) {
    return (
      <>
        <Navbar />
        <div className="doctor-consulta-root">
          <div className="doctor-consulta-page">
            <div className="doctor-consulta-inner">
              <div className="alert alert-danger doctor-consulta-alert-full">
                No tienes permiso para acceder a esta sección.
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
      <div className="doctor-consulta-root">
        <div className="doctor-consulta-page">
          <div className="doctor-consulta-inner">
            {loadingInit ? (
              <div className="doctor-consulta-loading">
                Cargando datos de la consulta...
              </div>
            ) : (
              <>
                {/* HEADER */}
                <header className="doctor-consulta-header">
                  <div className="doctor-consulta-header-content">
                    <div className="doctor-consulta-header-left">
                      <h1 className="doctor-consulta-title">Consulta clínica</h1>
                      <p className="doctor-consulta-subtitle">
                        Registra el resumen, diagnóstico y plan de manejo del
                        paciente.
                      </p>
                      <div className="doctor-consulta-paciente-info">
                        <span>
                          Paciente:{" "}
                          {paciente ? (
                            <strong>
                              {paciente.nombre} {paciente.apellidos}
                            </strong>
                          ) : (
                            "Cargando paciente..."
                          )}
                        </span>
                        <span>
                          Edad: <strong>{paciente?.edad ?? "-"}</strong> · Sexo:{" "}
                          <strong>{paciente?.sexo || "-"}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="doctor-consulta-header-right">
                      <div className="doctor-consulta-chip">
                        <span className="doctor-consulta-chip-label">
                          Cita asociada
                        </span>
                        <span className="doctor-consulta-chip-value">
                          {citaContextInfo}
                        </span>
                      </div>

                      <div className="doctor-consulta-actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={handleVolver}
                        >
                          ← Volver
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleAbrirReceta}
                          disabled={!paciente || savingConsulta}
                        >
                          {existingReceta
                            ? "Ver / editar receta"
                            : "Recetar tratamiento"}
                        </button>
                      </div>
                    </div>
                  </div>
                </header>

                {/* BODY */}
                <section className="doctor-consulta-body">
                  <div className="doctor-consulta-messages">
                    {loadingConsultaPrev && (
                      <div className="alert alert-info py-2 mb-2 small">
                        Cargando información previa de la consulta...
                      </div>
                    )}

                    {errorConsultaPrev && (
                      <div className="alert alert-warning py-2 mb-2 small">
                        {errorConsultaPrev}
                      </div>
                    )}

                    {existingReporte && (
                      <div className="alert alert-success py-2 mb-2 small">
                        Esta cita ya tiene una consulta registrada. Puedes
                        actualizar el reporte clínico con la información más
                        reciente.
                      </div>
                    )}

                    {existingReceta && (
                      <div className="alert alert-secondary py-2 mb-2 small">
                        Esta cita ya tiene una receta médica registrada.
                        Cualquier cambio se realizará sobre la misma receta (no
                        se creará una nueva).
                      </div>
                    )}

                    {error && (
                      <div className="alert alert-danger py-2 mb-2 small">
                        {error}
                      </div>
                    )}
                    {successMessage && (
                      <div className="alert alert-success py-2 mb-2 small">
                        {successMessage}
                      </div>
                    )}
                  </div>

                  {/* Card de reporte / consulta */}
                  <div className="doctor-consulta-card">
                    <form onSubmit={handleSubmitConsulta}>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Motivo / resumen de la consulta
                        </label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={resumen}
                          onChange={(e) => setResumen(e.target.value)}
                          placeholder="Descripción general del motivo de la consulta, evolución, antecedentes relevantes..."
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Diagnóstico
                        </label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={diagnostico}
                          onChange={(e) => setDiagnostico(e.target.value)}
                          placeholder="Diagnóstico principal y diagnósticos diferenciales..."
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Recomendaciones / plan
                        </label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={recomendaciones}
                          onChange={(e) =>
                            setRecomendaciones(e.target.value)
                          }
                          placeholder="Plan de manejo, cuidados, recomendaciones y seguimiento..."
                        />
                      </div>

                      <div className="doctor-consulta-footer-row">
                        <small>
                          Esta consulta se guardará como parte del historial
                          clínico del paciente.
                        </small>

                        <div className="doctor-consulta-footer-actions">
                          <button
                            type="submit"
                            className="btn btn-success"
                            disabled={savingConsulta || !paciente}
                          >
                            {savingConsulta
                              ? "Guardando consulta..."
                              : existingReporte
                              ? "Actualizar consulta"
                              : "Guardar consulta"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={handleAbrirReceta}
                            disabled={!paciente || savingConsulta}
                          >
                            {existingReceta
                              ? "Guardar y ver/editar receta"
                              : "Guardar y recetar"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* 🔹 Card de procedimientos dentro de la consulta */}
                  <div className="doctor-consulta-card mt-3">
                    <h5 className="mb-3">Procedimientos realizados en la consulta</h5>

                    {errorProcedimientos && (
                      <div className="alert alert-danger py-2 mb-3 small">
                        {errorProcedimientos}
                      </div>
                    )}

                    {existingReporte ? (
                      <>
                        {loadingProcedimientos && !errorProcedimientos && (
                          <div className="alert alert-info py-2 mb-3 small">
                            Cargando procedimientos de esta consulta...
                          </div>
                        )}

                        <ProcedimientosSection
                          procedimientos={procedimientos}
                          loading={loadingProcedimientos}
                          error={null} // el mensaje de error ya se muestra arriba
                          onCreate={handleCreateProcedimiento}
                          onUpdate={handleUpdateProcedimiento}
                          onDelete={handleDeleteProcedimiento}
                          readOnly={false}
                        />
                      </>
                    ) : (
                      <div className="alert alert-info py-2 small mb-0">
                        Guarda primero la consulta para habilitar el registro de
                        procedimientos asociados.
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Modal de receta dentro del root */}
          <RecetaModal
            show={showRecetaModal}
            onClose={() => setShowRecetaModal(false)}
            paciente={paciente}
            cita={ultimaCita}
            // Compatibilidad con ambas firmas del modal
            initialReceta={existingReceta}
            recetaInicial={existingReceta}
            onSaved={handleRecetaGuardada}
            onRecetaGuardada={handleRecetaGuardada}
          />
        </div>
      </div>
    </>
  );
};

export default DoctorConsultaPage;
