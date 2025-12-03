// src/components/citas/ConsultModal.jsx
import React, { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  FiUser,
  FiDollarSign,
  FiAlertCircle,
  FiCamera,
  FiChevronRight,
  FiEye,
} from "react-icons/fi";
import { confirmarCita } from "../../services/citasService";
import { requiereConsentimiento } from "../../utils/clinicRules";
import "./ConsultModal.css";

const ConsultModal = ({
  show,
  onHide,
  cita,
  onActionSuccess,
  onVerConsentimiento, // opcional: para abrir un visor después
}) => {
  const [accion, setAccion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!show || !cita) return null;

  const tienePago = Array.isArray(cita.pagos) && cita.pagos.length > 0;
  const pago = tienePago ? cita.pagos[0] : null;

  const handleAction = async () => {
    if (!accion) {
      setError("Por favor selecciona una acción.");
      return;
    }

    // ✅ Permitir confirmar SIN pago, pero avisar al doctor
    if (accion === "confirmar" && !tienePago) {
      const continuar = window.confirm(
        "Esta cita no tiene un comprobante de pago registrado.\n" +
          "¿Quieres confirmar la cita con pago pendiente (pago en consultorio o por registrar)?"
      );
      if (!continuar) return;
    }

    setLoading(true);
    setError("");

    try {
      await confirmarCita(cita.id, accion);

      if (typeof onActionSuccess === "function") {
        onActionSuccess(cita.id);
      }

      if (typeof onHide === "function") {
        onHide();
      }
    } catch (err) {
      console.error("Error al procesar la acción de la cita:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Error al procesar la acción. Intenta de nuevo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerConsentimiento = () => {
    if (typeof onVerConsentimiento === "function") {
      onVerConsentimiento(cita);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString("es-MX", options);
  };

  // 🔹 Mensaje visual del estado del pago
  const renderPagoEstadoLabel = () => {
    if (!tienePago) {
      return (
        <span className="badge bg-warning text-dark">
          Pago pendiente (pago en consultorio o transferencia por registrar)
        </span>
      );
    }

    if (pago.verificado) {
      return <span className="badge bg-success">Pago verificado</span>;
    }

    return (
      <span className="badge bg-info text-dark">
        Comprobante recibido (por verificar)
      </span>
    );
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      dialogClassName="consult-modal-dialog"
    >
      <Modal.Header closeButton className="consult-modal-header">
        <Modal.Title>
          <div className="section-title-icon">
            <FiUser size={24} />
          </div>
          Detalles de la Cita Médica
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="consult-modal-body">
        <div className="consult-grid">
          {/* Sección Paciente */}
          <div className="consult-section">
            <h5 className="section-title">
              <div className="section-title-icon">
                <FiUser size={20} />
              </div>
              Información del Paciente
            </h5>

            <div className="patient-details-grid">
              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Nombre completo
                </span>
                <span className="detail-value">
                  {cita.paciente?.nombre || "N/A"}{" "}
                  {cita.paciente?.apellidos || ""}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Edad
                </span>
                <span className="detail-value">
                  {cita.paciente?.edad || "N/A"} años
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Sexo
                </span>
                <span className="detail-value">
                  {cita.paciente?.sexo || "N/A"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Teléfono
                </span>
                <span className="detail-value">
                  {cita.paciente?.telefono || "N/A"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Peso
                </span>
                <span className="detail-value">
                  {cita.paciente?.peso ? `${cita.paciente.peso} kg` : "N/A"}
                </span>
              </div>

              {/* Info básica de la cita */}
              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Especialidad
                </span>
                <span className="detail-value">
                  {cita.especialidad?.nombre || "Sin especialidad"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Fecha y hora
                </span>
                <span className="detail-value">
                  {formatDate(cita.fecha_hora) || "N/A"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Tipo de cita
                </span>
                <span className="detail-value">
                  {cita.tipo === "I"
                    ? "Inicial"
                    : cita.tipo === "S"
                    ? "Subsecuente"
                    : cita.tipo || "N/A"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  <FiChevronRight />
                  Consentimiento
                </span>
                <span className="detail-value">
                  {requiereConsentimiento(cita) ? (
                    cita.consentimiento_completado ? (
                      <>
                        <span className="badge bg-success me-2">
                          Completado
                        </span>
                        {typeof onVerConsentimiento === "function" && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 align-baseline"
                            onClick={handleVerConsentimiento}
                          >
                            <FiEye className="me-1" />
                            Ver
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="badge bg-secondary">Pendiente</span>
                    )
                  ) : (
                    <span className="text-muted small">
                      No aplica para esta especialidad
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Sección Pago */}
          <div className="consult-section">
            <h5 className="section-title">
              <div className="section-title-icon">
                <FiDollarSign size={20} />
              </div>
              Detalles de Pago
            </h5>

            {/* 🔹 Estado del pago en texto/badge */}
            <div className="mb-3">{renderPagoEstadoLabel()}</div>

            {tienePago ? (
              <>
                <div className="comprobante-container">
                  <img
                    src={pago.comprobante}
                    alt="Comprobante de pago"
                    className="comprobante-img"
                  />
                </div>

                {pago.comprobante && (
                  <div className="text-center mt-2">
                    <a
                      href={pago.comprobante}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm"
                    >
                      Ver comprobante completo
                    </a>
                  </div>
                )}

                <div className="payment-details-grid">
                  <div className="payment-item">
                    <span className="payment-label">Total:</span>
                    <span className="payment-value">${pago.total}</span>
                  </div>

                  <div className="payment-item">
                    <span className="payment-label">Pagado:</span>
                    <span className="payment-value">${pago.pagado}</span>
                  </div>

                  <div className="payment-item">
                    <span className="payment-label">Estado:</span>
                    <span
                      className="payment-value"
                      style={{
                        color: pago.verificado ? "#28a745" : "#dc3545",
                      }}
                    >
                      {pago.verificado ? "Verificado" : "Pendiente"}
                    </span>
                  </div>

                  {pago.fecha && (
                    <div className="payment-item">
                      <span className="payment-label">Fecha pago:</span>
                      <span className="payment-value">
                        {formatDate(pago.fecha)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <FiCamera size={48} color="#ccc" />
                <p className="text-muted mt-2">
                  No se encontró comprobante. El paciente puede pagar en
                  consultorio o subirlo más tarde.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sección de Acciones */}
        <div className="action-container">
          <div className="action-header">
            <div className="section-title-icon">
              <FiAlertCircle size={24} />
            </div>
            <h5 className="section-title">Acciones Disponibles</h5>
          </div>

          <select
            className="form-select action-select"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            disabled={loading}
          >
            <option value="">Seleccionar acción...</option>
            <option value="confirmar">✅ Confirmar Cita</option>
            <option value="cancelar">❌ Cancelar Cita</option>
          </select>

          {error && (
            <div className="error-message mt-3">
              <FiAlertCircle /> {error}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="consult-modal-footer">
        <Button
          variant="secondary"
          className="btn-modal"
          onClick={onHide}
          disabled={loading}
        >
          Cancelar
        </Button>

        <Button
          variant="primary"
          className="btn-modal"
          onClick={handleAction}
          disabled={loading || !accion}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Procesando...
            </>
          ) : (
            "Confirmar Acción"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConsultModal;
