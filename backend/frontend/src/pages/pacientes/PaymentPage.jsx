// src/pages/pagos/PaymentPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { crearPagoTransferencia } from "../../services/pagosService";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./PaymentPage.css";

const PaymentPage = () => {
  const { citaId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [comprobante, setComprobante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔀 Método de pago seleccionado: TRANSFERENCIA (depósito/transferencia) o PRESENCIAL
  const [metodoPago, setMetodoPago] = useState("TRANSFERENCIA");

  // 🧭 Helper para ruta de dashboard según rol
  const getRolePath = () => {
    const role = (user?.role || "PACIENTE").toLowerCase();
    return `/dashboard/${role}`;
  };

  // 🔐 Verificar autenticación con JWT
  useEffect(() => {
    if (!user) return;

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

    checkAuth();

    return () => controller.abort();
  }, [user, navigate]);

  // 🔐 Solo PACIENTE debe usar esta pantalla
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "PACIENTE") {
    return <Navigate to={getRolePath()} replace />;
  }

  // 🧷 Cambio de método de pago (tabs)
  const handleMetodoPagoChange = (nuevoMetodo) => {
    if (nuevoMetodo === metodoPago) return;
    setMetodoPago(nuevoMetodo);
    setError("");

    // Si el usuario se pasa a "PRESENCIAL", limpiamos el comprobante
    if (nuevoMetodo === "PRESENCIAL") {
      setComprobante(null);
    }
  };

  // 📁 Manejar selección de archivo (solo para depósito/transferencia)
  const handleFileChange = (e) => {
    setError("");
    const file = e.target.files[0];

    if (!file) {
      setComprobante(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setComprobante(null);
      setError("Solo se permiten imágenes (PNG, JPG o JPEG).");
      return;
    }

    // Límite de tamaño (10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setComprobante(null);
      setError("El archivo es demasiado grande (máximo 10 MB).");
      return;
    }

    setComprobante(file);
  };

  // 📤 Enviar comprobante al backend (DEPÓSITO / TRANSFERENCIA)
  const handleSubmitTransferencia = async (e) => {
    e.preventDefault();
    setError("");

    if (!citaId) {
      setError("No se encontró el identificador de la cita.");
      return;
    }

    if (!comprobante) {
      setError(
        "Debes subir un comprobante de pago para pagos por depósito/transferencia."
      );
      return;
    }

    try {
      setLoading(true);

      await crearPagoTransferencia({
        citaId,
        comprobanteFile: comprobante,
        // Si más adelante agregas monto personalizado:
        // total: <valor>,
      });

      toast.success(
        "Comprobante subido correctamente. Tu pago quedará pendiente de verificación.",
        {
          position: "top-right",
          autoClose: 4500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
          theme: "light",
        }
      );

      const rolePath = getRolePath();
      setTimeout(() => {
        navigate(rolePath);
      }, 1200);
    } catch (err) {
      console.error("Error al subir el comprobante:", err);

      const data = err.response?.data;
      let backendError = "Error al subir el comprobante.";

      if (typeof data === "string") {
        backendError = data;
      } else if (data) {
        if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
          backendError = data.non_field_errors[0];
        } else if (Array.isArray(data.cita) && data.cita[0]) {
          backendError = data.cita[0];
        } else if (Array.isArray(data.comprobante) && data.comprobante[0]) {
          backendError = data.comprobante[0];
        } else if (Array.isArray(data.total) && data.total[0]) {
          backendError = data.total[0];
        } else if (data.error) {
          backendError = data.error;
        } else if (data.detail) {
          backendError = data.detail;
        }
      }

      setError(backendError);
    } finally {
      setLoading(false);
    }
  };

  // 🧾 Confirmar que pagará en consultorio (PRESENCIAL)
  const handleConfirmPresencial = () => {
    setError("");

    toast.info(
      "Tu cita quedó registrada con pago pendiente. Realiza tu pago en el consultorio el día de tu cita.",
      {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: "light",
      }
    );

    const rolePath = getRolePath();
    setTimeout(() => {
      navigate(rolePath);
    }, 1200);
  };

  return (
    <>
      <Navbar />
      <ToastContainer />

      <div className="citas-container" style={{ paddingTop: "120px" }}>
        <div className="cita-form-card">
          <h2 className="citas-title">Pago de tu cita</h2>

          {/* Selector de método de pago (tabs simples) */}
          <div className="payment-method-switch">
            <button
              type="button"
              className={`payment-tab ${
                metodoPago === "TRANSFERENCIA" ? "active" : ""
              }`}
              onClick={() => handleMetodoPagoChange("TRANSFERENCIA")}
              disabled={loading}
            >
              Depósito / Transferencia
            </button>
            <button
              type="button"
              className={`payment-tab ${
                metodoPago === "PRESENCIAL" ? "active" : ""
              }`}
              onClick={() => handleMetodoPagoChange("PRESENCIAL")}
              disabled={loading}
            >
              Pagar en consultorio
            </button>
          </div>

          {error && <div className="alert alert-danger mt-3">{error}</div>}

          {/* 🧾 Modo Depósito / Transferencia */}
          {metodoPago === "TRANSFERENCIA" && (
            <>
              <div className="payment-bank-box">
                <h3 className="payment-bank-title">Datos bancarios</h3>
                <p className="payment-bank-line">
                  <strong>Nombre del titular:</strong> Clínica Dermatológica
                  ProPiel
                </p>
                <p className="payment-bank-line">
                  <strong>Banco:</strong> Banco Ejemplo S.A.
                </p>
                <p className="payment-bank-line">
                  <strong>Número de cuenta:</strong> 1234 5678 9012 3456
                </p>
                <p className="payment-bank-line">
                  <strong>CLABE interbancaria:</strong> 012345678901234567
                </p>
                <p className="payment-bank-note">
                  Realiza tu pago y sube el comprobante en formato de imagen
                  (captura de pantalla o foto legible). Tu pago será revisado y
                  verificado por el especialista.
                </p>
              </div>

              <form
                onSubmit={handleSubmitTransferencia}
                className="cita-form payment-form"
              >
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
                  disabled={loading || !citaId}
                >
                  {loading ? "Subiendo..." : "Subir comprobante"}
                </button>
              </form>
            </>
          )}

          {/* 💳 Modo Pago en consultorio */}
          {metodoPago === "PRESENCIAL" && (
            <div className="payment-presencial-box">
              <h3 className="payment-presencial-title">
                Pago pendiente en consultorio
              </h3>
              <p className="payment-presencial-message">
                Tu cita quedará registrada con <strong>pago pendiente</strong>.
                Por favor, realiza tu pago directamente en el consultorio el día
                de tu cita. El personal de la clínica registrará tu pago en el
                sistema.
              </p>
              <p className="payment-presencial-note">
                Si decides más adelante pagar por depósito o transferencia,
                podrás regresar a esta pantalla y subir tu comprobante mientras
                la cita siga activa.
              </p>

              <button
                type="button"
                className="btn-payment-submit"
                onClick={handleConfirmPresencial}
                disabled={loading}
              >
                Confirmar pago en consultorio
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentPage;
