# backend/users/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    AdminUserView,
    LoginView,
    DashboardView,
    LogoutView,
    EspecialidadListAPI,
    HorarioDisponibleAPI,
    CitaListCreateAPI,
    CitaDetailAPI,
    CitaConfirmAPI,
    CitaCancelarPacienteAPI,
    TratamientoAPI,
    PagoListAPI,
    CitaSubsecuenteCreateAPI,
    CitaProgramarSubsecuenteAPI,
    CitaReprogramarAPI,
    VerifyAuthView,
    PagoCreateAPI,
    HorarioCreateAPI,
    TamizResultadosAPI,
    CitaConsentimientoAPI,
    CitaConsentimientoDownloadAPI,
    PacienteListAPI,
    PacienteDetailAPI,
    PacienteCitasListAPI,
    UserListAPI,
    UserDetailAPI,
    ReportePacienteListCreateAPI,
    ReportePacienteDetailAPI,
    RecetaListCreateAPI,
    RecetaDetailAPI,
    PagoConsultorioCreateAPI,
    PagoRevertAPI,
    TratamientoFinalizarAPI,
    ProcedimientoConsultaListCreateAPI,
    ProcedimientoConsultaDetailAPI,
    UserAdminViewSet,
)

# Router DRF para endpoints de admin de usuarios
router = DefaultRouter()
router.register(r"admin-users", UserAdminViewSet, basename="admin-user")

urlpatterns = [
    # CRUD de usuarios admin (router)
    path("", include(router.urls)),

    # Auth
    path("auth/verify/", VerifyAuthView.as_view(), name="verify-auth"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("create-user/", AdminUserView.as_view(), name="admin-create-user"),
    path("dashboard/<str:role>/", DashboardView.as_view(), name="dashboard"),

    # Catálogos y horarios
    path("especialidades/", EspecialidadListAPI.as_view(), name="especialidades-list"),
    path(
        "horarios/disponibles/",
        HorarioDisponibleAPI.as_view(),
        name="horarios-disponibles",
    ),
    path("horarios/", HorarioCreateAPI.as_view(), name="horarios-create"),

    # Citas
    path("citas/", CitaListCreateAPI.as_view(), name="citas-list-create"),
    path(
        "citas/subsecuente/",
        CitaSubsecuenteCreateAPI.as_view(),
        name="cita-subsecuente",
    ),
    path("citas/<int:pk>/", CitaDetailAPI.as_view(), name="cita-detail"),
    path(
        "citas/<int:pk>/confirmar/",
        CitaConfirmAPI.as_view(),
        name="cita-confirmar",
    ),
    path(
        "citas/<int:pk>/cancelar/",
        CitaCancelarPacienteAPI.as_view(),
        name="cita-cancelar-paciente",
    ),
    path(
        "citas/<int:pk>/programar_subsecuente/",
        CitaProgramarSubsecuenteAPI.as_view(),
        name="cita-programar-subsecuente",
    ),
    path(
        "citas/<int:pk>/reprogramar/",
        CitaReprogramarAPI.as_view(),
        name="cita-reprogramar",
    ),
    path(
        "citas/<int:pk>/consentimiento/",
        CitaConsentimientoAPI.as_view(),
        name="cita-consentimiento",
    ),
    path(
        "citas/<int:pk>/consentimiento/descargar/",
        CitaConsentimientoDownloadAPI.as_view(),
        name="cita-consentimiento-descargar",
    ),

    # Tratamientos
    path("tratamiento/", TratamientoAPI.as_view(), name="tratamiento-detail"),
    path(
        "tratamientos/<int:pk>/finalizar/",
        TratamientoFinalizarAPI.as_view(),
        name="tratamiento-finalizar",
    ),

    # Pagos
    path("pagos/", PagoListAPI.as_view(), name="pagos-list"),
    path("pagos/create/", PagoCreateAPI.as_view(), name="pagos-create"),
    path(
        "pagos/consultorio/",
        PagoConsultorioCreateAPI.as_view(),
        name="pagos-consultorio-create",
    ),
    path(
        "pagos/<int:pk>/revertir/",
        PagoRevertAPI.as_view(),
        name="pagos-revertir",
    ),

    # Pacientes y usuarios
    path("pacientes/", PacienteListAPI.as_view(), name="pacientes-list"),
    path("pacientes/<int:pk>/", PacienteDetailAPI.as_view(), name="paciente-detail"),
    path(
        "pacientes/<int:pk>/citas/",
        PacienteCitasListAPI.as_view(),
        name="paciente-citas",
    ),
    path("usuarios/", UserListAPI.as_view(), name="usuarios-list"),
    path("usuarios/<int:pk>/", UserDetailAPI.as_view(), name="usuario-detail"),

    # Reportes clínicos
    path(
        "reportes/",
        ReportePacienteListCreateAPI.as_view(),
        name="reportes-list-create",
    ),
    path(
        "reportes/<int:pk>/",
        ReportePacienteDetailAPI.as_view(),
        name="reporte-detail",
    ),

    # Recetas
    path("recetas/", RecetaListCreateAPI.as_view(), name="recetas-list-create"),
    path("recetas/<int:pk>/", RecetaDetailAPI.as_view(), name="receta-detail"),

    # Procedimientos en consulta
    path(
        "procedimientos/",
        ProcedimientoConsultaListCreateAPI.as_view(),
        name="procedimientos-list-create",
    ),
    path(
        "procedimientos/<int:pk>/",
        ProcedimientoConsultaDetailAPI.as_view(),
        name="procedimiento-detail",
    ),

    # Otros
    path("resultados/", TamizResultadosAPI.as_view(), name="tamiz-resultados"),
]
