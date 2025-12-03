// src/components/dashboards/PacienteDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  FiMoreVertical,
  FiRepeat,
  FiXCircle,
  FiCreditCard,
} from "react-icons/fi";

import { getCurrentUser } from "../../services/authService";
import {
  getCitasByPaciente,
  getPagosByPaciente,
  reprogramarCitaPaciente,
  cancelarCitaPaciente,
} from "../../services/pacientesService";
import { getHorariosDisponibles } from "../../services/citasService";
import { requiereConsentimiento } from "../../utils/clinicRules";

import CalendarPicker from "../citas/CalendarPicker";
import TimeSlotSelector from "../citas/TimeSlotSelector";

const PacienteDashboard = ({ cardAnimation }) => {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());

  const [citas, setCitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Menú contextual (3 puntos) -> portal al body
  const [menuConfig, setMenuConfig] = useState({
    cita: null,
    top: 0,
    left: 0,
    puedeReprogramar: false,
    puedeCancelar: false,
    puedePagarAhora: false,
  });

  const resetMenu = () =>
    setMenuConfig({
      cita: null,
      top: 0,
      left: 0,
      puedeReprogramar: false,
      puedeCancelar: false,
      puedePagarAhora: false,
    });

  // Modal reprogramar
  const [showFechaModal, setShowFechaModal] = useState(false);
  const [selectedCitaFecha, setSelectedCitaFecha] = useState(null);
  const [modalSelectedDate, setModalSelectedDate] = useState(null);
  const [modalSelectedTime, setModalSelectedTime] = useState("");
  const [modalHorarios, setModalHorarios] = useState([]);
  const [modalLoadingHorarios, setModalLoadingHorarios] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Cancelar
  const [cancelingId, setCancelingId] = useState(null);

  const getFechaISO = (date) => {
    if (!date) return null;
    try {
      if (typeof date === "string") return date.trim() || null;
      if (date instanceof Date) return date.toISOString().split("T")[0];
      return null;
    } catch {
      return null;
    }
  };

  // Carga inicial
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const [citasData, pagosData] = await Promise.all([
          getCitasByPaciente(user.id, controller.signal),
          getPagosByPaciente(user.id, controller.signal),
        ]);

        if (!isMounted) return;
        setCitas(citasData || []);
        setPagos(pagosData || []);
        setCurrentPage(1);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error cargando datos del paciente:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error cargando tus citas y pagos. Intenta de nuevo en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user?.id, navigate]);

  // Refetch de citas después de acciones
  const refetchCitas = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getCitasByPaciente(user.id);
      setCitas(data || []);
    } catch (err) {
      console.error("Error recargando citas del paciente:", err);
    }
  }, [user?.id]);

  const formatoFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return "-";

    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPagoInfoForCita = (cita) => {
    if (!cita) {
      return {
        label: "Sin información",
        className: "badge bg-secondary",
        tienePago: false,
        verificado: false,
      };
    }

    const pago =
      pagos.find((p) => p.cita === cita.id || p.cita?.id === cita.id) || null;

    if (!pago) {
      // Caso "pago en consultorio (pendiente)"
      return {
        label: "Pago en consultorio (pendiente)",
        className: "badge bg-warning text-dark",
        tienePago: false,
        verificado: false,
      };
    }

    if (pago.verificado) {
      return {
        label: "Pago por transferencia verificado",
        className: "badge bg-success",
        tienePago: true,
        verificado: true,
      };
    }

    return {
      label: "Comprobante enviado (en revisión)",
      className: "badge bg-info text-dark",
      tienePago: true,
      verificado: false,
    };
  };

  const handleIrConsentimiento = (citaId) => {
    navigate(`/citas/${citaId}/consentimiento`);
  };

  const handlePagarAhora = (citaId) => {
    navigate(`/pago/${citaId}`);
  };

  // Modal reprogramar
  const openFechaModal = (cita) => {
    setSelectedCitaFecha(cita);
    setModalSelectedDate(null);
    setModalSelectedTime("");
    setModalHorarios([]);
    setModalError("");
    setShowFechaModal(true);
  };

  const closeFechaModal = () => {
    setShowFechaModal(false);
    setSelectedCitaFecha(null);
    setModalSelectedDate(null);
    setModalSelectedTime("");
    setModalHorarios([]);
    setModalError("");
  };

  // Cargar horarios cuando hay fecha seleccionada
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
            "No se encontró la especialidad asociada a la cita. Contacta a la clínica."
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
        if (isMounted) setModalLoadingHorarios(false);
      }
    };

    fetchHorarios();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showFechaModal, selectedCitaFecha, modalSelectedDate]);

  // Enviar reprogramación
  const handleSubmitFechaModal = async (event) => {
    event.preventDefault();
    if (!selectedCitaFecha) return;

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

      await reprogramarCitaPaciente(selectedCitaFecha.id, {
        fechaISO,
        hora: modalSelectedTime,
      });

      closeFechaModal();
      resetMenu();
      await refetchCitas();
    } catch (err) {
      console.error("Error al reprogramar cita:", err);
      const backendError =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        (Array.isArray(err.response?.data?.non_field_errors) &&
          err.response.data.non_field_errors[0]) ||
        "No se pudo reprogramar la cita. Verifica las restricciones.";
      setModalError(backendError);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Cancelar cita
  const handleCancelarCita = async (cita) => {
    const confirmMsg =
      "¿Seguro que deseas cancelar esta cita?\n\n" +
      "Solo se puede cancelar con al menos 7 días de anticipación.";
    if (!window.confirm(confirmMsg)) return;

    try {
      setCancelingId(cita.id);
      await cancelarCitaPaciente(cita.id);
      resetMenu();
      await refetchCitas();
    } catch (err) {
      console.error("Error al cancelar cita:", err);
      alert(
        err.response?.data?.detail ||
          "No se pudo cancelar la cita. Es posible que ya no cumpla con las reglas."
      );
    } finally {
      setCancelingId(null);
    }
  };

  // Abrir menú contextual (portal al body)
  const handleOpenMenu = (event, cita, actions) => {
    const { puedePagarAhora, puedeReprogramar, puedeCancelar } = actions;
    const hasActions =
      puedePagarAhora || puedeReprogramar || puedeCancelar || false;

    if (!hasActions) return;

    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();

    setMenuConfig((prev) => {
      // toggle si ya estaba abierto en la misma cita
      if (prev.cita && prev.cita.id === cita.id) {
        return {
          cita: null,
          top: 0,
          left: 0,
          puedeReprogramar: false,
          puedeCancelar: false,
          puedePagarAhora: false,
        };
      }

      return {
        cita,
        top: rect.bottom + 4,
        left: rect.left,
        puedeReprogramar,
        puedeCancelar,
        puedePagarAhora,
      };
    });
  };

  // Cerrar menú al hacer scroll o resize -> que no se quede "pegado"
  useEffect(() => {
    if (!menuConfig.cita) return;

    const handleClose = () => {
      resetMenu();
    };

    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);

    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [menuConfig.cita]);

  const totalPages = Math.max(1, Math.ceil((citas?.length || 0) / pageSize));
  const paginatedCitas = citas.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setCurrentPage(nextPage);
  };

  // Estilos base del menú contextual
  const menuStyleBase = {
    position: "fixed", // relativo al viewport
    zIndex: 3000,
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    padding: "6px 0",
    minWidth: "220px",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    opacity: 1,
    transform: "translateY(0)",
  };

  const menuItemStyle = {
    width: "100%",
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    fontSize: "0.9rem",
    color: "#34495e",
    cursor: "pointer",
    textAlign: "left",
  };

  const menuItemDangerStyle = {
    ...menuItemStyle,
    color: "#c0392b",
  };

  return (
    <>
      {/* CARD DEL DASHBOARD */}
      <animated.div style={cardAnimation} className="dashboard-card">
        {loading ? (
          <div className="loading-spinner">Cargando...</div>
        ) : error ? (
          <div className="error-message text-danger">{error}</div>
        ) : (
          <>
            <section className="mb-4">
              <h3 className="mb-3">Mis Próximas Citas</h3>
              {citas.length ? (
                <div
                  className="table-responsive"
                  style={{
                    overflowX: "auto",
                    overflowY: "visible",
                  }}
                >
                  <table className="table table-striped table-bordered align-middle">
                    <thead>
                      <tr>
                        <th scope="col">Especialidad</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Doctor</th>
                        <th scope="col">Fecha y Hora</th>
                        <th scope="col">Consentimiento</th>
                        <th scope="col">Pago</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCitas.map((cita) => {
                        const pagoInfo = getPagoInfoForCita(cita);

                        const estadoCodigo =
                          cita.estado_codigo || cita.estado || "";
                        const esCancelada =
                          estadoCodigo === "X" ||
                          estadoCodigo === "Cancelada" ||
                          estadoCodigo === "CANCELADA";

                        // Pagar ahora: cita no cancelada y sin pago registrado
                        const puedePagarAhora =
                          !esCancelada && !pagoInfo.tienePago;

                        const puedeReprogramar =
                          !!cita.paciente_puede_reprogramar;
                        const puedeCancelar = !!cita.paciente_puede_cancelar;

                        const hasActions =
                          puedePagarAhora || puedeReprogramar || puedeCancelar;

                        return (
                          <tr key={cita.id}>
                            <td>
                              {cita.especialidad?.nombre || "Sin especialidad"}
                            </td>

                            <td>{cita.estado}</td>

                            <td>
                              {cita.doctor
                                ? `Dr. ${cita.doctor.nombre} ${
                                    cita.doctor.apellidos || ""
                                  }`
                                : "N/A"}
                            </td>

                            <td>{formatoFecha(cita.fecha_hora)}</td>

                            <td>
                              {(() => {
                                const aplica = requiereConsentimiento(cita);
                                const estadoCod =
                                  cita.estado_codigo || cita.estado || "";
                                const estaConfirmada =
                                  estadoCod === "C" ||
                                  estadoCod === "Confirmada" ||
                                  estadoCod === "CONFIRMADA";
                                const firmado =
                                  !!cita.consentimiento_completado;

                                if (!aplica) {
                                  return (
                                    <span className="badge bg-light text-muted">
                                      No aplica
                                    </span>
                                  );
                                }

                                if (firmado) {
                                  return (
                                    <span className="badge bg-success">
                                      Consentimiento completado
                                    </span>
                                  );
                                }

                                if (estaConfirmada) {
                                  return (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() =>
                                        handleIrConsentimiento(cita.id)
                                      }
                                    >
                                      Llenar consentimiento
                                    </button>
                                  );
                                }

                                return (
                                  <span className="badge bg-secondary">
                                    Pendiente de confirmación
                                  </span>
                                );
                              })()}
                            </td>

                            <td>
                              <span className={pagoInfo.className}>
                                {pagoInfo.label}
                              </span>
                            </td>

                            <td>
                              {hasActions ? (
                                <button
                                  type="button"
                                  className="acciones-toggle-btn"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    borderRadius: "999px",
                                    padding: "4px 10px",
                                    fontSize: "0.85rem",
                                    border: "1px solid #ced4da",
                                    backgroundColor: "#ffffff",
                                  }}
                                  onClick={(e) =>
                                    handleOpenMenu(e, cita, {
                                      puedePagarAhora,
                                      puedeReprogramar,
                                      puedeCancelar,
                                    })
                                  }
                                >
                                  <FiMoreVertical size={16} />
                                  <span>Opciones</span>
                                </button>
                              ) : (
                                <span className="text-muted small">
                                  Sin acciones
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </button>
                      <span className="text-muted">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p>No tienes citas programadas.</p>
              )}
            </section>
          </>
        )}
      </animated.div>

      {/* MENÚ CONTEXTUAL COMO PORTAL AL BODY */}
      {menuConfig.cita &&
        createPortal(
          <>
            {/* overlay para cerrar al hacer clic fuera */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2999,
                background: "transparent",
              }}
              onClick={resetMenu}
            />
            <div
              style={{
                ...menuStyleBase,
                top: menuConfig.top,
                left: menuConfig.left,
              }}
            >
              {menuConfig.puedeReprogramar && (
                <button
                  type="button"
                  style={menuItemStyle}
                  onClick={() => {
                    const cita = menuConfig.cita;
                    resetMenu();
                    openFechaModal(cita);
                  }}
                >
                  <FiRepeat size={18} />
                  <span>Reprogramar cita</span>
                </button>
              )}

              {menuConfig.puedeCancelar && (
                <button
                  type="button"
                  style={menuItemDangerStyle}
                  onClick={() => {
                    const cita = menuConfig.cita;
                    resetMenu();
                    handleCancelarCita(cita);
                  }}
                  disabled={cancelingId === menuConfig.cita.id}
                >
                  <FiXCircle size={18} />
                  <span>
                    {cancelingId === menuConfig.cita.id
                      ? "Cancelando..."
                      : "Cancelar cita"}
                  </span>
                </button>
              )}

              {menuConfig.puedePagarAhora && (
                <button
                  type="button"
                  style={menuItemStyle}
                  onClick={() => {
                    const id = menuConfig.cita.id;
                    resetMenu();
                    handlePagarAhora(id);
                  }}
                >
                  <FiCreditCard size={18} />
                  <span>Pagar ahora</span>
                </button>
              )}
            </div>
          </>,
          document.body
        )}

      {/* MODAL REPROGRAMAR */}
      {showFechaModal && selectedCitaFecha && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3050,
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
            <h4 className="mb-3">Reprogramar cita</h4>

            <p className="text-muted mb-3">
              {selectedCitaFecha.especialidad?.nombre || "Sin especialidad"} con{" "}
              {selectedCitaFecha.doctor
                ? `Dr. ${selectedCitaFecha.doctor.nombre} ${
                    selectedCitaFecha.doctor.apellidos || ""
                  }`
                : "tu especialista"}
              <br />
              Fecha actual:{" "}
              <strong>{formatoFecha(selectedCitaFecha.fecha_hora)}</strong>
            </p>

            {modalError && (
              <div className="alert alert-danger">{modalError}</div>
            )}

            <form onSubmit={handleSubmitFechaModal}>
              <CalendarPicker
                selectedDate={modalSelectedDate}
                onDateChange={setModalSelectedDate}
                disabled={modalSubmitting}
              />

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
                    modalSubmitting || !modalSelectedDate || !modalSelectedTime
                  }
                >
                  {modalSubmitting ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PacienteDashboard;
