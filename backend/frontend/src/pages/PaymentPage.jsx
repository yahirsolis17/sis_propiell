import React, { useState, useEffect } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser, verifyAuth } from "../services/authService";
import api from '../services/api';
import Navbar from '../components/Navbar';
import "./PaymentPage.css";

const PaymentPage = () => {
  const { citaId } = useParams();
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [comprobante, setComprobante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const checkAuth = async () => {
      try {
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        }
      }
    };
    if (user) checkAuth();
    return () => controller.abort();
  }, [user, navigate]);

  if (!user) return <Navigate to="/login" replace />;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setComprobante(file);
    } else {
      alert("Solo se permiten imágenes (PNG, JPG o JPEG)");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comprobante) {
      setError("Debe subir un comprobante");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("cita", citaId);
      formData.append("comprobante", comprobante);

      const token = localStorage.getItem("token");
      const response = await api.post("pagos/create/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      
      if (response.status === 201) {
        setShowModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error al subir el comprobante.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAndRedirect = (e) => {
    e.preventDefault();
    // Forzar descarga del PDF
    const link = document.createElement('a');
    link.href = "/pagos/consentimiento.pdf";
    link.download = "comprobante_pago.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Redirigir después de descargar
    setTimeout(() => navigate('/Dashboard'), 500);
  };

  return (
    <>
      <Navbar />
      <div className="citas-container" style={{ paddingTop: "100px" }}>
        <div className="cita-form-card">
          <h2 className="citas-title">Subir Comprobante de Pago</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit} className="cita-form">
            <div className="mb-3">
              <label className="form-label">Subir comprobante de pago (Imagen):</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                className="form-control"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn-payment-submit"
              disabled={loading || !comprobante}
            >
              {loading ? "Subiendo..." : "Subir Comprobante"}
            </button>
          </form>
        </div>
      </div>

      {/* Modal de éxito con advertencia de descarga */}
      {showModal && (
        <div className="payment-modal">
          <div className="payment-modal-overlay" onClick={() => {
            setShowModal(false);
            navigate('/Dashboard');
          }}></div>
          <div className="payment-modal-content">
            <button 
              className="close-modal" 
              onClick={() => {
                setShowModal(false);
                navigate('/Dashboard');
              }}
            >
              &times;
            </button>
            <h3 className="modal-title">✅ Comprobante Subido Exitosamente</h3>
            <p className="modal-text">Gracias por subir su comprobante de pago.</p>
            
            <div className="download-notice">
              <p className="notice-text">
                ⚠ IMPORTANTE: Descargue el consentimiento informando y presentelo el dia de la cita.
              </p>
            </div>

            <button
              onClick={handleDownloadAndRedirect}
              className="modal-download-btn"
            >
              Descargar consentimiento informado
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentPage;