// src/pages/Citas.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import { getCurrentUser } from "../services/authService";

// Componentes del formulario de citas
import CalendarPicker from "../components/citas/CalendarPicker";
import TimeSlotSelector from "../components/citas/TimeSlotSelector";
import EspecialidadSelector from "../components/citas/EspecialidadSelector";

import "./citas.css";

const Citas = () => {
  const [especialidades, setEspecialidades] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [selectedEspecialidad, setSelectedEspecialidad] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const user = getCurrentUser();
  const navigate = useNavigate();

  // 1) Cargar especialidades
  useEffect(() => {
    const fetchEspecialidades = async () => {
      try {
        const res = await api.get("especialidades/");
        console.log("Especialidades obtenidas:", res.data);
        setEspecialidades(res.data);
      } catch (err) {
        console.error("Error cargando especialidades:", err);
        setError("Error cargando especialidades");
      }
    };
    fetchEspecialidades();
  }, []);

  // 2) Cargar horarios disponibles al cambiar especialidad o fecha
  useEffect(() => {
    const fetchHorarios = async () => {
      if (!selectedEspecialidad || !selectedDate) return;
      try {
        const params = {
          especialidad: selectedEspecialidad,
          fecha: selectedDate.toISOString().split("T")[0],
        };
        console.log("Parámetros enviados:", params);
        const res = await api.get("horarios/disponibles/", { params });
        console.log("Respuesta de horarios:", res.data);
        setHorarios(res.data.horas_disponibles || []);
      } catch (err) {
        console.error("Error en la solicitud de horarios:", err.response || err);
        setError("Error cargando horarios disponibles");
      }
    };
    fetchHorarios();
  }, [selectedEspecialidad, selectedDate]);

  // 3) Manejar el envío del formulario de cita
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("especialidad", selectedEspecialidad);
      formData.append(
        "fecha_hora",
        `${selectedDate.toISOString().split("T")[0]}T${selectedTime}`
      );
      formData.append("tipo", "I");

      console.log("Enviando formulario con datos:", {
        especialidad: selectedEspecialidad,
        fecha_hora: `${selectedDate.toISOString().split("T")[0]}T${selectedTime}`,
      });

      const response = await api.post("citas/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Cita creada:", response.data);
      if (response.status === 201) {
        // Redirigir al usuario a PaymentPage para la subida del comprobante
        const newCitaId = response.data.id;
        navigate(`/pago/${newCitaId}`);
      }
    } catch (err) {
      console.error("Error al crear la cita:", err.response || err);
      setError(
        err.response?.data?.error ||
          "Error al crear la cita. Verifica campos e intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="citas-page-container" style={{ paddingTop: "100px" }}>
        <div className="cita-form-card">
          <h2 className="citas-title">Agendar Nueva Cita</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit} className="cita-form">
            <EspecialidadSelector
              especialidades={especialidades}
              selectedEspecialidad={selectedEspecialidad}
              onChange={setSelectedEspecialidad}
            />
            <CalendarPicker
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              disabled={!selectedEspecialidad}
            />
            <TimeSlotSelector
              horarios={horarios}
              selectedTime={selectedTime}
              onTimeChange={setSelectedTime}
              disabled={!selectedDate}
            />
            {/* Se ha eliminado el componente PaymentUpload para evitar confusiones,
                la subida del comprobante se realiza en PaymentPage */}
            <button
              type="submit"
              className="btn-citas-confirm"
              disabled={loading || !selectedTime}
            >
              {loading ? "Agendando..." : "Confirmar Cita"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Citas;
