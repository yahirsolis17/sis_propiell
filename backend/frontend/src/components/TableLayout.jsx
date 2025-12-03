// src/components/common/TableLayout.jsx
import React from "react";
import "./TableLayout.css";

/**
 * Componente de tabla reutilizable para TODO el sistema.
 *
 * Soporta:
 * - Título y toolbar superior (filtros, buscador, acciones extra).
 * - Estados de carga y vacío.
 * - Columnas configurables por props (render por fila).
 * - Filtros controlados (chips / select).
 * - Buscador global controlado.
 * - Paginación controlada (lista plana o futura paginación desde backend).
 */
function TableLayout({
  // Header
  title,
  toolbarRight, // JSX opcional (botones extra, etc.)

  // Definición de columnas
  columns = [], // [{ id, label, width?, align?, render: (row) => ReactNode }]

  // Datos
  data = [],
  loading = false,
  emptyMessage = "No hay registros para mostrar.",

  // Buscador global
  enableSearch = false,
  searchPlaceholder = "Buscar...",
  searchValue = "",
  onSearchChange, // (value: string) => void

  // Filtros superiores
  filters = [], // [{ id, type: 'chips'|'select', label?, value, options: [{value,label}] }]
  onFilterChange, // (id, value) => void

  // Paginación (controlada desde el padre)
  enablePagination = false,
  page = 1, // 1-based
  pageSize = 10,
  total, // total de registros; si no se pasa, toma data.length
  onPageChange, // (nextPage: number) => void

  // Estilo
  dense = false, // tabla compacta
  striped = true,
  hover = true,

  // Opcional: click en fila
  onRowClick, // (row) => void

  // Clave de fila (para React key), por defecto "id"
  rowKey = "id",
}) {
  const effectivePageSize = pageSize > 0 ? pageSize : 10;
  const effectiveTotal =
    typeof total === "number" && !Number.isNaN(total)
      ? total
      : data.length || 0;

  const totalPages = enablePagination
    ? Math.max(1, Math.ceil(effectiveTotal / effectivePageSize))
    : 1;

  const handlePrev = () => {
    if (!onPageChange) return;
    if (page > 1) onPageChange(page - 1);
  };

  const handleNext = () => {
    if (!onPageChange) return;
    if (page < totalPages) onPageChange(page + 1);
  };

  const handleSearchChange = (e) => {
    if (!onSearchChange) return;
    onSearchChange(e.target.value);
  };

  const handleFilterClick = (filterId, value) => {
    if (!onFilterChange) return;
    onFilterChange(filterId, value);
  };

  const showPagination =
    enablePagination && effectiveTotal > effectivePageSize && totalPages > 1;

  const tableClassNames = [
    "table",
    "mb-0",
    dense ? "table-sm" : "",
    striped ? "table-striped" : "",
    hover ? "table-hover" : "",
    "align-middle",
  ]
    .filter(Boolean)
    .join(" ");

  const getRowKey = (row, idx) => {
    if (
      row &&
      rowKey &&
      Object.prototype.hasOwnProperty.call(row, rowKey)
    ) {
      return row[rowKey];
    }
    return row.id ?? idx;
  };

  return (
    <div className="table-layout card shadow-sm mb-4">
      {/* HEADER: título + filtros + buscador + acciones extra */}
      <div className="card-header d-flex flex-column flex-lg-row gap-2 align-items-lg-center justify-content-between">
        {/* Título */}
        <div className="d-flex flex-column">
          {title && <h5 className="mb-0">{title}</h5>}
        </div>

        {/* Filtros + buscador + toolbarRight */}
        <div className="d-flex flex-wrap align-items-center gap-2 justify-content-end">
          {/* Filtros */}
          {filters.map((filter) => {
            if (filter.type === "chips") {
              return (
                <div
                  key={filter.id}
                  className="d-flex flex-wrap align-items-center gap-1"
                >
                  {filter.label && (
                    <span className="me-1 fw-semibold">
                      {filter.label}:
                    </span>
                  )}
                  <div className="btn-group" role="group">
                    {filter.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={
                          "btn btn-sm " +
                          (filter.value === opt.value
                            ? "btn-primary"
                            : "btn-outline-primary")
                        }
                        onClick={() =>
                          handleFilterClick(filter.id, opt.value)
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (filter.type === "select") {
              return (
                <div
                  key={filter.id}
                  className="d-flex align-items-center gap-2"
                >
                  {filter.label && (
                    <label className="fw-semibold mb-0">
                      {filter.label}:
                    </label>
                  )}
                  <select
                    className="form-select form-select-sm"
                    value={filter.value}
                    onChange={(e) =>
                      handleFilterClick(filter.id, e.target.value)
                    }
                  >
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return null;
          })}

          {/* Buscador */}
          {enableSearch && (
            <div
              className="input-group input-group-sm"
              style={{ maxWidth: 260 }}
            >
              <span className="input-group-text">🔍</span>
              <input
                type="text"
                className="form-control"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={handleSearchChange}
              />
            </div>
          )}

          {/* Acciones extra (botones personalizados) */}
          {toolbarRight && <div>{toolbarRight}</div>}
        </div>
      </div>

      {/* BODY: loading / vacío / tabla */}
      <div className="card-body p-0">
        {loading ? (
          <div className="p-3 text-center text-muted">
            Cargando información...
          </div>
        ) : data.length === 0 ? (
          <div className="p-3 text-center text-muted">
            {emptyMessage}
          </div>
        ) : (
          <div className="table-responsive">
            <table className={tableClassNames}>
              <thead className="table-light">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      style={col.width ? { width: col.width } : undefined}
                      className={
                        col.align === "right"
                          ? "text-end"
                          : col.align === "center"
                          ? "text-center"
                          : "text-start"
                      }
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const key = getRowKey(row, idx);
                  const clickable = typeof onRowClick === "function";

                  return (
                    <tr
                      key={key}
                      onClick={clickable ? () => onRowClick(row) : undefined}
                      style={
                        clickable ? { cursor: "pointer" } : undefined
                      }
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={
                            col.align === "right"
                              ? "text-end"
                              : col.align === "center"
                              ? "text-center"
                              : "text-start"
                          }
                        >
                          {typeof col.render === "function"
                            ? col.render(row)
                            : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FOOTER: paginación */}
      {showPagination && (
        <div className="card-footer d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <small className="text-muted">
            Mostrando{" "}
            {Math.min(
              1 + (page - 1) * effectivePageSize,
              effectiveTotal
            )}{" "}
            -{" "}
            {Math.min(page * effectivePageSize, effectiveTotal)} de{" "}
            {effectiveTotal} registros
          </small>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={handlePrev}
            >
              Anterior
            </button>
            <span className="text-muted">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={handleNext}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableLayout;
