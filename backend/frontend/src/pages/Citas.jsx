// src/pages/Citas.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import api from "../services/api";
import Navbar from "../components/Navbar";
import { getCurrentUser } from "../services/authService";
import CalendarPicker from "../components/citas/CalendarPicker";
import TimeSlotSelector from "../components/citas/TimeSlotSelector";
import EspecialidadSelector from "../components/citas/EspecialidadSelector";

// 🔥 Lógica nueva centralizada
import { createCita } from "../services/citasService";

import "./Citas.css";

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

  // Cargar especialidades
  useEffect(() => {
    const fetchEspecialidades = async () => {
      try {
        const res = await api.get("especialidades/");
        setEspecialidades(res.data);
      } catch (err) {
        console.error("Error cargando especialidades:", err);
        setError("Error cargando especialidades");
      }
    };
    fetchEspecialidades();
  }, []);

  // Cargar horarios disponibles según especialidad + fecha
  useEffect(() => {
    const fetchHorarios = async () => {
      if (!selectedEspecialidad || !selectedDate) return;
      try {
        const params = {
          especialidad: selectedEspecialidad,
          fecha: selectedDate.toISOString().split("T")[0],
        };
        const res = await api.get("horarios/disponibles/", { params });
        setHorarios(res.data.horas_disponibles || []);
      } catch (err) {
        console.error("Error en la solicitud de horarios:", err.response || err);
        setError("Error cargando horarios disponibles");
      }
    };
    fetchHorarios();
  }, [selectedEspecialidad, selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validación rápida antes del backend
    if (!selectedEspecialidad || !selectedDate || !selectedTime) {
      setError("Selecciona especialidad, fecha y horario.");
      return;
    }

    setLoading(true);
    try {
      const fechaISO = selectedDate.toISOString().split("T")[0];

      // 🔥 Lógica nueva: enviamos JSON usando el servicio createCita
      const payload = {
        especialidad: selectedEspecialidad,
        fecha_hora: `${fechaISO}T${selectedTime}`,
        tipo: "I", // cita inicial
      };

      const data = await createCita(payload); // devuelve res.data

      toast.success("Cita pendiente, suba su comprobante de pago", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: "light",
      });

      const newCitaId = data.id;

      // Navegamos a la pantalla de pago después del toast
      setTimeout(() => {
        navigate(`/pago/${newCitaId}`);
      }, 3000);
    } catch (err) {
      console.error("Error al crear la cita:", err.response || err);

      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        (typeof err.response?.data === "string"
          ? err.response.data
          : null) ||
        "Error al crear la cita. Verifica campos e intenta de nuevo.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <ToastContainer />
      <div className="citas-page-container">
        <div className="cita-form-wrapper">
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
      </div>
    </>
  );
};

export default Citas;
