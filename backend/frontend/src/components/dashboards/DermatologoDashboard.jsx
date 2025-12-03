// src/components/dashboards/DermatologoDashboard.jsx
import React, { useState, useEffect } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";

import { getCurrentUser } from "../../services/authService";
import { getCitasByDoctor } from "../../services/citasService";
import ConsultModal from "../citas/ConsultModal";
import { requiereConsentimiento } from "../../utils/clinicRules";

const DermatologoDashboard = ({ cardAnimation }) => {
  const [user] = useState(() => getCurrentUser());

  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCita, setSelectedCita] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchCitas = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getCitasByDoctor(user.id, {
          estado: "P",
          signal: controller.signal,
        });

        if (!isMounted) return;
        setCitas(data || []);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error al cargar citas del dermatólogo:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error al cargar citas. Intenta de nuevo en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCitas();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user?.id, navigate]);

  const openConsultModal = (cita) => {
    setSelectedCita(cita);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedCita(null);
    setShowModal(false);
  };

  const updateCitaInList = (citaId) => {
    setCitas((prev) => prev.filter((c) => c.id !== citaId));
  };

  const formatoFechaHora = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <animated.div style={cardAnimation} className="dashboard-card">
        {loading ? (
          <div className="loading-spinner">Cargando...</div>
        ) : error ? (
          <div className="error-message text-danger">{error}</div>
        ) : (
          <section className="citas-section">
            <h3 className="mb-3">Citas Pendientes ({citas.length})</h3>

            {citas.length ? (
              <div className="table-responsive">
                <table className="table table-striped table-bordered align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Fecha y Hora</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Pago</th>
                      <th scope="col">Consentimiento</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((cita) => {
                      const pago = (cita.pagos && cita.pagos[0]) || null;

                      return (
                        <tr key={cita.id}>
                          <td>{formatoFechaHora(cita.fecha_hora)}</td>
                          <td>
                            {cita.paciente
                              ? `${cita.paciente.nombre} ${cita.paciente.apellidos}`
                              : "N/A"}
                          </td>

                          {/* Columna Pago */}
                          <td>
                            {pago ? (
                              <span
                                className={`badge ${
                                  pago.verificado
                                    ? "bg-success"
                                    : "bg-info text-dark"
                                }`}
                              >
                                {pago.verificado
                                  ? "Pago verificado"
                                  : "Comprobante recibido"}
                              </span>
                            ) : (
                              <span className="badge bg-warning text-dark">
                                Pago pendiente
                              </span>
                            )}
                          </td>

                          {/* Columna Consentimiento */}
                          <td>
                            {requiereConsentimiento(cita) ? (
                              cita.estado === "Confirmada" ? (
                                cita.consentimiento_completado ? (
                                  <span className="badge bg-success">
                                    Completado
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary">
                                    No completado
                                  </span>
                                )
                              ) : (
                                <span className="text-muted small">
                                  No disponible
                                </span>
                              )
                            ) : (
                              <span className="badge bg-light text-muted">
                                No aplica
                              </span>
                            )}
                          </td>

                          {/* Acción */}
                          <td>
                            <button
                              onClick={() => openConsultModal(cita)}
                              className="btn btn-secondary btn-sm"
                            >
                              Consultar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hay citas pendientes.</p>
            )}
          </section>
        )}
      </animated.div>

      {selectedCita && (
        <ConsultModal
          show={showModal}
          onHide={closeModal}
          cita={selectedCita}
          onActionSuccess={updateCitaInList}
        />
      )}
    </>
  );
};

export default DermatologoDashboard;
