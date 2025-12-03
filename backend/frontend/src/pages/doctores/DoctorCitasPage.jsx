// src/pages/doctores/DoctorCitasPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  FiMoreVertical,
  FiFileText,
  FiActivity,
  FiCalendar,
  FiUser,
  FiStar,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiHeart,
  FiPlusCircle,
  FiRepeat,
} from "react-icons/fi";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getCitasByDoctor,
  getHorariosDisponibles,
  programarSubsecuenteDesdeCita,
  reprogramarCita,
} from "../../services/citasService";
import { getReportes } from "../../services/reportesService";
import {
  formatearFechaHora,
  mapEstadoCita,
} from "../../components/clinicFormatters";

import TimeSlotSelector from "../../components/citas/TimeSlotSelector";
import ConsultModal from "../../components/citas/ConsultModal";

import "./DoctorCitasPage.css";

const DoctorCitasPage = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true); // solo para primer load
  const [isRefetching, setIsRefetching] = useState(false); // filtros posteriores
  const [error, setError] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODAS");

  // Modal de detalles de cita
  const [selectedCita, setSelectedCita] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Menú contextual
  const [openMenuId, setOpenMenuId] = useState(null);

  // Mapa de citas que ya tienen consulta (reporte FINAL)
  const [citasConConsulta, setCitasConConsulta] = useState({});

  // Control de primer load vs refetch
  const hasLoadedOnceRef = useRef(false);

  // 🔁 Trigger para recargar citas después de subsecuente/reprogramación
  const [reloadToken, setReloadToken] = useState(0);

  // Modal de fecha/hora (subsecuente / reprogramar)
  const [selectedCitaFecha, setSelectedCitaFecha] = useState(null);
  const [showFechaModal, setShowFechaModal] = useState(false);
  const [modalMode, setModalMode] = useState(null); // "subsecuente" | "reprogramar"
  const [modalSelectedDate, setModalSelectedDate] = useState(""); // texto YYYY-MM-DD
  const [modalSelectedTime, setModalSelectedTime] = useState("");
  const [modalHorarios, setModalHorarios] = useState([]);
  const [modalLoadingHorarios, setModalLoadingHorarios] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🔐 Verificación de autenticación
  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
        }
      }
    };

    if (user) checkAuth();
    return () => controller.abort();
  }, [user, navigate]);

  const getFechaISO = (date) => {
    if (!date) return null;
    try {
      if (typeof date === "string") {
        const normalized = date.trim().replace(/[\/.]/g, "-");
        const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!match) return null;
        const [, y, m, d] = match;
        const mm = m.padStart(2, "0");
        const dd = d.padStart(2, "0");
        return `${y}-${mm}-${dd}`;
      }
      return date.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  // 📥 Cargar citas del doctor (primer load + filtros + recargas)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCitas = async () => {
      try {
        if (!hasLoadedOnceRef.current) {
          setLoading(true); // solo la primera carga
        } else {
          setIsRefetching(true); // luego, transición más suave
        }

        setError("");
        setCitasConConsulta({});

        const estadoParam = filtroEstado === "TODAS" ? undefined : filtroEstado;

        const data = await getCitasByDoctor(user.id, {
          estado: estadoParam,
          signal: controller.signal,
        });

        if (!isMounted) return;

        const citasList = data || [];
        setCitas(citasList);

        // 🔍 Cargar consultas asociadas (reportes en estado FINAL)
        try {
          if (citasList.length === 0) {
            setCitasConConsulta({});
          } else {
            const citasIds = citasList
              .map((c) => c.id)
              .filter((id) => id !== null && id !== undefined);

            const reportes = await getReportes(
              { doctor: user.id, estado: "FINAL" },
              controller.signal
            );

            if (!isMounted) return;

            const map = {};
            if (Array.isArray(reportes)) {
              reportes.forEach((rep) => {
                const citaField = rep.cita;
                const citaId =
                  citaField && typeof citaField === "object"
                    ? citaField.id
                    : citaField;

                if (citaId && citasIds.includes(citaId)) {
                  map[citaId] = true;
                }
              });
            }
            setCitasConConsulta(map);
          }
        } catch (innerErr) {
          if (!isMounted || controller.signal.aborted) return;
          console.error("Error cargando consultas asociadas:", innerErr);
          setCitasConConsulta({});
        }
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error cargando citas del doctor:", err);
        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }
        setError(
          "Error cargando las citas. Intenta de nuevo en unos momentos."
        );
      } finally {
        if (!isMounted) return;
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setIsRefetching(false);
      }
    };

    loadCitas();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user.id, filtroEstado, navigate, reloadToken]);

  // 🔍 Cerrar menú de opciones al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".acciones-container")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // 🕒 Cargar horarios para el modal de subsecuente/reprogramar
  useEffect(() => {
    if (!showFechaModal || !selectedCitaFecha || !modalSelectedDate) {
      setModalHorarios([]);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchHorarios = async () => {
      try {
        setModalLoadingHorarios(true);
        setModalError("");

        const fechaISO = getFechaISO(modalSelectedDate);
        if (!fechaISO) {
          setModalHorarios([]);
          return;
        }

        const especialidadId =
          selectedCitaFecha.especialidad?.id || selectedCitaFecha.especialidad;

        if (!especialidadId) {
          setModalError(
            "No se encontró la especialidad asociada a la cita. Contacta al administrador."
          );
          setModalHorarios([]);
          return;
        }

        const horas = await getHorariosDisponibles(
          especialidadId,
          fechaISO,
          controller.signal
        );

        if (!isMounted) return;
        setModalHorarios(horas || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error cargando horarios para la cita:", err);
          setModalError(
            "Error cargando horarios disponibles. Intenta cambiar la fecha o recargar la página."
          );
          setModalHorarios([]);
        }
      } finally {
        if (isMounted) {
          setModalLoadingHorarios(false);
        }
      }
    };

    fetchHorarios();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showFechaModal, selectedCitaFecha, modalSelectedDate]);

  const openConsultModal = (cita) => {
    setSelectedCita(cita);
    setShowModal(true);
    setOpenMenuId(null);
  };

  const closeConsultModal = () => {
    setSelectedCita(null);
    setShowModal(false);
  };

  const handleIniciarConsulta = (cita) => {
    const pacienteId = cita?.paciente?.id;

    if (!pacienteId) {
      console.warn("No se encontró id de paciente en la cita:", cita);
      return;
    }

    navigate(`/doctor/pacientes/${pacienteId}/consulta`, {
      state: {
        paciente: cita.paciente,
        ultimaCita: cita,
        from: "doctor-citas",
      },
    });
    setOpenMenuId(null);
  };

  const openFechaModal = (mode, cita) => {
    setModalMode(mode); // "subsecuente" | "reprogramar"
    setSelectedCitaFecha(cita);
    setModalSelectedDate("");
    setModalSelectedTime("");
    setModalHorarios([]);
    setModalError("");
    setShowFechaModal(true);
    setOpenMenuId(null);
  };

  const closeFechaModal = () => {
    setShowFechaModal(false);
    setSelectedCitaFecha(null);
    setModalMode(null);
    setModalSelectedDate("");
    setModalSelectedTime("");
    setModalHorarios([]);
    setModalError("");
  };

  const handleSubmitFechaModal = async (e) => {
    e.preventDefault();
    if (!selectedCitaFecha || !modalMode) return;

    const fechaISO = getFechaISO(modalSelectedDate);
    if (!fechaISO) {
      setModalError("Selecciona una fecha válida.");
      return;
    }
    if (!modalSelectedTime) {
      setModalError("Selecciona un horario disponible.");
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError("");

      if (modalMode === "subsecuente") {
        // 🔹 1) Pedimos al backend que programe la cita subsecuente
        const nuevaCita = await programarSubsecuenteDesdeCita(
          selectedCitaFecha.id,
          {
            fechaISO,
            hora: modalSelectedTime,
          }
        );

        // 🔹 2) Agregamos la nueva cita a la lista, SIN tocar la original
        setCitas((prev) => {
          if (!nuevaCita || !nuevaCita.id) return prev;
          const exists = prev.some((c) => c.id === nuevaCita.id);
          return exists ? prev : [...prev, nuevaCita];
        });

        toast.success("Cita subsecuente programada correctamente.");
      } else if (modalMode === "reprogramar") {
        // 🔹 Reprogramar SÍ actualiza la cita original
        const citaActualizada = await reprogramarCita(selectedCitaFecha.id, {
          fechaISO,
          hora: modalSelectedTime,
        });

        setCitas((prev) =>
          prev.map((c) => (c.id === citaActualizada.id ? citaActualizada : c))
        );

        toast.success("Cita reprogramada correctamente.");
      }

      // Cerramos modal
      closeFechaModal();

      // Refetch suave para mantener lista alineada con backend
      setReloadToken(Date.now());
    } catch (err) {
      console.error("Error al procesar la cita:", err);
      const backendError =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        (Array.isArray(err.response?.data?.non_field_errors) &&
          err.response.data.non_field_errors[0]) ||
        "Ocurrió un error al procesar la cita.";
      setModalError(backendError);
    } finally {
      setModalSubmitting(false);
    }
  };

  const totalCitas = citas.length;

  // 🎛 Filtros con iconos médicos
  const estados = [
    { value: "TODAS", label: "Todas", icon: FiStar },
    { value: "P", label: "Pendientes", icon: FiClock },
    { value: "C", label: "Confirmadas", icon: FiCheckCircle },
    { value: "X", label: "Canceladas", icon: FiXCircle },
  ];

  // 🧱 Render de tabla (sin flicker, loader solo en primer load)
  const renderTable = () => {
    if (loading && !hasLoadedOnceRef.current) {
      return (
        <div className="citas-loading">
          <FiClock className="me-2" size={20} />
          Cargando citas...
        </div>
      );
    }

    if (error) {
      return (
        <div className="citas-error">
          <strong>Error:</strong> {error}
        </div>
      );
    }

    if (!loading && citas.length === 0) {
      return (
        <div className="citas-empty">
          <FiHeart size={48} style={{ opacity: 0.6 }} />
          <h4>No hay citas programadas</h4>
          <p>No se encontraron citas con los filtros seleccionados.</p>
        </div>
      );
    }

    return (
      <div className="citas-table-wrapper">
        <table className="citas-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Especialidad</th>
              <th>Fecha y hora</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Consentimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {citas.map((cita) => {
              const estadoNormalizado = mapEstadoCita(cita.estado);
              const hasConsulta = !!citasConConsulta[cita.id];
              const puedeConsultar =
                estadoNormalizado === "Confirmada" && !!cita.paciente;
              const labelConsulta = hasConsulta
                ? "Ver consulta"
                : "Iniciar consulta";

              const puedeProgramarSubsecuente =
                estadoNormalizado === "Confirmada";
              const puedeReprogramar = estadoNormalizado !== "Cancelada";

              return (
                <tr key={cita.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <FiUser
                        size={16}
                        style={{ color: "var(--dc-text-medium)" }}
                      />
                      <span>
                        {cita.paciente
                          ? `${cita.paciente.nombre} ${cita.paciente.apellidos}`
                          : "N/A"}
                      </span>
                    </div>
                  </td>
                  <td>{cita.especialidad?.nombre || "General"}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <FiCalendar
                        size={14}
                        style={{ color: "var(--dc-text-medium)" }}
                      />
                      <span>{formatearFechaHora(cita.fecha_hora)}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`estado-badge ${
                        estadoNormalizado === "Confirmada"
                          ? "estado-confirmada"
                          : estadoNormalizado === "Pendiente"
                          ? "estado-pendiente"
                          : "estado-cancelada"
                      }`}
                    >
                      {estadoNormalizado}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const pago = (cita.pagos && cita.pagos[0]) || null;
                      if (pago) {
                        return (
                          <span
                            className={`badge ${
                              pago.verificado ? "bg-success" : "bg-info"
                            }`}
                          >
                            {pago.verificado ? "Verificado" : "En revisión"}
                          </span>
                        );
                      }
                      return (
                        <span className="badge bg-warning">Pendiente</span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
                      if (estadoNormalizado === "Confirmada") {
                        return cita.consentimiento_completado ? (
                          <span className="badge bg-success">Completado</span>
                        ) : (
                          <span className="badge bg-secondary">Pendiente</span>
                        );
                      }
                      return <span className="text-muted small">-</span>;
                    })()}
                  </td>
                  <td>
                    <div className="acciones-container">
                      <button
                        type="button"
                        className="acciones-toggle-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === cita.id ? null : cita.id
                          );
                        }}
                      >
                        <FiMoreVertical size={16} />
                        Opciones
                      </button>

                      {openMenuId === cita.id && (
                        <div
                          className="acciones-menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="acciones-menu-item"
                            onClick={() => handleIniciarConsulta(cita)}
                            disabled={!puedeConsultar}
                          >
                            <FiActivity size={18} />
                            <span>{labelConsulta}</span>
                          </button>

                          <button
                            type="button"
                            className="acciones-menu-item"
                            onClick={() => openConsultModal(cita)}
                          >
                            <FiFileText size={18} />
                            <span>Ver detalles</span>
                          </button>

                          <button
                            type="button"
                            className="acciones-menu-item"
                            onClick={() => openFechaModal("subsecuente", cita)}
                            disabled={!puedeProgramarSubsecuente}
                          >
                            <FiPlusCircle size={18} />
                            <span>Programar subsecuente</span>
                          </button>

                          <button
                            type="button"
                            className="acciones-menu-item"
                            onClick={() => openFechaModal("reprogramar", cita)}
                            disabled={!puedeReprogramar}
                          >
                            <FiRepeat size={18} />
                            <span>Reprogramar cita</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="doctor-citas-container">
        <div className="doctor-citas-page">
          <div className="doctor-citas-content">
            {/* ====== HEADER PRINCIPAL ====== */}
            <header className="doctor-citas-main-header">
              <div className="doctor-citas-header-content">
                <div className="doctor-citas-header-left">
                  <h1 className="doctor-citas-title">
                    <FiCalendar size={28} />
                    Gestión de Citas
                  </h1>
                  <p className="doctor-citas-subtitle">
                    Administra y da seguimiento a las citas programadas de tus
                    pacientes en un entorno limpio y profesional.
                  </p>
                  <div className="doctor-profile-info">
                    <span className="doctor-name-badge">
                      <FiUser size={16} />
                      Dr. {user.nombre} {user.apellidos}
                    </span>
                    <span className="doctor-specialty-badge">
                      <FiStar size={16} />
                      {user.role === "DERMATOLOGO" && "Dermatología"}
                      {user.role === "PODOLOGO" && "Podología"}
                      {user.role === "TAMIZ" && "Medicina General"}
                      {!["DERMATOLOGO", "PODOLOGO", "TAMIZ"].includes(
                        user.role
                      ) && user.role}
                    </span>
                  </div>
                </div>

                <div className="doctor-citas-header-right">
                  <div className="citas-summary-card">
                    <div className="citas-count">{totalCitas}</div>
                    <div className="citas-label">
                      {totalCitas === 1 ? "Cita activa" : "Citas totales"}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* ====== CONTENEDOR PRINCIPAL DE LA TABLA ====== */}
            <section className="doctor-citas-main-card">
              <div className="citas-table-header">
                <h2 className="citas-table-title">Citas programadas</h2>

                <div className="citas-filters-container">
                  <div className="filter-group">
                    <span className="filter-label">Filtrar por estado:</span>
                    <div className="estado-filters">
                      {estados.map((estado) => {
                        const Icon = estado.icon;
                        return (
                          <button
                            key={estado.value}
                            className={`estado-filter-btn ${
                              filtroEstado === estado.value ? "active" : ""
                            }`}
                            onClick={() => setFiltroEstado(estado.value)}
                          >
                            <span>
                              <Icon size={14} />
                              {estado.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={
                  "citas-table-content" +
                  (isRefetching ? " citas-table-content--refetch" : "")
                }
              >
                {renderTable()}
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedCita && (
        <ConsultModal
          show={showModal}
          onHide={closeConsultModal}
          cita={selectedCita}
        />
      )}

      {/* Modal para programar subsecuente / reprogramar */}
      {showFechaModal && selectedCitaFecha && (
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
            <h4 className="mb-3">
              {modalMode === "subsecuente"
                ? "Programar cita subsecuente"
                : "Reprogramar cita"}
            </h4>

            <p className="text-muted mb-3">
              Paciente:{" "}
              <strong>
                {selectedCitaFecha.paciente
                  ? `${selectedCitaFecha.paciente.nombre} ${selectedCitaFecha.paciente.apellidos}`
                  : "N/A"}
              </strong>
              <br />
              Fecha actual:{" "}
              <strong>
                {formatearFechaHora(selectedCitaFecha.fecha_hora)}
              </strong>
            </p>

            {modalError && (
              <div className="alert alert-danger">{modalError}</div>
            )}

            <form onSubmit={handleSubmitFechaModal}>
              <div className="mb-3">
                <label className="form-label">Seleccione una fecha (YYYY-MM-DD)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej. 2025-12-02"
                  value={modalSelectedDate || ""}
                  onChange={(e) => {
                    setModalSelectedDate(e.target.value.replace(/[\/.]/g, "-"));
                    setModalSelectedTime("");
                  }}
                  disabled={modalSubmitting}
                />
              </div>

              <div className="mb-3">
                <TimeSlotSelector
                  horarios={modalHorarios}
                  selectedTime={modalSelectedTime}
                  onTimeChange={setModalSelectedTime}
                  disabled={
                    !modalSelectedDate ||
                    modalLoadingHorarios ||
                    modalSubmitting
                  }
                  loading={modalLoadingHorarios}
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeFechaModal}
                  disabled={modalSubmitting}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    modalSubmitting ||
                    !modalSelectedDate ||
                    !modalSelectedTime
                  }
                >
                  {modalSubmitting
                    ? "Guardando..."
                    : modalMode === "subsecuente"
                    ? "Crear subsecuente"
                    : "Reprogramar cita"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default DoctorCitasPage;
