import logging
from datetime import datetime, timedelta

from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied

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
)
from .permissions import IsRoleMatching

logger = logging.getLogger(__name__)


class VerifyAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"detail": "Autenticado OK"}, status=200)


class CustomTokenRefreshView(APIView):
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


class CitaListCreateAPI(generics.ListCreateAPIView):
    queryset = Cita.objects.all()
    serializer_class = CitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("paciente", "doctor", "especialidad")
            .prefetch_related("pagos")
        )

        user = self.request.user
        estado = self.request.query_params.get("estado")
        paciente_id = self.request.query_params.get("paciente")
        doctor_id = self.request.query_params.get("doctor")

        # Visibilidad por rol
        if user.role == "PACIENTE":
            qs = qs.filter(paciente=user)
        elif user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            qs = qs.filter(doctor=user)
        elif user.role != "ADMIN":
            return Cita.objects.none()

        # Filtros adicionales (admin u otros ya limitados)
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if estado:
            qs = qs.filter(estado=estado.upper()[0])

        return qs.order_by("fecha_hora")

    def perform_create(self, serializer):
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

        serializer.save(
            paciente=self.request.user,
            doctor=horario_disponible.doctor,
            especialidad=especialidad,
            fecha_hora=fecha_hora,
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
            .prefetch_related("pagos")
        )

    def get_object(self):
        cita = super().get_object()
        user = self.request.user

        if not (user == cita.paciente or user == cita.doctor or user.role == "ADMIN"):
            raise PermissionDenied("No tienes permiso para ver esta cita.")

        return cita


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
    permission_classes = [IsAuthenticated]
    serializer_class = AdminUserSerializer

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.user.role != "ADMIN":
            self.permission_denied(
                request,
                message="Solo administradores pueden crear usuarios",
                code=status.HTTP_403_FORBIDDEN,
            )


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


class PagoCreateAPI(generics.CreateAPIView):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        cita_id = self.request.data.get("cita")
        paciente = self.request.user
        cita = get_object_or_404(Cita, pk=cita_id, paciente=paciente)

        # Guardar el pago con total predeterminado de 900 y sin verificar
        serializer.save(
            paciente=paciente,
            cita=cita,
            total=900,
            pagado=0,
            verificado=False,
        )


class CitaSubsecuenteCreateAPI(APIView):
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


class CitaConfirmAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        cita = get_object_or_404(Cita, pk=pk, doctor=request.user)

        if cita.estado not in ["P"]:
            return Response(
                {"error": "La cita ya fue procesada o cancelada"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accion = request.data.get("accion", "").lower()

        pago = cita.pagos.first()
        if not pago:
            return Response(
                {"error": "No se encontró un pago asociado a la cita."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if accion == "cancelar":
            cita.estado = "X"
            cita.save()
            return Response(
                {"status": "Cita cancelada por comprobante no verificado"},
                status=status.HTTP_200_OK,
            )
        elif accion == "confirmar":
            pago.verificado = True
            pago.pagado = pago.total
            pago.fecha = timezone.now()
            pago.save()

            cita.estado = "C"
            cita.save()

            if cita.tipo == "I":
                if not Tratamiento.objects.filter(
                    paciente=cita.paciente,
                    doctor=cita.doctor,
                    activo=True,
                ).exists():
                    Tratamiento.objects.create(
                        paciente=cita.paciente,
                        doctor=cita.doctor,
                        frecuencia_dias=15,
                    )

            return Response(
                {"status": "Cita confirmada"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"error": "Acción no válida."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class TratamientoAPI(generics.RetrieveUpdateAPIView):
    queryset = Tratamiento.objects.all()
    serializer_class = TratamientoSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return get_object_or_404(Tratamiento, paciente=self.request.user)


class PagoListAPI(generics.ListAPIView):
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        paciente_id = self.request.query_params.get("paciente")

        if user.role == "PACIENTE":
            return Pago.objects.filter(paciente=user)
        if user.role in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            return Pago.objects.filter(cita__doctor=user)

        qs = Pago.objects.all()
        if paciente_id:
            qs = qs.filter(paciente_id=paciente_id)
        return qs


class TamizResultadosAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "TAMIZ":
            return Response(
                {"error": "No autorizado"},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Endpoint de marcador
        return Response([], status=status.HTTP_200_OK)


# 🔥 API para consentimiento informado de una cita
class CitaConsentimientoAPI(APIView):
    """
    GET  /api/citas/<pk>/consentimiento/   -> ver consentimiento (paciente, doctor, admin)
    POST /api/citas/<pk>/consentimiento/   -> crear/actualizar (solo paciente dueño, cita CONFIRMADA)
    """

    permission_classes = [IsAuthenticated]

    def _get_cita(self, pk):
        return get_object_or_404(Cita, pk=pk)

    def get(self, request, pk):
        cita = self._get_cita(pk)
        user = request.user

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

        serializer = ConsentimientoSerializer(consentimiento)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        cita = self._get_cita(pk)
        user = request.user

        # Solo el paciente puede llenar/modificar su consentimiento
        if user != cita.paciente:
            return Response(
                {"detail": "Solo el paciente puede completar el consentimiento."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Solo cuando la cita ya está confirmada por el médico
        if cita.estado != "C":
            return Response(
                {
                    "detail": "Solo puedes completar el consentimiento cuando la cita está confirmada."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = getattr(cita, "consentimiento", None)

        if existing:
            serializer = ConsentimientoSerializer(
                existing,
                data=request.data,
                partial=True,
            )
        else:
            serializer = ConsentimientoSerializer(
                data=request.data,
                partial=True,
            )

        if serializer.is_valid():
            consentimiento = serializer.save(
                cita=cita,
                fecha=cita.fecha_hora.date(),
                hora=cita.fecha_hora.time(),
                lugar="Zihuatanejo, Guerrero",
            )

            if not cita.consentimiento_completado:
                cita.consentimiento_completado = True
                cita.save(update_fields=["consentimiento_completado"])

            status_code = (
                status.HTTP_200_OK
                if existing
                else status.HTTP_201_CREATED
            )
            return Response(
                ConsentimientoSerializer(consentimiento).data,
                status=status_code,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
