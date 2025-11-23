// src/pages/PaymentPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";

import { getCurrentUser, verifyAuth } from "../services/authService";
import Navbar from "../components/Navbar";
import {
  getCitaById,
  uploadPagoComprobante,
} from "../services/citasService";

import "./PaymentPage.css";

const PaymentPage = () => {
  const { citaId } = useParams();
  const navigate = useNavigate();

  // 🔒 Congelamos el usuario para que no cambie entre renders
  const [user] = useState(() => getCurrentUser());

  const [cita, setCita] = useState(null);
  const [comprobante, setComprobante] = useState(null);

  const [loading, setLoading] = useState(true); // carga inicial de datos
  const [submitting, setSubmitting] = useState(false); // subida del archivo
  const [error, setError] = useState("");

  // Datos bancarios (puedes cambiarlos por los reales cuando toque)
  const bankData = {
    banco: "Banco de Prueba",
    cuenta: "0123456789",
    clabe: "012345678901234567",
    beneficiario: "Clínica PRO-PIEL (Datos de prueba)",
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Cargar cita + validar auth y que la cita sea del paciente
  useEffect(() => {
    if (!citaId || !user?.id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const init = async () => {
      try {
        const valid = await verifyAuth(controller.signal);
        if (!valid) {
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        const data = await getCitaById(citaId, controller.signal);
        if (!isMounted) return;

        if (data?.paciente?.id !== user.id) {
          setError(
            "No tienes permiso para subir el comprobante de pago de esta cita."
          );
          return;
        }

        setCita(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error cargando cita:", err);
          setError("Error al cargar la información de la cita.");
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [citaId, user?.id, navigate]);

  // Copiar texto al portapapeles
  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      // Si no quieres alertas, puedes quitar esto
      window.alert(`${label} copiado al portapapeles`);
    } catch (err) {
      console.error("Error al copiar:", err);
      window.alert("No se pudo copiar al portapapeles.");
    }
  };

  // Selección de archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError("");

    if (file && file.type.startsWith("image/")) {
      setComprobante(file);
    } else {
      setComprobante(null);
      setError("Solo se permiten imágenes (PNG, JPG o JPEG).");
    }
  };

  // Enviar comprobante con la lógica nueva
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!comprobante) {
      setError("Debe subir un comprobante de pago (imagen).");
      return;
    }

    if (!cita) {
      setError("La cita aún no se ha cargado correctamente.");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const formData = new FormData();
      formData.append("cita", citaId);
      formData.append("comprobante", comprobante);

      await uploadPagoComprobante(formData);

      navigate("/dashboard/paciente");
    } catch (err) {
      console.error("Error al subir el comprobante:", err.response || err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Error al subir el comprobante.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="citas-container" style={{ paddingTop: "100px" }}>
        <div className="cita-form-card">
          {loading ? (
            <div className="loading-spinner">Cargando datos de la cita...</div>
          ) : error && !cita ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <>
              <h2 className="citas-title">Subir Comprobante de Pago</h2>

              {/* Bloque de datos bancarios */}
              <section className="payment-info-section">
                <p className="payment-info-intro">
                  Realiza tu pago por transferencia bancaria usando los
                  siguientes datos <strong>de prueba</strong>:
                </p>

                <p className="payment-info-row">
                  <strong>Banco:</strong> {bankData.banco}
                </p>

                <div className="payment-info-row payment-info-row-inline">
                  <span>
                    <strong>Cuenta:</strong> {bankData.cuenta}
                  </span>
                  <button
                    type="button"
                    className="payment-copy-btn"
                    onClick={() => handleCopy(bankData.cuenta, "Cuenta")}
                  >
                    Copiar cuenta
                  </button>
                </div>

                <div className="payment-info-row payment-info-row-inline">
                  <span>
                    <strong>CLABE:</strong> {bankData.clabe}
                  </span>
                  <button
                    type="button"
                    className="payment-copy-btn"
                    onClick={() => handleCopy(bankData.clabe, "CLABE")}
                  >
                    Copiar CLABE
                  </button>
                </div>

                <div className="payment-info-row payment-info-row-inline">
                  <span>
                    <strong>Beneficiario:</strong> {bankData.beneficiario}
                  </span>
                  <button
                    type="button"
                    className="payment-copy-btn"
                    onClick={() =>
                      handleCopy(bankData.beneficiario, "Nombre del beneficiario")
                    }
                  >
                    Copiar nombre
                  </button>
                </div>

                <p className="payment-info-warning">
                  Estos datos son únicamente de demostración y no corresponden
                  a una cuenta real.
                </p>
              </section>

              {/* Errores de validación / subida */}
              {error && cita && (
                <div className="alert alert-danger">{error}</div>
              )}

              {/* Formulario para subir comprobante */}
              <form onSubmit={handleSubmit} className="cita-form">
                <div className="mb-3">
                  <label className="form-label">
                    Subir comprobante de pago (Imagen):
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-control"
                    disabled={submitting}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-payment-submit"
                  disabled={submitting || !comprobante}
                >
                  {submitting ? "Subiendo..." : "Subir Comprobante"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentPage;
