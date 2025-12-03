// src/pages/pacientes/Citas.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getEspecialidades,
  getHorariosDisponibles,
  crearCita,
} from "../../services/citasService";

import CalendarPicker from "../../components/citas/CalendarPicker";
import TimeSlotSelector from "../../components/citas/TimeSlotSelector";
import EspecialidadSelector from "../../components/citas/EspecialidadSelector";

import "./Citas.css";

const Citas = () => {
  const [especialidades, setEspecialidades] = useState([]);
  const [horarios, setHorarios] = useState([]);

  const [selectedEspecialidad, setSelectedEspecialidad] = useState("");
  const [selectedDate, setSelectedDate] = useState(null); // Date
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);

  const [error, setError] = useState("");

  const user = getCurrentUser();
  const navigate = useNavigate();

  // Helper para formatear fecha a YYYY-MM-DD (lo que espera el backend)
  const getFechaISO = (date) => {
    if (!date) return null;
    try {
      return date.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  /* 🔐 Verificación de autenticación */
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

    return () => {
      controller.abort();
    };
  }, [user, navigate]);

  // Si no hay usuario, mandamos a login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* 📌 Cargar especialidades */
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchEspecialidades = async () => {
      try {
        setLoadingEspecialidades(true);
        setError("");

        const data = await getEspecialidades(controller.signal);
        if (!isMounted) return;

        setEspecialidades(data || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error cargando especialidades:", err);
          setError("Error cargando especialidades. Intenta de nuevo.");
        }
      } finally {
        if (isMounted) {
          setLoadingEspecialidades(false);
        }
      }
    };

    fetchEspecialidades();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  /* ⏰ Cargar horarios cuando cambian especialidad/fecha */
  useEffect(() => {
    if (!selectedEspecialidad || !selectedDate) {
      setHorarios([]);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchHorarios = async () => {
      try {
        setLoadingHorarios(true);
        setError("");

        const fechaISO = getFechaISO(selectedDate); // YYYY-MM-DD
        if (!fechaISO) {
          setHorarios([]);
          return;
        }

        const horas = await getHorariosDisponibles(
          selectedEspecialidad,
          fechaISO,
          controller.signal
        );

        if (!isMounted) return;
        setHorarios(horas || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error cargando horarios disponibles:", err);
          setError("Error cargando horarios disponibles. Intenta de nuevo.");
        }
      } finally {
        if (isMounted) {
          setLoadingHorarios(false);
        }
      }
    };

    fetchHorarios();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [selectedEspecialidad, selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedEspecialidad) {
      setError("Selecciona una especialidad.");
      return;
    }
    if (!selectedDate) {
      setError("Selecciona una fecha.");
      return;
    }

    const fechaISO = getFechaISO(selectedDate);
    if (!fechaISO) {
      setError("Fecha inválida. Vuelve a seleccionar el día en el calendario.");
      return;
    }

    if (!selectedTime) {
      setError("Selecciona un horario.");
      return;
    }

    try {
      setLoading(true);

      // alineado con citasService.crearCita({ especialidadId, fechaISO, hora, tipo })
      const citaCreada = await crearCita({
        especialidadId: selectedEspecialidad,
        fechaISO,
        hora: selectedTime,
        tipo: "I",
      });

      toast.success("Cita registrada. Ahora define tu método de pago.", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: "light",
      });

      const newCitaId = citaCreada.id;

      setTimeout(() => {
        navigate(`/pago/${newCitaId}`);
      }, 3000);
    } catch (err) {
      console.error("Error al crear la cita:", err);

      const backendError =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Error al crear la cita. Verifica los datos e intenta de nuevo.";

      setError(backendError);
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
              {/* ESPECIALIDAD */}
              <EspecialidadSelector
                especialidades={especialidades}
                selectedEspecialidad={selectedEspecialidad}
                onChange={(value) => {
                  setSelectedEspecialidad(value);
                  setSelectedDate(null);
                  setSelectedTime("");
                  setHorarios([]);
                }}
                loading={loadingEspecialidades}
              />

              {/* CALENDARIO */}
              <CalendarPicker
                selectedDate={selectedDate}
                onDateChange={(date) => {
                  setSelectedDate(date);
                  setSelectedTime("");
                }}
                disabled={!selectedEspecialidad || loadingEspecialidades}
              />

              {/* HORARIOS */}
              <TimeSlotSelector
                horarios={horarios}
                selectedTime={selectedTime}
                onTimeChange={setSelectedTime}
                disabled={
                  !selectedDate || loadingHorarios || loadingEspecialidades
                }
                loading={loadingHorarios}
              />

              <button
                type="submit"
                className="btn-citas-confirm"
                disabled={
                  loading ||
                  !selectedEspecialidad ||
                  !selectedDate ||
                  !selectedTime
                }
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
