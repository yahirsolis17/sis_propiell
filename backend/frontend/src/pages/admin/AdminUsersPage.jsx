// src/pages/admin/AdminUsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FiUserPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiX } from "react-icons/fi";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
} from "../../services/adminUsersService";

import "./AdminUsersPage.css";

const ROLES_ESPECIALISTAS = ["DERMATOLOGO", "PODOLOGO", "TAMIZ"];

const roleLabel = (role) => {
  if (!role) return "Sin rol";
  const r = role.toString().toUpperCase();
  if (r === "PACIENTE") return "Paciente";
  if (r === "DERMATOLOGO") return "Dermatólogo";
  if (r === "PODOLOGO") return "Podólogo";
  if (r === "TAMIZ") return "Tamiz Neonatal";
  if (r === "ADMIN") return "Administrador";
  return r;
};

const sexoLabel = (sexo) => {
  if (!sexo) return "-";
  if (sexo === "M") return "Masculino";
  if (sexo === "F") return "Femenino";
  return sexo;
};

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [currentUser] = useState(() => getCurrentUser());

  const [isAuthorized, setIsAuthorized] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    edad: "",
    sexo: "",
    peso: "",
    telefono: "",
    role: "PACIENTE",
    password: "",
  });
  const [formError, setFormError] = useState("");
  const [backendErrors, setBackendErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = getCurrentUser();
        const sessionOk = await verifyAuth();

        if (!sessionOk || !user) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsAuthorized(false);
          return;
        }

        if (user.role !== "ADMIN") {
          setIsAuthorized(false);
          return;
        }
      } catch (err) {
        console.error("Error verificando autenticación:", err);
        setIsAuthorized(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const fetchUsers = async (signal) => {
    try {
      setLoading(true);
      setFetchError("");
      setSuccessMessage("");

      const data = await getAdminUsers({}, signal);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      if (signal?.aborted) return;

      console.error("Error cargando usuarios (admin):", err);

      const status = err.response?.status;

      if (status === 401) {
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        navigate("/login", { replace: true });
        return;
      }

      if (status === 403) {
        setFetchError("No tienes permisos para administrar usuarios.");
        return;
      }

      setFetchError(
        "Error al cargar usuarios. Intenta nuevamente en unos momentos."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);

    return () => controller.abort();
  }, []);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    if (filterTipo === "PACIENTES") {
      list = list.filter((u) => u.role === "PACIENTE");
    } else if (filterTipo === "ESPECIALISTAS") {
      list = list.filter((u) => ROLES_ESPECIALISTAS.includes(u.role));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const nombre = `${u.nombre || ""} ${u.apellidos || ""}`.toLowerCase();
        const tel = (u.telefono || "").toLowerCase();
        return nombre.includes(q) || tel.includes(q);
      });
    }

    return list;
  }, [users, filterTipo, search]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingUser(null);
    setFormError("");
    setBackendErrors({});
    setFormData({
      nombre: "",
      apellidos: "",
      edad: "",
      sexo: "",
      peso: "",
      telefono: "",
      role: "PACIENTE",
      password: "",
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode("edit");
    setEditingUser(user);
    setFormError("");
    setBackendErrors({});
    setFormData({
      nombre: user.nombre || "",
      apellidos: user.apellidos || "",
      edad: user.edad ?? "",
      sexo: user.sexo || "",
      peso: user.peso ?? "",
      telefono: user.telefono || "",
      role: user.role || "PACIENTE",
      password: "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError("");
    setBackendErrors({});
    setSaving(false);
  };

  const handleChange = (evt) => {
    const { name, value } = evt.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setFormError("");
    setBackendErrors({});
    setSuccessMessage("");

    if (!formData.nombre.trim() || !formData.apellidos.trim()) {
      setFormError("Nombre y apellidos son obligatorios.");
      return;
    }
    if (!formData.telefono.trim()) {
      setFormError("El teléfono es obligatorio.");
      return;
    }
    if (modalMode === "create" && !formData.password.trim()) {
      setFormError("La contraseña es obligatoria para nuevos usuarios.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        telefono: formData.telefono.trim(),
        role: formData.role,
      };

      if (formData.edad !== "" && formData.edad !== null) {
        payload.edad = Number(formData.edad);
      }
      if (formData.peso !== "" && formData.peso !== null) {
        payload.peso = Number(formData.peso);
      }
      if (formData.sexo) {
        payload.sexo = formData.sexo;
      }

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      if (modalMode === "create") {
        await createAdminUser(payload);
        setSuccessMessage("Usuario creado exitosamente.");
      } else if (modalMode === "edit" && editingUser?.id) {
        await updateAdminUser(editingUser.id, payload);
        setSuccessMessage("Usuario actualizado exitosamente.");
      }

      await fetchUsers();
      setTimeout(() => {
        closeModal();
        setSuccessMessage("");
      }, 1500);
    } catch (err) {
      console.error("Error guardando usuario (admin):", err);

      if (err.response?.data) {
        const data = err.response.data;
        setBackendErrors(data);

        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          if (Array.isArray(val)) {
            setFormError(`${firstKey}: ${val[0]}`);
          } else if (typeof val === "string") {
            setFormError(val);
          } else {
            setFormError("Errores de validación. Revisa los campos.");
          }
        } else {
          setFormError("No se pudo guardar el usuario. Revisa los datos.");
        }
      } else {
        setFormError(
          "Error inesperado al guardar el usuario. Intenta de nuevo."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    const textoAccion = user.is_active ? "desactivar" : "activar";
    const confirmMsg = `¿Seguro que deseas ${textoAccion} a este usuario?\n\n` +
      "No se eliminarán sus datos, solo se bloqueará su acceso al sistema.";

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      setFetchError("");

      const payload = { is_active: !user.is_active };
      await updateAdminUser(user.id, payload);

      setSuccessMessage(`Usuario ${user.is_active ? 'desactivado' : 'activado'} exitosamente.`);
      await fetchUsers();
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error cambiando estado de usuario:", err);
      setFetchError(
        "No se pudo cambiar el estado del usuario. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized && !checkingAuth) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-users-page">
      <Navbar />
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Gestión de usuarios</h1>
            <p className="admin-subtitle">
              Administra pacientes y especialistas desde un solo panel.
            </p>
          </div>
          <button
            type="button"
            className="admin-primary-btn"
            onClick={openCreateModal}
          >
            <FiUserPlus size={18} />
            <span>Nuevo usuario</span>
          </button>
        </div>

        {/* Mensajes de éxito/error */}
        {successMessage && (
          <div className="admin-alert alert-success">
            {successMessage}
          </div>
        )}
        
        {fetchError && (
          <div className="admin-alert alert-danger">
            {fetchError}
          </div>
        )}

        {/* Filtros */}
        <div className="admin-filters">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="filter-label">Tipo de usuario</label>
              <select
                className="filter-select"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                <option value="PACIENTES">Solo pacientes</option>
                <option value="ESPECIALISTAS">Solo especialistas</option>
              </select>
            </div>
            <div className="col-md-8">
              <label className="filter-label">
                Buscar (nombre o teléfono)
              </label>
              <input
                type="text"
                className="filter-input"
                placeholder="Ej. María, 744..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>No hay usuarios que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Edad</th>
                  <th>Sexo</th>
                  <th>Peso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.nombre || u.apellidos
                        ? `${u.nombre || ""} ${u.apellidos || ""}`.trim()
                        : u.username || "-"}
                    </td>
                    <td>{u.telefono || "-"}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>{u.edad ?? "-"}</td>
                    <td>{sexoLabel(u.sexo)}</td>
                    <td>{u.peso ?? "-"}</td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'badge-active' : 'badge-inactive'}`}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="action-btn btn-edit"
                          onClick={() => openEditModal(u)}
                        >
                          <FiEdit2 size={14} />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          className={`action-btn btn-toggle ${u.is_active ? '' : 'active'}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active ? (
                            <FiToggleLeft size={16} />
                          ) : (
                            <FiToggleRight size={16} />
                          )}
                          <span>{u.is_active ? "Desactivar" : "Activar"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="admin-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">
                  {modalMode === "create" ? "Nuevo usuario" : "Editar usuario"}
                </h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={closeModal}
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="modal-body">
                {formError && (
                  <div className="admin-alert alert-danger">{formError}</div>
                )}

                <form onSubmit={handleSubmit} className="modal-form">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Nombre</label>
                      <input
                        type="text"
                        name="nombre"
                        className="modal-input"
                        value={formData.nombre}
                        onChange={handleChange}
                        required
                      />
                      {backendErrors.nombre && (
                        <small className="error-text">
                          {backendErrors.nombre[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Apellidos</label>
                      <input
                        type="text"
                        name="apellidos"
                        className="modal-input"
                        value={formData.apellidos}
                        onChange={handleChange}
                        required
                      />
                      {backendErrors.apellidos && (
                        <small className="error-text">
                          {backendErrors.apellidos[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Teléfono</label>
                      <input
                        type="text"
                        name="telefono"
                        className="modal-input"
                        value={formData.telefono}
                        onChange={handleChange}
                        required
                      />
                      {backendErrors.telefono && (
                        <small className="error-text">
                          {backendErrors.telefono[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Rol</label>
                      <select
                        name="role"
                        className="modal-select"
                        value={formData.role}
                        onChange={handleChange}
                      >
                        <option value="PACIENTE">Paciente</option>
                        <option value="DERMATOLOGO">Dermatólogo</option>
                        <option value="PODOLOGO">Podólogo</option>
                        <option value="TAMIZ">Tamiz Neonatal</option>
                      </select>
                      {backendErrors.role && (
                        <small className="error-text">
                          {backendErrors.role[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Sexo</label>
                      <select
                        name="sexo"
                        className="modal-select"
                        value={formData.sexo}
                        onChange={handleChange}
                      >
                        <option value="">Sin especificar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="Otro">Otro</option>
                      </select>
                      {backendErrors.sexo && (
                        <small className="error-text">
                          {backendErrors.sexo[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Edad</label>
                      <input
                        type="number"
                        name="edad"
                        className="modal-input"
                        min="0"
                        value={formData.edad}
                        onChange={handleChange}
                      />
                      {backendErrors.edad && (
                        <small className="error-text">
                          {backendErrors.edad[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Peso (kg)</label>
                      <input
                        type="number"
                        name="peso"
                        className="modal-input"
                        min="0"
                        step="0.1"
                        value={formData.peso}
                        onChange={handleChange}
                      />
                      {backendErrors.peso && (
                        <small className="error-text">
                          {backendErrors.peso[0]}
                        </small>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Contraseña{" "}
                        {modalMode === "edit" && (
                          <small className="text-muted">
                            (déjalo vacío para no cambiarla)
                          </small>
                        )}
                      </label>
                      <input
                        type="password"
                        name="password"
                        className="modal-input"
                        value={formData.password}
                        onChange={handleChange}
                        required={modalMode === "create"}
                      />
                      {backendErrors.password && (
                        <small className="error-text">
                          {backendErrors.password[0]}
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="modal-secondary-btn"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      className="modal-primary-btn"
                      disabled={saving}
                    >
                      {saving
                        ? "Guardando..."
                        : modalMode === "create"
                        ? "Crear usuario"
                        : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;