import React, { useEffect, useState } from "react";
import api from "../../services/api";

// Estilos inline inspirados en la paleta Pro-Piel
const styles = {
  headerBanner: {
    backgroundColor: "#00897b",
    color: "white",
    padding: "30px 20px",
    marginBottom: "30px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  welcomeTitle: {
    fontSize: "2rem",
    fontWeight: "bold",
    margin: 0,
    textAlign: "center",
  },
  subTitle: {
    textAlign: "center",
    opacity: 0.9,
    marginTop: "5px",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 20px",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
    padding: "25px",
    marginBottom: "40px",
    border: "1px solid #eee",
  },
  headerFlex: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    borderBottom: "1px solid #f0f0f0",
    paddingBottom: "15px",
  },
  sectionTitle: {
    fontSize: "1.5rem",
    color: "#444",
    margin: 0,
  },
  btnCreate: {
    backgroundColor: "#00897b",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.95rem",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    color: "#666",
    fontWeight: "600",
    borderBottom: "2px solid #eee",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f5f5f5",
    color: "#333",
  },
  btnEdit: {
    backgroundColor: "#ffc107",
    color: "#333",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "8px",
    fontSize: "0.85rem",
  },
  btnDelete: {
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "10px",
    width: "500px",
    maxWidth: "90%",
    boxShadow: "0 5px 20px rgba(0,0,0,0.2)",
  },
  inputGroup: { marginBottom: "15px" },
  input: {
    width: "100%",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "5px",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "5px",
    color: "#666",
    fontSize: "0.9rem",
  },
};

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const initialForm = {
    id: null,
    username: "",
    nombre: "",
    apellidos: "",
    email: "",
    telefono: "",
    role: "PACIENTE",
    password: "",
  };
  const [formData, setFormData] = useState(initialForm);

  // --- 1. CONSULTAR (Read) ---
  const fetchUsers = async () => {
    try {
      const res = await api.get("admin-users/");
      setUsers(res.data);
    } catch (error) {
      console.error("Error cargando usuarios", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2. ELIMINAR (Delete) ---
  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;
    try {
      await api.delete(`admin-users/${id}/`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  // --- 3. CREAR Y 4. MODIFICAR (Create / Update) ---
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const res = await api.put(`admin-users/${formData.id}/`, formData);
        setUsers((prev) =>
          prev.map((u) => (u.id === formData.id ? res.data : u))
        );
      } else {
        const res = await api.post("admin-users/", formData);
        setUsers((prev) => [res.data, ...prev]);
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert("Error al guardar. Revisa los datos.");
    }
  };

  // Auxiliares para el Modal
  const openCreate = () => {
    setFormData(initialForm);
    setIsEditing(false);
    setShowModal(true);
  };

  const openEdit = (user) => {
    setFormData({ ...user, password: "" });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", paddingBottom: "50px" }}>
      {/* Header Visual */}
      <div style={styles.headerBanner}>
        <h1 style={styles.welcomeTitle}>Administración Pro-Piel</h1>
        <p style={styles.subTitle}>Gestión de Usuarios y Roles</p>
      </div>

      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerFlex}>
            <h2 style={styles.sectionTitle}>Listado de Usuarios</h2>
            <button style={styles.btnCreate} onClick={openCreate}>
              + Nuevo Usuario
            </button>
          </div>

          {loading ? (
            <p>Cargando datos...</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nombre Completo</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Teléfono</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={styles.td}>
                      <strong>
                        {user.nombre} {user.apellidos}
                      </strong>
                      <br />
                      <small style={{ color: "#888" }}>{user.email}</small>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "10px",
                          fontSize: "0.85rem",
                          backgroundColor:
                            user.role === "ADMIN" ? "#d1e7dd" : "#e2e3e5",
                          color: user.role === "ADMIN" ? "#0f5132" : "#41464b",
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={styles.td}>{user.telefono}</td>
                    <td style={styles.td}>
                      <button style={styles.btnEdit} onClick={() => openEdit(user)}>
                        Editar
                      </button>
                      <button style={styles.btnDelete} onClick={() => handleDelete(user.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FORMULARIO MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0 }}>
              {isEditing ? "Editar Usuario" : "Crear Nuevo Usuario"}
            </h2>
            <form onSubmit={handleSave}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Usuario (Login)</label>
                <input
                  name="username"
                  style={styles.input}
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Nombre</label>
                  <input
                    name="nombre"
                    style={styles.input}
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Apellidos</label>
                  <input
                    name="apellidos"
                    style={styles.input}
                    value={formData.apellidos}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Rol</label>
                <select
                  name="role"
                  style={styles.input}
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="PACIENTE">PACIENTE</option>
                  <option value="DERMATOLOGO">DERMATÓLOGO</option>
                  <option value="PODOLOGO">PODÓLOGO</option>
                  <option value="TAMIZ">TAMIZ</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Teléfono</label>
                <input
                  name="telefono"
                  style={styles.input}
                  value={formData.telefono}
                  onChange={handleChange}
                />
              </div>
              {(!isEditing || formData.password !== "") && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {isEditing ? "Nueva Contraseña (opcional)" : "Contraseña"}
                  </label>
                  <input
                    type="password"
                    name="password"
                    style={styles.input}
                    value={formData.password}
                    onChange={handleChange}
                    required={!isEditing}
                  />
                </div>
              )}
              <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    marginRight: "10px",
                    padding: "10px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnCreate}>
                  Guardar Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
