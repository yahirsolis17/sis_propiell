# backend/users/views.py
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse, Http404

from rest_framework import generics, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User,
    Especialidad,
    Horario,
    Cita,
    Tratamiento,
    Pago,
    Consentimiento,
    ReportePaciente,
    Receta,
    RecetaMedicamento,
    ProcedimientoConsulta,
)
from .serializers import (
    RegisterSerializer,
    AdminUserSerializer,
    LoginSerializer,
    BaseUserSerializer,
    EspecialidadSerializer,
    HorarioSerializer,
    CitaSerializer,
    TratamientoSerializer,
    PagoSerializer,
    ConsentimientoSerializer,
    PacienteSerializer,
    ReportePacienteSerializer,
    RecetaSerializer,
    ProcedimientoConsultaSerializer,
)
from .permissions import IsRoleMatching, IsAdmin
from .utils.pdf_consentimiento import build_consentimiento_pdf

logger = logging.getLogger(__name__)


# =========================
#  Helpers dominio clínico
# =========================

def actualizar_estado_cita_atendida(cita, usuario=None):
    """
    Recalcula y actualiza el flag `atendida` de la cita.

    Regla de negocio:
      - Una cita se considera atendida cuando:
        * Existe al menos un ReportePaciente en estado FINAL asociado a la cita.
        * Y existe una Receta asociada a la misma cita.
    """
    if cita is None:
        return

    tiene_reporte_final = ReportePaciente.objects.filter(
        cita=cita,
        estado="FINAL",
    ).exists()
    tiene_receta = Receta.objects.filter(cita=cita).exists()

    nuevo_valor = bool(tiene_reporte_final and tiene_receta)

    if cita.atendida != nuevo_valor:
        cita.atendida = nuevo_valor
        if usuario is not None:
            cita.actualizado_por = usuario
            cita.save(update_fields=["atendida", "actualizado_por"])
        else:
            cita.save(update_fields=["atendida"])


def obtener_motivo_tratamiento_desde_cita(cita):
    """
    Intenta obtener un texto legible (motivo) a partir de la cita dada.

    Estrategia:
      - Buscar ReportePaciente en estado FINAL asociado a esta cita.
      - Si no hay FINAL, tomar cualquier reporte ligado a la cita.
      - Devolver el campo `resumen` (motivo) o "".
    """
    if cita is None:
        return ""

    reporte = (
        ReportePaciente.objects.filter(cita=cita, estado="FINAL")
        .order_by("-creado_en")
        .first()
    )

    if not reporte:
        reporte = (
            ReportePaciente.objects.filter(cita=cita)
            .order_by("-creado_en")
            .first()
        )

    if not reporte:
        return ""

    return (reporte.resumen or "").strip()


# =========================
#  Auth / Dashboard
# =========================

class VerifyAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"detail": "Autenticado OK"}, status=200)


class CustomTokenRefreshView(APIView):
    """
    (Actualmente no está expuesta en urls.py, pero la dejamos por si en el futuro
    quieres manejar refresh vía cookies en lugar de body).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get("refresh_token")
            if not refresh_token:
                return Response({"error": "Refresh token requerido"}, status=400)

            refresh = RefreshToken(refresh_token)
            new_access = str(refresh.access_token)
            response = Response({"access": new_access})
            response.set_cookie(
                key="access_token",
                value=new_access,
                httponly=True,
                secure=False,  # True en producción con HTTPS
                samesite="None",
                max_age=900,
                path="/",
            )
            return response

        except Exception as e:
            return Response({"error": f"Token inválido: {str(e)}"}, status=401)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "message": "Registro exitoso",
                "user": response.data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminUserSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        return Response(
            {
                "user": BaseUserSerializer(user).data,
                "access": access_token,
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsRoleMatching]

    def get(self, request, role):
        user = request.user
        role_redirects = {
            "ADMIN": "/dashboard/admin/",
            "DERMATOLOGO": "/dashboard/dermatologo/",
            "PODOLOGO": "/dashboard/podologo/",
            "TAMIZ": "/dashboard/tamiz/",
            "PACIENTE": "/dashboard/paciente/",
        }

        return Response(
            {
                "message": f"Bienvenido {user.nombre}",
                "role": user.role,
                "redirect_to": role_redirects.get(user.role, "/dashboard/"),
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({"detail": "Sesion cerrada correctamente."})
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response


# =========================
#  Catálogos / Horarios
# =========================

class EspecialidadListAPI(generics.ListAPIView):
    serializer_class = EspecialidadSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Especialidad.objects.all()


class HorarioDisponibleAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        especialidad_id = request.query_params.get("especialidad")
        fecha_str = request.query_params.get("fecha")

        if not especialidad_id or not fecha_str:
            return Response(
                {"error": "Especialidad y fecha requeridas"},
                status=400,
            )

        try:
            fecha_date = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Formato de fecha inválido (YYYY-MM-DD)"},
                status=400,
            )

        dia_semana = fecha_date.weekday() + 1
        if dia_semana == 7:
            return Response({"horas_disponibles": []}, status=200)

        horarios = (
            Horario.objects.filter(
                especialidad_id=especialidad_id,
                dia_semana=dia_semana,
            )
            .select_related("doctor")
            .order_by("hora_inicio")
        )

        horas_disponibles = []
        for h in horarios:
            fecha_hora = datetime.combine(fecha_date, h.hora_inicio)
            if not Cita.objects.filter(
                doctor=h.doctor,
                fecha_hora=fecha_hora,
            ).exists():
                horas_disponibles.append(h.hora_inicio.strftime("%H:%M"))

        return Response({"horas_disponibles": horas_disponibles}, status=200)


class HorarioCreateAPI(generics.CreateAPIView):
    queryset = Horario.objects.all()
    serializer_class = HorarioSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if self.request.user.role not in ["ADMIN", "DERMATOLOGO", "PODOLOGO"]:
            raise PermissionDenied("No tienes permiso para crear horarios")
        serializer.save(doctor=self.request.user)


# =========================
#  Citas
# =========================

class CitaListCreateAPI(generics.ListCreateAPIView):
    queryset = Cita.objects.all()
    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("paciente", "doctor", "especialidad")
            .prefetch_related("pagos", "procedimientos")  # 👈 añadimos procedimientos
        )

        user = self.request.user
        estado = self.request.query_params.get("estado")
        paciente_id = self.request.query_params.get("paciente")
        doctor_id = self.request.query_params.get("doctor")

        if user.role == "PACIENTE":
            qs = qs.filter(paciente=user)
        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = qs.filter(doctor=user)
        elif user.role != "ADMIN":
            return Cita.objects.none()

        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if estado:
            qs = qs.filter(estado=estado.upper()[0])

        return qs.order_by("fecha_hora")

    def perform_create(self, serializer):
        """
        Crea una cita inicial solicitada por el paciente.
        Se asigna automáticamente un doctor disponible según
        especialidad, día de la semana y hora.
        """
        especialidad_id = self.request.data.get("especialidad")
        fecha_hora_str = self.request.data.get("fecha_hora")

        if not especialidad_id:
            raise serializers.ValidationError(
                {"especialidad": "Este campo es requerido para asignar un doctor."}
            )
        if not fecha_hora_str:
            raise serializers.ValidationError(
                {"fecha_hora": "La fecha y hora son requeridas."}
            )

        try:
            fecha_hora = datetime.fromisoformat(fecha_hora_str)
        except ValueError:
            raise serializers.ValidationError(
                {"fecha_hora": "Formato inválido, use ISO 8601."}
            )

        especialidad = get_object_or_404(Especialidad, pk=especialidad_id)
        dia_semana = fecha_hora.weekday() + 1
        hora = fecha_hora.time()

        horarios = (
            Horario.objects.filter(
                especialidad=especialidad,
                dia_semana=dia_semana,
            )
            .select_related("doctor")
            .order_by("hora_inicio")
        )

        horario_disponible = None
        for h in horarios:
            if h.hora_inicio <= hora < h.hora_fin:
                if not Cita.objects.filter(
                    doctor=h.doctor, fecha_hora=fecha_hora
                ).exists():
                    horario_disponible = h
                    break

        if not horario_disponible:
            raise serializers.ValidationError(
                {"horario": "No hay horarios disponibles para esa fecha y hora."}
            )

        metodo_pago_preferido = self.request.data.get("metodo_pago_preferido")
        if metodo_pago_preferido:
            metodo_pago_preferido = metodo_pago_preferido.upper()
            if metodo_pago_preferido not in ["TRANSFERENCIA", "CONSULTORIO"]:
                raise serializers.ValidationError(
                    {
                        "metodo_pago_preferido": "Método de pago preferido no válido. "
                        "Use TRANSFERENCIA o CONSULTORIO."
                    }
                )
        else:
            metodo_pago_preferido = None

        serializer.save(
            paciente=self.request.user,
            doctor=horario_disponible.doctor,
            especialidad=especialidad,
            fecha_hora=fecha_hora,
            metodo_pago_preferido=metodo_pago_preferido,
            creado_por=self.request.user,
            actualizado_por=self.request.user,
        )


class CitaDetailAPI(generics.RetrieveAPIView):
    """
    Detail de una sola cita.
    Visibilidad:
      - Paciente dueño de la cita
      - Doctor asignado
      - ADMIN
    """

    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Cita.objects.select_related("paciente", "doctor", "especialidad")
            .prefetch_related("pagos", "procedimientos")  # 👈 añadimos procedimientos
        )

    def get_object(self):
        cita = super().get_object()
        user = self.request.user

        if not (user == cita.paciente or user == cita.doctor or user.role == "ADMIN"):
            raise PermissionDenied("No tienes permiso para ver esta cita.")

        return cita


class CitaSubsecuenteCreateAPI(APIView):
    """
    Crea una cita subsecuente basada en el Tratamiento activo del PACIENTE que llama.
    Flujo orientado a paciente (no al doctor).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        tratamiento = Tratamiento.objects.filter(
            paciente=request.user,
            activo=True,
        ).first()

        if not tratamiento:
            return Response(
                {"error": "No hay un tratamiento activo para este paciente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not tratamiento.activo:
            return Response(
                {"error": "El tratamiento está finalizado; no puedes generar más citas subsecuentes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Evitar múltiples subsecuentes activos para el mismo tratamiento
        subsecuente_existente = Cita.objects.filter(
            tratamiento=tratamiento,
            tipo="S",
        ).exclude(estado="X").exists()
        if subsecuente_existente:
            return Response(
                {"error": "Ya existe una cita subsecuente activa para este tratamiento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cita_inicial = (
                Cita.objects.filter(tratamiento=tratamiento, tipo="I")
                .order_by("fecha_hora")
                .first()
            )
            if not cita_inicial:
                return Response(
                    {"error": "No existe cita inicial vinculada al tratamiento"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            fecha_cita = tratamiento.proxima_cita()
            horario = Horario.objects.filter(
                doctor=tratamiento.doctor,
                dia_semana=fecha_cita.weekday() + 1,
                hora_inicio__lte=fecha_cita.time(),
                hora_fin__gt=fecha_cita.time(),
            ).first()

            if not horario:
                return Response(
                    {
                        "error": "No hay horarios disponibles para la fecha calculada."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if Cita.objects.filter(
                doctor=tratamiento.doctor,
                fecha_hora=fecha_cita,
            ).exists():
                return Response(
                    {"error": "La hora calculada ya está ocupada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            Cita.objects.create(
                paciente=request.user,
                doctor=tratamiento.doctor,
                tipo="S",
                tratamiento=tratamiento,
                estado="P",
                fecha_hora=fecha_cita,
                especialidad=tratamiento.doctor.especialidad,
                metodo_pago_preferido=cita_inicial.metodo_pago_preferido,
                creado_por=request.user,
                actualizado_por=request.user,
            )
            return Response(
                {"message": "Cita subsecuente agendada correctamente."},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {"error": f"Error al agendar la cita: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# backend/users/views.py

class CitaProgramarSubsecuenteAPI(APIView):
    """
    Programar una cita subsecuente a partir de una cita existente (normalmente INICIAL).

    - Solo el DOCTOR asignado a la cita o un ADMIN pueden invocar este endpoint.
    - La cita base debe estar en estado CONFIRMADA.
    - Crea una nueva Cita tipo 'S' para el mismo paciente/doctor/especialidad,
      validando horario disponible y evitando colisiones.
    - Si no existe Tratamiento activo para la pareja paciente-doctor, se crea uno
      y se vinculan tanto la cita inicial como la subsecuente.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        cita_inicial = get_object_or_404(
            Cita.objects.select_related("paciente", "doctor", "especialidad", "tratamiento"),
            pk=pk,
        )

        es_doctor = user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]
        es_admin = user.role == "ADMIN"

        if not (es_admin or (es_doctor and cita_inicial.doctor_id == user.id)):
            raise PermissionDenied(
                "Solo el doctor asignado o un administrador pueden programar citas subsecuentes."
            )

        if cita_inicial.estado != "C":
            return Response(
                {"detail": "Solo puedes programar citas subsecuentes desde una cita confirmada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fecha_hora_str = request.data.get("fecha_hora")
        if not fecha_hora_str:
            return Response(
                {"detail": "Debes enviar 'fecha_hora' en formato ISO."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fecha_hora = parse_datetime(fecha_hora_str)
        if not fecha_hora:
            return Response(
                {"detail": "Formato de 'fecha_hora' inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 🔧 Normalizar a datetime "aware" en la zona horaria actual
        if timezone.is_naive(fecha_hora):
            fecha_hora = timezone.make_aware(
                fecha_hora,
                timezone.get_current_timezone(),
            )

        if fecha_hora <= timezone.now():
            return Response(
                {"detail": "La fecha y hora de la cita subsecuente deben ser futuras."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar que el doctor tenga horario para esa fecha/hora
        fecha = fecha_hora.date()
        hora = fecha_hora.time()
        dia_semana = fecha.weekday() + 1

        horario_existente = Horario.objects.filter(
            doctor=cita_inicial.doctor,
            especialidad=cita_inicial.especialidad,
            dia_semana=dia_semana,
            hora_inicio__lte=hora,
            hora_fin__gt=hora,
        ).exists()

        if not horario_existente:
            return Response(
                {"detail": "El doctor no tiene horario disponible en esa fecha y hora."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar que no haya otra cita (no cancelada) en ese mismo slot
        conflicto = Cita.objects.filter(
            doctor=cita_inicial.doctor,
            fecha_hora=fecha_hora,
        ).exclude(estado="X").exists()

        if conflicto:
            return Response(
                {"detail": "El doctor ya tiene una cita en esa fecha y hora."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolver tratamiento activo
        tratamiento = cita_inicial.tratamiento
        if not tratamiento:
            tratamiento = (
                Tratamiento.objects.filter(
                    paciente=cita_inicial.paciente,
                    doctor=cita_inicial.doctor,
                    activo=True,
                )
                .order_by("-fecha_inicio")
                .first()
            )

        if not tratamiento:
            # No hay tratamiento activo aún: lo creamos
            frecuencia_raw = request.data.get("frecuencia_dias")
            try:
                frecuencia_dias = int(frecuencia_raw) if frecuencia_raw is not None else 30
            except (TypeError, ValueError):
                frecuencia_dias = 30

            tratamiento = Tratamiento.objects.create(
                paciente=cita_inicial.paciente,
                doctor=cita_inicial.doctor,
                frecuencia_dias=frecuencia_dias,
                creado_por=user,
                actualizado_por=user,
            )

        # Bloquear subsecuentes si el tratamiento está inactivo
        if not tratamiento.activo:
            return Response(
                {"detail": "El tratamiento está finalizado; no puedes generar más citas subsecuentes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Evitar múltiples subsecuentes activas para el mismo tratamiento
        subsecuente_existente = Cita.objects.filter(
            tratamiento=tratamiento,
            tipo="S",
        ).exclude(estado="X").exists()
        if subsecuente_existente:
            return Response(
                {"detail": "Ya existe una cita subsecuente activa para este tratamiento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Nombrar tratamiento si aún no tiene nombre usando el motivo de la cita inicial
        if not tratamiento.nombre:
            motivo = obtener_motivo_tratamiento_desde_cita(cita_inicial)
            if motivo:
                tratamiento.nombre = motivo
                tratamiento.actualizado_por = user
                tratamiento.save(
                    update_fields=["nombre", "actualizado_por", "actualizado_en"]
                )

        # Vincular la cita inicial al tratamiento si aún no está ligada
        if cita_inicial.tratamiento_id != tratamiento.id:
            cita_inicial.tratamiento = tratamiento
            cita_inicial.actualizado_por = user
            cita_inicial.save(update_fields=["tratamiento", "actualizado_por"])

        nueva_cita = Cita.objects.create(
            paciente=cita_inicial.paciente,
            doctor=cita_inicial.doctor,
            especialidad=cita_inicial.especialidad,
            fecha_hora=fecha_hora,
            tipo="S",
            estado="P",
            tratamiento=tratamiento,
            metodo_pago_preferido=cita_inicial.metodo_pago_preferido,
            creado_por=user,
            actualizado_por=user,
        )

        serializer = CitaSerializer(nueva_cita, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)



class CitaConfirmAPI(APIView):
    """
    Procesa una cita (doctor):

    - accion = "confirmar":
        * Si existe Pago asociado:
            - pago.estado_pago = "APROBADO"
            - pago.verificado = True
            - pago.pagado = pago.total
            - pago.fecha = timezone.now()
        * En todo caso:
            - cita.estado = "C"
    - accion = "cancelar":
        * cita.estado = "X"
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        cita = get_object_or_404(Cita, pk=pk, doctor=request.user)

        if cita.estado not in ["P"]:
            return Response(
                {"error": "La cita ya fue procesada o cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accion = (request.data.get("accion") or "").lower().strip()
        pago = cita.pagos.first()

        if accion == "cancelar":
            cita.estado = "X"
            cita.actualizado_por = request.user
            cita.save(update_fields=["estado", "actualizado_por"])
            msg = "Cita cancelada correctamente."
            return Response(
                {
                    "status": msg,
                    "estado": cita.estado,
                    "pago_asociado": bool(pago),
                },
                status=status.HTTP_200_OK,
            )

        elif accion == "confirmar":
            if pago:
                pago.estado_pago = "APROBADO"
                pago.verificado = True
                pago.pagado = pago.total
                pago.fecha = timezone.now()
                pago.actualizado_por = request.user
                pago.save(
                    update_fields=[
                        "estado_pago",
                        "verificado",
                        "pagado",
                        "fecha",
                        "actualizado_por",
                    ]
                )
                mensaje_pago = "Cita confirmada con pago verificado."
            else:
                mensaje_pago = (
                    "Cita confirmada con pago pendiente "
                    "(pago en consultorio o comprobante por registrar)."
                )

            cita.estado = "C"
            cita.actualizado_por = request.user
            cita.save(update_fields=["estado", "actualizado_por"])

            if cita.tipo == "I":
                tratamiento = (
                    Tratamiento.objects.filter(
                        paciente=cita.paciente,
                        doctor=cita.doctor,
                        activo=True,
                    )
                    .order_by("-fecha_inicio", "-id")
                    .first()
                )

                if not tratamiento:
                    tratamiento = Tratamiento.objects.create(
                        paciente=cita.paciente,
                        doctor=cita.doctor,
                        frecuencia_dias=15,
                        creado_por=request.user,
                        actualizado_por=request.user,
                    )

                if cita.tratamiento_id != tratamiento.id:
                    cita.tratamiento = tratamiento
                    cita.actualizado_por = request.user
                    cita.save(update_fields=["tratamiento", "actualizado_por"])

            return Response(
                {
                    "status": mensaje_pago,
                    "estado": cita.estado,
                    "pago_asociado": bool(pago),
                },
                status=status.HTTP_200_OK,
            )

        else:
            return Response(
                {"error": "Acción no válida."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# backend/users/views.py

class CitaReprogramarAPI(APIView):
    """
    Reprogramar una cita existente (cambiar fecha_hora).

    Reglas:
      - PACIENTE:
          * Solo puede reprogramar sus propias citas.
          * La cita debe estar viva (no cancelada/atendida) y en el futuro.
          * Si tiene tratamiento asociado, el tratamiento debe estar activo.
      - DOCTOR asignado o ADMIN:
          * Pueden reprogramar sin restricción de días.
      - En todos los casos:
          * La nueva fecha/hora debe ser futura.
          * Debe existir horario del doctor para esa fecha/hora.
          * No debe haber otra cita (no cancelada) del mismo doctor en ese slot.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        cita = get_object_or_404(
            Cita.objects.select_related("paciente", "doctor", "especialidad"),
            pk=pk,
        )
        user = request.user
        role = user.role

        es_paciente = role == "PACIENTE"
        es_doctor = role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]
        es_admin = role == "ADMIN"

        # Permisos básicos
        if es_paciente:
            if cita.paciente_id != user.id:
                raise PermissionDenied(
                    "No puedes reprogramar citas de otros pacientes."
                )
        elif es_doctor:
            if cita.doctor_id != user.id and not es_admin:
                raise PermissionDenied(
                    "No puedes reprogramar citas de otros doctores."
                )
        elif not es_admin:
            raise PermissionDenied("No tienes permiso para reprogramar esta cita.")

        # No reprogramar canceladas ni citas en el pasado
        if cita.estado == "X":
            return Response(
                {"detail": "No se puede reprogramar una cita cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cita.atendida:
            return Response(
                {"detail": "La cita ya fue atendida; no se puede reprogramar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cita.fecha_hora <= timezone.now():
            return Response(
                {"detail": "No puedes reprogramar una cita en el pasado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cita.tratamiento and not cita.tratamiento.activo:
            return Response(
                {
                    "detail": "El tratamiento está finalizado; no puedes reprogramar esta cita."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        nueva_fecha_str = request.data.get("fecha_hora")
        if not nueva_fecha_str:
            return Response(
                {"detail": "Debes enviar 'fecha_hora' en formato ISO."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nueva_fecha = parse_datetime(nueva_fecha_str)
        if not nueva_fecha:
            return Response(
                {"detail": "Formato de 'fecha_hora' inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 🔧 Normalizar a datetime "aware" en la zona horaria actual
        if timezone.is_naive(nueva_fecha):
            nueva_fecha = timezone.make_aware(
                nueva_fecha,
                timezone.get_current_timezone(),
            )

        if nueva_fecha <= timezone.now():
            return Response(
                {"detail": "La nueva fecha/hora debe ser futura."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar horario del doctor en la nueva fecha/hora
        fecha = nueva_fecha.date()
        hora = nueva_fecha.time()
        dia_semana = fecha.weekday() + 1

        horario_existente = Horario.objects.filter(
            doctor=cita.doctor,
            especialidad=cita.especialidad,
            dia_semana=dia_semana,
            hora_inicio__lte=hora,
            hora_fin__gt=hora,
        ).exists()

        if not horario_existente:
            return Response(
                {
                    "detail": "El doctor no tiene horario disponible en la nueva fecha y hora."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar que no se empalme con otra cita del mismo doctor
        conflicto = Cita.objects.filter(
            doctor=cita.doctor,
            fecha_hora=nueva_fecha,
        ).exclude(pk=cita.pk).exclude(estado="X").exists()

        if conflicto:
            return Response(
                {"detail": "El doctor ya tiene una cita en esa nueva fecha y hora."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cita.fecha_hora = nueva_fecha
        cita.actualizado_por = user
        # Mantenemos el estado (P o C) tal como está; no lo forzamos a P
        cita.save(update_fields=["fecha_hora", "actualizado_por"])

        serializer = CitaSerializer(cita, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class CitaCancelarPacienteAPI(APIView):
    """
    Cancelación de cita por el PACIENTE.

    Reglas:
      - Solo el paciente dueño de la cita.
      - Solo si la cita está en estado PENDIENTE o CONFIRMADA.
      - Deben faltar al menos 7 días para la fecha de la cita.
      - No se tocan los pagos: si ya había pago, la cita se cancela
        sin reembolso automático (política de la clínica).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != "PACIENTE":
            raise PermissionDenied(
                "Solo los pacientes pueden cancelar sus citas desde este endpoint."
            )

        cita = get_object_or_404(Cita, pk=pk, paciente=user)

        # Estado permitido: pendiente o confirmada
        if cita.estado not in ["P", "C"]:
            return Response(
                {"detail": "Solo puedes cancelar citas pendientes o confirmadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ahora = timezone.now()

        # No cancelar pasado / mismo momento
        if cita.fecha_hora <= ahora:
            return Response(
                {"detail": "No puedes cancelar una cita en el pasado o el mismo día."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Regla de 7 días
        dias_restantes = (cita.fecha_hora.date() - ahora.date()).days
        if dias_restantes < 7:
            return Response(
                {
                    "detail": (
                        "Solo puedes cancelar la cita con al menos 7 días de anticipación. "
                        "Contacta a la clínica para cualquier aclaración."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ya no bloqueamos por pagos activos; no hay reembolsos automáticos.
        cita.estado = "X"
        cita.actualizado_por = user
        cita.save(update_fields=["estado", "actualizado_por"])

        return Response(
            {"detail": "Cita cancelada correctamente. No aplica reembolso automático."},
            status=status.HTTP_200_OK,
        )


class TratamientoAPI(generics.RetrieveUpdateAPIView):
    """
    Endpoint para que el PACIENTE consulte / actualice su tratamiento actual.

    - GET /tratamiento/  → tratamiento activo más reciente del paciente.
    - PATCH/PUT          → aplicar cambios sobre ese tratamiento.
    """
    serializer_class = TratamientoSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user = self.request.user

        if user.role != "PACIENTE":
            raise PermissionDenied(
                "Este endpoint está pensado para que el paciente consulte su tratamiento."
            )

        qs = (
            Tratamiento.objects
            .filter(paciente=user)
            .order_by("-fecha_inicio", "-id")
        )
        tratamiento = qs.first()
        if not tratamiento:
            raise Http404("No se encontró tratamiento para este paciente.")
        return tratamiento

    def perform_update(self, serializer):
        serializer.save(actualizado_por=self.request.user)


class TratamientoFinalizarAPI(APIView):
    """
    Marca un tratamiento como finalizado (alta del paciente).

    Reglas:
      - Solo el DOCTOR dueño del tratamiento o un ADMIN pueden cerrarlo.
      - Si el tratamiento ya está inactivo, devuelve 400.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        tratamiento = get_object_or_404(
            Tratamiento.objects.select_related("paciente", "doctor"),
            pk=pk,
        )

        es_doctor = user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]
        es_admin = user.role == "ADMIN"

        if not (es_admin or (es_doctor and tratamiento.doctor_id == user.id)):
            raise PermissionDenied(
                "Solo el doctor responsable o un administrador pueden finalizar el tratamiento."
            )

        if not tratamiento.activo:
            return Response(
                {"detail": "El tratamiento ya está finalizado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivo = (request.data.get("motivo") or "").strip()

        tratamiento.finalizar(usuario=user, motivo=motivo)

        serializer = TratamientoSerializer(tratamiento, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# =========================
#  Procedimientos en consulta
# =========================

class ProcedimientoConsultaListCreateAPI(generics.ListCreateAPIView):
    """
    Listar y crear procedimientos ligados a una cita.

    Visibilidad:
      - PACIENTE: solo sus procedimientos.
      - DOCTOR (DERMATOLOGO/PODOLOGO/TAMIZ): solo los que él realiza.
      - ADMIN: todos.

    Crear:
      - Solo DOCTOR o ADMIN.
      - Se resuelven paciente y doctor desde la cita (no desde el payload).
    """

    serializer_class = ProcedimientoConsultaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        cita_id = self.request.query_params.get("cita")
        paciente_id = self.request.query_params.get("paciente")

        base_qs = ProcedimientoConsulta.objects.select_related(
            "cita", "paciente", "doctor"
        )

        if user.role == "PACIENTE":
            qs = base_qs.filter(paciente=user)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = base_qs.filter(doctor=user)
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        if user.role == "ADMIN":
            qs = base_qs
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        return ProcedimientoConsulta.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"]:
            raise PermissionDenied(
                "Solo el personal médico puede registrar procedimientos."
            )

        cita_id = self.request.data.get("cita")
        if not cita_id:
            raise serializers.ValidationError(
                {"cita": "Debes indicar la cita asociada al procedimiento."}
            )

        cita = get_object_or_404(
            Cita.objects.select_related("paciente", "doctor"),
            pk=cita_id,
        )

        if user.role != "ADMIN" and cita.doctor_id != user.id:
            raise PermissionDenied(
                "Solo el doctor asignado a la cita o un administrador pueden registrar procedimientos."
            )

        serializer.save(
            paciente=cita.paciente,
            doctor=cita.doctor,
            creado_por=user,
            actualizado_por=user,
        )


class ProcedimientoConsultaDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    """
    Detalle / edición / eliminación de un procedimiento.

    Reglas:
      - ADMIN: acceso total.
      - PACIENTE: solo puede VER (GET) procedimientos propios.
      - DOCTOR (DERMATOLOGO/PODOLOGO/TAMIZ): puede ver/editar/eliminar
        procedimientos que él mismo registró.
    """

    queryset = ProcedimientoConsulta.objects.select_related(
        "cita", "paciente", "doctor"
    )
    serializer_class = ProcedimientoConsultaSerializer
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        user = request.user

        if user.role == "ADMIN":
            return

        if user.role == "PACIENTE":
            if obj.paciente_id == user.id and request.method == "GET":
                return
            raise PermissionDenied(
                "No tienes permiso para modificar este procedimiento."
            )

        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            if obj.doctor_id == user.id:
                return

        raise PermissionDenied("No tienes permiso para este procedimiento.")


# =========================
#  Pagos
# =========================

class PagoCreateAPI(generics.CreateAPIView):
    """
    Crea un pago asociado a una cita para TRANSFERENCIA/DEPÓSITO.
    Lo ejecuta el PACIENTE subiendo un comprobante.
    """

    queryset = Pago.objects.all()
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        paciente = self.request.user

        if paciente.role != "PACIENTE":
            raise PermissionDenied("Solo los pacientes pueden registrar pagos en línea.")

        cita_id = self.request.data.get("cita")
        if not cita_id:
            raise serializers.ValidationError({"cita": "Este campo es obligatorio."})

        cita = get_object_or_404(Cita, pk=cita_id, paciente=paciente)

        if cita.estado != "P":
            raise serializers.ValidationError(
                {"cita": "Solo puedes registrar pagos para citas en estado pendiente."}
            )

        if Pago.objects.filter(
            cita=cita,
            metodo_pago="TRANSFERENCIA",
            estado_pago__in=["PENDIENTE", "APROBADO"],
            revertido=False,
        ).exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Ya existe un pago por transferencia asociado a esta cita."
                    ]
                }
            )

        comprobante = self.request.FILES.get("comprobante")
        if not comprobante:
            raise serializers.ValidationError(
                {"comprobante": "Debes adjuntar el comprobante de pago."}
            )

        total_raw = self.request.data.get("total")
        if total_raw is None or total_raw == "":
            total = Decimal("900.00")
        else:
            try:
                total = Decimal(str(total_raw))
            except (InvalidOperation, TypeError):
                raise serializers.ValidationError(
                    {"total": "El total debe ser un número válido."}
                )

        serializer.save(
            paciente=paciente,
            cita=cita,
            total=total,
            pagado=Decimal("0.00"),
            verificado=False,
            metodo_pago="TRANSFERENCIA",
            estado_pago="PENDIENTE",
            comprobante=comprobante,
            creado_por=paciente,
            actualizado_por=paciente,
        )


class PagoConsultorioCreateAPI(APIView):
    """
    Registra un pago en CONSULTORIO.
    Lo ejecuta el DOCTOR asignado a la cita (o ADMIN).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"]:
            raise PermissionDenied(
                "Solo el personal médico puede registrar pagos en consultorio."
            )

        cita_id = request.data.get("cita")
        if not cita_id:
            return Response(
                {"cita": "Este campo es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cita = get_object_or_404(Cita, pk=cita_id)

        if user.role != "ADMIN" and cita.doctor != user:
            raise PermissionDenied(
                "Solo el doctor asignado o un administrador pueden registrar el pago."
            )

        if cita.estado != "C":
            return Response(
                {
                    "detail": "Solo se puede registrar pago en consultorio para citas confirmadas."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Pago.objects.filter(
            cita=cita,
            metodo_pago="CONSULTORIO",
            estado_pago__in=["PENDIENTE", "APROBADO"],
            revertido=False,
        ).exists():
            return Response(
                {
                    "detail": "Ya existe un pago en consultorio registrado para esta cita."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_raw = request.data.get("total")
        if total_raw is None or total_raw == "":
            total = Decimal("900.00")
        else:
            try:
                total = Decimal(str(total_raw))
            except (InvalidOperation, TypeError):
                return Response(
                    {"total": "El total debe ser un número válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        pago = Pago.objects.create(
            paciente=cita.paciente,
            cita=cita,
            total=total,
            pagado=total,
            verificado=True,
            metodo_pago="CONSULTORIO",
            estado_pago="APROBADO",
            comprobante=None,
            creado_por=user,
            actualizado_por=user,
        )

        serializer = PagoSerializer(pago, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PagoRevertAPI(APIView):
    """
    Reverso / rechazo de un pago existente.

    - Solo ADMIN o el DOCTOR dueño de la cita pueden revertir.
    - Marca el pago como RECHAZADO, verificado=False, pagado=0,
      revertido=True, guarda motivo y fecha.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        pago = get_object_or_404(
            Pago.objects.select_related("cita", "cita__doctor"),
            pk=pk,
        )

        if user.role == "ADMIN":
            pass
        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"] and pago.cita.doctor == user:
            pass
        else:
            raise PermissionDenied(
                "No tienes permiso para revertir este pago."
            )

        if pago.revertido:
            return Response(
                {"detail": "Este pago ya fue revertido previamente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivo = request.data.get("motivo_reverso", "").strip()

        pago.estado_pago = "RECHAZADO"
        pago.verificado = False
        pago.pagado = Decimal("0.00")
        pago.revertido = True
        pago.motivo_reverso = motivo
        pago.fecha_reverso = timezone.now()
        pago.actualizado_por = user
        pago.save(
            update_fields=[
                "estado_pago",
                "verificado",
                "pagado",
                "revertido",
                "motivo_reverso",
                "fecha_reverso",
                "actualizado_por",
            ]
        )

        serializer = PagoSerializer(pago, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class PagoListAPI(generics.ListAPIView):
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        paciente_id = self.request.query_params.get("paciente")
        metodo = self.request.query_params.get("metodo_pago")
        estado_pago = self.request.query_params.get("estado_pago")

        if user.role == "PACIENTE":
            qs = Pago.objects.filter(paciente=user)
        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = Pago.objects.filter(cita__doctor=user)
        else:
            qs = Pago.objects.all()

        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        if metodo:
            qs = qs.filter(metodo_pago=metodo)
        if estado_pago:
            qs = qs.filter(estado_pago=estado_pago)

        return qs.order_by("-fecha", "-id")


class TamizResultadosAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "TAMIZ":
            return Response(
                {"error": "No autorizado"},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Placeholder para futuros resultados de tamiz neonatal
        return Response([], status=status.HTTP_200_OK)


# =========================
#  Consentimiento informado
# =========================

class CitaConsentimientoAPI(APIView):
    """
    GET  /api/citas/<pk>/consentimiento/
    POST /api/citas/<pk>/consentimiento/

    PACIENTE:
      - Solo envía firma_paciente (multipart/form-data).
      - Marca cita.consentimiento_completado = True.

    DOCTOR / ADMIN:
      - Editan campos médicos (diagnóstico, procedimiento, riesgos, beneficios,
        alternativas, testigos).

    IMPORTANTE:
      - Solo aplica a citas cuya especialidad requiere consentimiento
        (ej. Dermatología). Para Podología/Tamiz se responde error explícito.
    """

    permission_classes = [IsAuthenticated]

    def _get_cita(self, pk):
        return get_object_or_404(Cita, pk=pk)

    def get(self, request, pk):
        cita = self._get_cita(pk)
        user = request.user

        # 🔒 Nuevo: este endpoint solo aplica si la cita requiere consentimiento
        if not cita.requiere_consentimiento():
            return Response(
                {
                    "detail": (
                        "El consentimiento informado solo aplica a ciertas especialidades "
                        "(por ejemplo, Dermatología). Esta cita no lo requiere."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (user == cita.paciente or user == cita.doctor or user.role == "ADMIN"):
            return Response(
                {"detail": "No tienes permiso para ver este consentimiento."},
                status=status.HTTP_403_FORBIDDEN,
            )

        consentimiento = getattr(cita, "consentimiento", None)
        if not consentimiento:
            return Response(
                {"detail": "Aún no existe consentimiento para esta cita."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ConsentimientoSerializer(
            consentimiento,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        cita = self._get_cita(pk)
        user = request.user

        # 🔒 Nuevo: este endpoint solo aplica si la cita requiere consentimiento
        if not cita.requiere_consentimiento():
            return Response(
                {
                    "detail": (
                        "El consentimiento informado solo aplica a ciertas especialidades "
                        "(por ejemplo, Dermatología). Esta cita no lo requiere."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_paciente = user == cita.paciente
        is_doctor = user == cita.doctor
        is_admin = user.role == "ADMIN"

        if not (is_paciente or is_doctor or is_admin):
            return Response(
                {"detail": "No tienes permiso para modificar este consentimiento."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if cita.estado != "C":
            return Response(
                {
                    "detail": "Solo puedes completar o editar el consentimiento cuando la cita está confirmada."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        consentimiento = getattr(cita, "consentimiento", None)

        # PACIENTE: solo firma
        if is_paciente:
            firma = request.data.get("firma_paciente")
            if not firma:
                return Response(
                    {
                        "detail": "Se requiere la firma del paciente para completar el consentimiento."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            was_new = consentimiento is None

            if consentimiento:
                serializer = ConsentimientoSerializer(
                    consentimiento,
                    data={"firma_paciente": firma},
                    partial=True,
                    context={"request": request},
                )
            else:
                serializer = ConsentimientoSerializer(
                    data={"firma_paciente": firma},
                    partial=True,
                    context={"request": request},
                )

            if serializer.is_valid():
                extra_kwargs = {
                    "cita": cita,
                    "fecha": cita.fecha_hora.date(),
                    "hora": cita.fecha_hora.time(),
                    "lugar": "Zihuatanejo, Guerrero",
                    "actualizado_por": user,
                }
                if was_new:
                    extra_kwargs["creado_por"] = user

                consentimiento = serializer.save(**extra_kwargs)

                if not cita.consentimiento_completado:
                    cita.consentimiento_completado = True
                    cita.actualizado_por = user
                    cita.save(
                        update_fields=["consentimiento_completado", "actualizado_por"]
                    )

                return Response(
                    ConsentimientoSerializer(
                        consentimiento,
                        context={"request": request},
                    ).data,
                    status=(
                        status.HTTP_201_CREATED
                        if was_new
                        else status.HTTP_200_OK
                    ),
                )

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # DOCTOR / ADMIN: campos médicos
        campos_medicos = [
            "diagnostico_principal",
            "procedimiento_propuesto",
            "beneficios",
            "riesgos",
            "alternativas",
            "testigo1_nombre",
            "testigo2_nombre",
        ]

        data = {
            campo: valor
            for campo, valor in request.data.items()
            if campo in campos_medicos
        }

        if not data:
            return Response(
                {
                    "detail": "No se proporcionaron campos médicos válidos para actualizar."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        was_new = consentimiento is None

        if not consentimiento:
            consentimiento = Consentimiento.objects.create(
                cita=cita,
                fecha=cita.fecha_hora.date(),
                hora=cita.fecha_hora.time(),
                lugar="Zihuatanejo, Guerrero",
                creado_por=user,
                actualizado_por=user,
            )

        serializer = ConsentimientoSerializer(
            consentimiento,
            data=data,
            partial=True,
            context={"request": request},
        )

        if serializer.is_valid():
            consentimiento = serializer.save(actualizado_por=user)
            return Response(
                ConsentimientoSerializer(
                    consentimiento,
                    context={"request": request},
                ).data,
                status=(
                    status.HTTP_201_CREATED
                    if was_new
                    else status.HTTP_200_OK
                ),
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CitaConsentimientoDownloadAPI(APIView):
    """
    Descargar el consentimiento informado en PDF.

    - Solo aplica a citas cuya especialidad requiere consentimiento
      (ej. Dermatología).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        cita = get_object_or_404(
            Cita.objects.select_related("paciente", "doctor", "especialidad"),
            pk=pk,
        )
        user = request.user

        # 🔒 Nuevo: este endpoint solo aplica si la cita requiere consentimiento
        if not cita.requiere_consentimiento():
            return Response(
                {
                    "detail": (
                        "El consentimiento informado solo aplica a ciertas especialidades "
                        "(por ejemplo, Dermatología). Esta cita no lo requiere."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (user == cita.paciente or user == cita.doctor or user.role == "ADMIN"):
            return Response(
                {"detail": "No tienes permiso para descargar este consentimiento."},
                status=status.HTTP_403_FORBIDDEN,
            )

        consentimiento = getattr(cita, "consentimiento", None)
        if not consentimiento:
            return Response(
                {"detail": "Aún no existe consentimiento para esta cita."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pdf_bytes = build_consentimiento_pdf(cita, consentimiento)

        filename = f"consentimiento_cita_{cita.pk}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


# =========================
#  Pacientes / Usuarios
# =========================

class PacienteListAPI(generics.ListAPIView):
    serializer_class = PacienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(role="PACIENTE")

        if user.role == "PACIENTE":
            qs = qs.filter(pk=user.pk)
        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = qs.filter(citas_paciente__doctor=user).distinct()
        elif user.role == "ADMIN":
            pass
        else:
            return User.objects.none()

        return qs.order_by("apellidos", "nombre")


class PacienteDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(role="PACIENTE")
    serializer_class = PacienteSerializer
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        user = request.user
        if user == obj and request.method in ("GET", "PUT", "PATCH"):
            return
        if user.role != "ADMIN":
            raise PermissionDenied(
                "Solo administradores pueden modificar o eliminar pacientes."
            )


class PacienteCitasListAPI(generics.ListAPIView):
    """
    Lista las citas de un paciente específico.
    """

    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        paciente_id = self.kwargs.get("pk")

        paciente = get_object_or_404(User, pk=paciente_id, role="PACIENTE")

        base_qs = (
            Cita.objects.select_related("paciente", "doctor", "especialidad")
            .prefetch_related("pagos", "procedimientos")  # 👈 añadimos procedimientos
            .filter(paciente=paciente)
            .order_by("fecha_hora")
        )

        if user.role == "PACIENTE":
            if user != paciente:
                raise PermissionDenied(
                    "No puedes consultar las citas de otros pacientes."
                )
            return base_qs

        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            return base_qs.filter(doctor=user)

        if user.role == "ADMIN":
            return base_qs

        return Cita.objects.none()


class UserListAPI(generics.ListAPIView):
    serializer_class = BaseUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return User.objects.all().order_by("role", "apellidos", "nombre")


class UserDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = BaseUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


# =========================
#  Reportes clínicos
# =========================

class ReportePacienteListCreateAPI(generics.ListCreateAPIView):
    serializer_class = ReportePacienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        paciente_id = self.request.query_params.get("paciente")
        doctor_id = self.request.query_params.get("doctor")
        cita_id = self.request.query_params.get("cita")

        base_qs = ReportePaciente.objects.select_related(
            "paciente", "doctor", "cita"
        )

        if user.role == "PACIENTE":
            qs = base_qs.filter(paciente=user)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = base_qs.filter(doctor=user)
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        elif user.role == "ADMIN":
            qs = base_qs
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if doctor_id:
                qs = qs.filter(doctor_id=doctor_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        return ReportePaciente.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"]:
            raise PermissionDenied("Solo personal médico puede generar reportes.")

        paciente_id = self.request.data.get("paciente")
        if not paciente_id:
            raise serializers.ValidationError(
                {"paciente": "Debes indicar el paciente para el reporte."}
            )

        paciente = get_object_or_404(User, pk=paciente_id, role="PACIENTE")

        cita_id = self.request.data.get("cita")
        cita = None
        if cita_id:
            cita = get_object_or_404(Cita, pk=cita_id)
            if cita.paciente_id != paciente.id:
                raise serializers.ValidationError(
                    {"cita": "La cita no pertenece al paciente indicado."}
                )
            if ReportePaciente.objects.filter(cita=cita).exists():
                raise serializers.ValidationError(
                    {
                        "cita": "Ya existe un reporte clínico asociado a esta cita. "
                        "Edita el reporte existente en lugar de crear uno nuevo."
                    }
                )

        doctor = user
        if user.role == "ADMIN":
            doctor_id = self.request.data.get("doctor")
            if not doctor_id:
                raise serializers.ValidationError(
                    {"doctor": "Debes indicar el doctor que genera el reporte."}
                )
            doctor = get_object_or_404(
                User,
                pk=doctor_id,
                role__in=["DERMATOLOGO", "PODOLOGO", "TAMIZ"],
            )

        reporte = serializer.save(
            paciente=paciente,
            doctor=doctor,
            cita=cita,
            creado_por=user,
            actualizado_por=user,
        )

        if cita is not None:
            actualizar_estado_cita_atendida(cita, user)

            tratamiento = cita.tratamiento
            if tratamiento and tratamiento.activo and not tratamiento.nombre:
                motivo = (reporte.resumen or "").strip()
                if motivo:
                    tratamiento.nombre = motivo
                    tratamiento.actualizado_por = user
                    tratamiento.save(
                        update_fields=["nombre", "actualizado_por", "actualizado_en"]
                    )


class ReportePacienteDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReportePaciente.objects.select_related(
        "paciente", "doctor", "cita"
    )
    serializer_class = ReportePacienteSerializer
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        user = request.user
        if user.role == "ADMIN":
            return
        if user.role == "PACIENTE" and obj.paciente == user and request.method == "GET":
            return
        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"] and obj.doctor == user:
            return
        raise PermissionDenied("No tienes permiso para esta operación sobre el reporte.")

    def perform_update(self, serializer):
        user = self.request.user
        reporte = serializer.save(actualizado_por=user)
        if reporte.cita:
            actualizar_estado_cita_atendida(reporte.cita, user)

            tratamiento = reporte.cita.tratamiento
            if tratamiento and tratamiento.activo and not tratamiento.nombre:
                motivo = (reporte.resumen or "").strip()
                if motivo:
                    tratamiento.nombre = motivo
                    tratamiento.actualizado_por = user
                    tratamiento.save(
                        update_fields=["nombre", "actualizado_por", "actualizado_en"]
                    )

    def perform_destroy(self, instance):
        if instance.estado == "FINAL":
            raise PermissionDenied("No puedes eliminar un reporte en estado FINAL.")
        cita = instance.cita
        super().perform_destroy(instance)
        if cita:
            actualizar_estado_cita_atendida(cita, self.request.user)


# =========================
#  Recetas
# =========================

class RecetaListCreateAPI(generics.ListCreateAPIView):
    serializer_class = RecetaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        paciente_id = self.request.query_params.get("paciente")
        doctor_id = self.request.query_params.get("doctor")
        cita_id = self.request.query_params.get("cita")

        if user.role == "PACIENTE":
            qs = (
                Receta.objects.filter(paciente=user)
                .select_related("paciente", "doctor", "cita")
                .prefetch_related("medicamentos")
            )
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = (
                Receta.objects.filter(doctor=user)
                .select_related("paciente", "doctor", "cita")
                .prefetch_related("medicamentos")
            )
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        elif user.role == "ADMIN":
            qs = (
                Receta.objects.select_related("paciente", "doctor", "cita")
                .prefetch_related("medicamentos")
            )
            if paciente_id:
                qs = qs.filter(paciente_id=paciente_id)
            if doctor_id:
                qs = qs.filter(doctor_id=doctor_id)
            if cita_id:
                qs = qs.filter(cita_id=cita_id)
            return qs

        return Receta.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"]:
            raise PermissionDenied("Solo personal médico puede emitir recetas.")

        paciente_id = self.request.data.get("paciente")
        if not paciente_id:
            raise serializers.ValidationError(
                {"paciente": "Este campo es obligatorio."}
            )
        paciente = get_object_or_404(User, pk=paciente_id, role="PACIENTE")

        cita_id = self.request.data.get("cita")
        cita = None
        if cita_id:
            cita = get_object_or_404(Cita, pk=cita_id)
            if cita.paciente_id != paciente.id:
                raise serializers.ValidationError(
                    {"cita": "La cita no pertenece al paciente indicado."}
                )
            if Receta.objects.filter(cita=cita).exists():
                raise serializers.ValidationError(
                    {
                        "cita": "Ya existe una receta asociada a esta cita. "
                        "Edita la receta existente en lugar de crear una nueva."
                    }
                )

        doctor = user
        if user.role == "ADMIN":
            doctor_id = self.request.data.get("doctor")
            if not doctor_id:
                raise serializers.ValidationError(
                    {"doctor": "Debe especificar un doctor al emitir la receta."}
                )
            doctor = get_object_or_404(
                User,
                pk=doctor_id,
                role__in=["DERMATOLOGO", "PODOLOGO", "TAMIZ"],
            )

        receta = serializer.save(
            paciente=paciente,
            doctor=doctor,
            cita=cita,
            creado_por=user,
            actualizado_por=user,
        )

        if cita is not None:
            actualizar_estado_cita_atendida(cita, user)


class RecetaDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = Receta.objects.select_related(
        "paciente", "doctor", "cita"
    ).prefetch_related("medicamentos")
    serializer_class = RecetaSerializer
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        user = request.user
        if user.role == "ADMIN":
            return
        if user.role == "PACIENTE" and obj.paciente == user and request.method == "GET":
            return
        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"] and obj.doctor == user:
            return
        raise PermissionDenied("No tienes permiso para esta receta.")

    def perform_update(self, serializer):
        receta = serializer.save(actualizado_por=self.request.user)
        if receta.cita:
            actualizar_estado_cita_atendida(receta.cita, self.request.user)

    def perform_destroy(self, instance):
        cita = instance.cita
        super().perform_destroy(instance)
        if cita:
            actualizar_estado_cita_atendida(cita, self.request.user)
