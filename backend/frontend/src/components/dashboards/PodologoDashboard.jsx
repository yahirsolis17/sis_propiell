import React, { useState, useEffect } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";
import { FiUser, FiCalendar, FiFileText } from "react-icons/fi";

import { getCurrentUser } from "../../services/authService";
import { getCitasByDoctor } from "../../services/citasService";
import { formatearFechaHora } from "../../components/clinicFormatters";
import ConsultModal from "../citas/ConsultModal";

const PodologoDashboard = ({ cardAnimation }) => {
  const [user] = useState(() => getCurrentUser());

  const [historial, setHistorial] = useState([]);
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

    const fetchHistorial = async () => {
      try {
        setLoading(true);
        setError("");

        // Historial = citas confirmadas del podólogo
        const data = await getCitasByDoctor(user.id, {
          estado: "C",
          signal: controller.signal,
        });

        if (!isMounted) return;
        setHistorial(data || []);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error al cargar historial podológico:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error al cargar el historial clínico. Intenta nuevamente en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistorial();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user?.id, navigate]);

  const openConsultModal = (cita) => {
    setSelectedCita(cita);
    setShowModal(true);
  };

  const closeConsultModal = () => {
    setSelectedCita(null);
    setShowModal(false);
  };

  return (
    <>
      <animated.div style={cardAnimation} className="dashboard-card">
        {loading ? (
          <div className="loading-spinner">Cargando historial...</div>
        ) : error ? (
          <div className="error-message text-danger">{error}</div>
        ) : (
          <section className="historial-container">
            <header className="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-1">Historial clínico podológico</h3>
                <p className="text-muted mb-0">
                  Citas confirmadas atendidas recientemente.
                </p>
              </div>
              <span className="badge bg-light text-muted">
                {historial.length} registro
                {historial.length === 1 ? "" : "s"}
              </span>
            </header>

            {historial.length ? (
              <div className="historial-list">
                {historial.map((cita) => (
                  <article key={cita.id} className="consulta-card">
                    <div className="consulta-header d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <FiCalendar size={16} />
                        <span className="fw-semibold">
                          {formatearFechaHora(cita.fecha_hora)}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 text-muted">
                        <FiUser size={16} />
                        <span>
                          {cita.paciente
                            ? `${cita.paciente.nombre} ${
                                cita.paciente.apellidos || ""
                              }`
                            : "Paciente no disponible"}
                        </span>
                      </div>
                    </div>

                    <div className="consulta-body">
                      <p className="mb-2 text-muted small text-uppercase">
                        Diagnóstico
                      </p>
                      <p className="mb-3">
                        {cita.diagnostico || "Sin diagnóstico registrado."}
                      </p>

                      <button
                        type="button"
                        className="action-button btn btn-outline-primary btn-sm"
                        onClick={() => openConsultModal(cita)}
                      >
                        <FiFileText size={16} className="me-1" />
                        Ver detalles
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0">
                No hay historial clínico disponible por el momento.
              </p>
            )}
          </section>
        )}
      </animated.div>

      {selectedCita && (
        <ConsultModal
          show={showModal}
          onHide={closeConsultModal}
          cita={selectedCita}
        />
      )}
    </>
  );
};

export default PodologoDashboard;
