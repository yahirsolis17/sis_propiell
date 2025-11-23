// src/pages/PaymentPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { getCurrentUser, verifyAuth } from "../services/authService";
import api from "../services/api";
import Navbar from "../components/Navbar";
import "./PaymentPage.css"; // ajusta la ruta si tu CSS vive en otra carpeta

// 🔹 Datos bancarios de DEMO (de prueba)
const BANK_DATA = {
  banco: "Banco de Prueba",
  cuenta: "0123456789",
  clabe: "012345678901234567",
  beneficiario: "Clínica PROPIELL (Datos de prueba)",
};

const PaymentPage = () => {
  const { citaId } = useParams();
  const navigate = useNavigate();

  // Congelamos el usuario una sola vez
  const [user] = useState(() => getCurrentUser());

  const [comprobante, setComprobante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  // Verificar autenticación con JWT
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const valid = await verifyAuth(controller.signal);
        if (!isMounted) return;

        if (!valid) {
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user?.id, navigate]);

  if (!user) return <Navigate to="/login" replace />;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setComprobante(file);
    } else {
      alert("Solo se permiten imágenes (PNG, JPG o JPEG)");
    }
  };

  const handleCopy = (label, value) => {
    if (!value) return;

    if (!navigator.clipboard) {
      alert(`${label}: ${value}`);
      return;
    }

    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopyMessage(`${label} copiado al portapapeles`);
        setTimeout(() => setCopyMessage(""), 2500);
      })
      .catch(() => {
        setCopyMessage("No se pudo copiar. Copia los datos manualmente.");
        setTimeout(() => setCopyMessage(""), 2500);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comprobante) {
      setError("Debe subir un comprobante");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("cita", citaId);
      formData.append("comprobante", comprobante);

      const response = await api.post("pagos/create/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 201) {
        navigate("/dashboard/paciente");
      }
    } catch (err) {
      console.error("Error al subir el comprobante:", err.response || err);
      setError(
        err.response?.data?.error ||
          "Error al subir el comprobante. Inténtalo más tarde."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="paymentpage-container">
        <div className="payment-form-card">
          <h2>Pago y Comprobante</h2>

          {/* Mensaje de error general */}
          {error && <div className="alert alert-danger">{error}</div>}

          {/* Mensaje cuando se copia algo */}
          {copyMessage && (
            <div className="alert alert-info payment-copy-alert">
              {copyMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="payment-form">
            {/* 🔹 Información bancaria de prueba */}
            <section className="payment-info mb-3">
              <p className="payment-info-text">
                Realiza tu pago por transferencia bancaria usando los siguientes
                datos <strong>de prueba</strong>:
              </p>

              <div className="payment-info-row">
                <div>
                  <span className="payment-label">Banco:</span>
                  <span className="payment-value">{BANK_DATA.banco}</span>
                </div>
              </div>

              <div className="payment-info-row">
                <div>
                  <span className="payment-label">Cuenta:</span>
                  <span className="payment-value">{BANK_DATA.cuenta}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleCopy("Cuenta", BANK_DATA.cuenta)}
                  disabled={loading}
                >
                  Copiar cuenta
                </button>
              </div>

              <div className="payment-info-row">
                <div>
                  <span className="payment-label">CLABE:</span>
                  <span className="payment-value">{BANK_DATA.clabe}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleCopy("CLABE", BANK_DATA.clabe)}
                  disabled={loading}
                >
                  Copiar CLABE
                </button>
              </div>

              <div className="payment-info-row">
                <div>
                  <span className="payment-label">Beneficiario:</span>
                  <span className="payment-value">
                    {BANK_DATA.beneficiario}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() =>
                    handleCopy("Beneficiario", BANK_DATA.beneficiario)
                  }
                  disabled={loading}
                >
                  Copiar nombre
                </button>
              </div>

              <p className="payment-info-warning">
                ⚠ Estos datos son únicamente de demostración para la práctica
                escolar y <strong>no corresponden</strong> a una cuenta real.
              </p>
            </section>

            {/* 🔹 Subida de comprobante */}
            <div className="mb-3">
              <label className="form-label">
                Subir comprobante de pago (Imagen):
              </label>
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
    </>
  );
};

export default PaymentPage;
