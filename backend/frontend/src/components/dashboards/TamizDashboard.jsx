import React, { useState, useEffect } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiUser, FiFileText } from "react-icons/fi";

import api from "../../services/api";

const TamizDashboard = ({ cardAnimation }) => {
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchResultados = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/resultados/", {
          signal: controller.signal,
        });

        if (!isMounted) return;
        setResultados(response.data || []);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error al cargar resultados de tamizaje:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error al cargar los resultados de tamizaje. Intenta nuevamente en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchResultados();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [navigate]);

  const getPrioridadLabel = (prioridadRaw) => {
    if (!prioridadRaw) return "Sin prioridad";
    const value = prioridadRaw.toString().toUpperCase();

    if (["ALTA", "HIGH"].includes(value)) return "Prioridad alta";
    if (["MEDIA", "MEDIO"].includes(value)) return "Prioridad media";
    if (["BAJA", "LOW"].includes(value)) return "Prioridad baja";
    return prioridadRaw;
  };

  return (
    <animated.div style={cardAnimation} className="dashboard-card">
      {loading ? (
        <div className="loading-spinner">Cargando resultados...</div>
      ) : error ? (
        <div className="error-message text-danger">{error}</div>
      ) : (
        <section className="resultados-container">
          <header className="mb-3 d-flex justify-content-between align-items-center">
            <div>
              <h3 className="mb-1">Resultados de tamizaje</h3>
              <p className="text-muted mb-0">
                Últimos estudios registrados y su nivel de prioridad.
              </p>
            </div>
            <span className="badge bg-light text-muted">
              {resultados.length} resultado
              {resultados.length === 1 ? "" : "s"}
            </span>
          </header>

          {resultados.length ? (
            <div className="resultados-grid">
              {resultados.map((resultado) => (
                <article key={resultado.id} className="resultado-card">
                  <div className="resultado-header d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <FiUser size={16} />
                      <span className="fw-semibold">
                        {resultado.paciente
                          ? `${resultado.paciente.nombre} ${
                              resultado.paciente.apellidos || ""
                            }`
                          : "Paciente no disponible"}
                      </span>
                    </div>

                    {/* Mantengo tu clase original: prioridad + valor crudo, para no romper CSS */}
                    <span
                      className={`prioridad ${resultado.prioridad || ""}`}
                    >
                      <FiAlertCircle size={14} className="me-1" />
                      {getPrioridadLabel(resultado.prioridad)}
                    </span>
                  </div>

                  <div className="resultado-body">
                    <p className="mb-2 text-muted small text-uppercase">
                      Observaciones
                    </p>
                    <p className="mb-3">
                      {resultado.observaciones || "Sin observaciones."}
                    </p>

                    <button
                      type="button"
                      className="action-button btn btn-outline-primary btn-sm"
                      onClick={() => navigate(`/resultados/${resultado.id}`)}
                    >
                      <FiFileText size={16} className="me-1" />
                      Ver reporte
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted mb-0">
              No hay resultados de tamizaje registrados todavía.
            </p>
          )}
        </section>
      )}
    </animated.div>
  );
};

export default TamizDashboard;
