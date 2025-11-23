// src/components/dashboards/PacienteDashboard.jsx
import React, { useState, useEffect } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";

import { getCurrentUser } from "../../services/authService";
import {
  getCitasByPaciente,
  getPagosByPaciente,
} from "../../services/citasService";

const PacienteDashboard = ({ cardAnimation }) => {
  const navigate = useNavigate();

  // 🔒 Congelamos el usuario una sola vez, para que la referencia no cambie en cada render
  const [user] = useState(() => getCurrentUser());

  const [citas, setCitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setCitas(citasData);
        setPagos(pagosData);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error cargando datos del paciente:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
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
    // 👇 Solo dependemos del ID (valor primitivo), no del objeto user completo
  }, [user?.id, navigate]);

  const formatoFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <animated.div style={cardAnimation} className="dashboard-card">
      {loading ? (
        <div className="loading-spinner">Cargando...</div>
      ) : error ? (
        <div className="error-message text-danger">{error}</div>
      ) : (
        <>
          {/* MIS CITAS */}
          <section className="mb-4">
            <h3 className="mb-3">Mis Próximas Citas</h3>
            {citas.length ? (
              <div className="table-responsive">
                <table className="table table-striped table-bordered align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Especialidad</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Doctor</th>
                      <th scope="col">Fecha y Hora</th>
                      <th scope="col">Consentimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((cita) => (
                      <tr key={cita.id}>
                        <td>{cita.especialidad?.nombre || "Sin especialidad"}</td>
                        <td>{cita.estado}</td>
                        <td>Dr. {cita.doctor?.nombre || "N/A"}</td>
                        <td>{formatoFecha(cita.fecha_hora)}</td>
                        <td>
                          {cita.estado === "Confirmada" ? (
                            cita.consentimiento_completado ? (
                              <span className="badge bg-success">
                                Completado
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  navigate(
                                    `/citas/${cita.id}/consentimiento`
                                  )
                                }
                              >
                                Llenar consentimiento
                              </button>
                            )
                          ) : (
                            <span className="text-muted small">
                              No disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No tienes citas programadas.</p>
            )}
          </section>

          {/* PAGOS */}
          <section>
            <h3 className="mb-3">Estado de Pagos</h3>
            {pagos.length ? (
              <div className="table-responsive">
                <table className="table table-striped table-bordered align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Total</th>
                      <th scope="col">Pagado</th>
                      <th scope="col">Verificado</th>
                      <th scope="col">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td>${pago.total}</td>
                        <td>${pago.pagado}</td>
                        <td>{pago.verificado ? "Sí" : "No"}</td>
                        <td>
                          {pago.fecha
                            ? new Date(pago.fecha).toLocaleString("es-MX")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hay pagos registrados.</p>
            )}
          </section>
        </>
      )}
    </animated.div>
  );
};

export default PacienteDashboard;
