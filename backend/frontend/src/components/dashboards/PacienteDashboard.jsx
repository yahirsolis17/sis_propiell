// src/components/dashboards/PacienteDashboard.jsx
import React, { useState, useEffect } from 'react';
import { animated } from '@react-spring/web';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { getCurrentUser } from '../../services/authService';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PacienteDashboard = ({ cardAnimation }) => {
  const location = useLocation();
  const [citas, setCitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getCurrentUser();
  const navigate = useNavigate();

  // Efecto para mostrar el toast solo cuando viene del login
  useEffect(() => {
    if (location.state?.fromLogin) {
      toast.success('¡Inicio de sesión exitoso!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
      
      // Limpiamos el estado para que no se muestre al volver
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Efecto para cargar los datos del dashboard
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        // Corregimos las URL con backticks
        const [resCitas, resPagos] = await Promise.all([
          api.get(`/citas/?paciente=${user.id}`, { signal: controller.signal }),
          api.get(`/pagos/?paciente=${user.id}`, { signal: controller.signal })
        ]);
        setCitas(resCitas.data);
        setPagos(resPagos.data);
      } catch (err) {
        if (!controller.signal.aborted) {
          if (err.response?.status === 401) navigate('/login');
          setError('Error cargando datos');
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchData();
    return () => controller.abort();
  }, [user, navigate]);

  const formatoFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <animated.div style={cardAnimation} className="dashboard-card">
      <ToastContainer />
      
      {loading ? (
        <div className="loading-spinner">Cargando...</div>
      ) : error ? (
        <div className="error-message text-danger">{error}</div>
      ) : (
        <>
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
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((cita) => (
                      <tr key={cita.id}>
                        <td>{cita.especialidad?.nombre || 'Sin especialidad'}</td>
                        <td>{cita.estado}</td>
                        <td>Dr. {cita.doctor?.nombre || 'N/A'}</td>
                        <td>{formatoFecha(cita.fecha_hora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No tienes citas programadas.</p>
            )}
          </section>

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
                        <td>{pago.verificado ? 'Sí' : 'No'}</td>
                        <td>{new Date(pago.fecha).toLocaleString('es-MX')}</td>
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
