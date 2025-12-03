from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.utils import timezone

from .models import(
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


# =========================
#  Users / Auth
# =========================

class BaseUserSerializer(serializers.ModelSerializer):
    """Datos básicos de usuario después del login"""

    class Meta:
        model = User
        fields = [
            "id",
            "telefono",
            "nombre",
            "apellidos",
            "role",
        ]


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "nombre", "apellidos", "role"]


class RegisterSerializer(serializers.ModelSerializer):
    """Serializador para registrar nuevos pacientes"""

    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "password",
            "password2",
            "nombre",
            "apellidos",
            "edad",
            "sexo",
            "peso",
            "telefono",
            "role",
        ]

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError(
                {"password": "Las contraseñas no coinciden"}
            )
        return data

    def validate_nombre(self, value):
        if not value.replace(" ", "").isalpha():
            raise serializers.ValidationError("El nombre solo debe contener letras.")
        if len(value) < 2:
            raise serializers.ValidationError(
                "El nombre debe tener al menos 2 caracteres."
            )
        return value

    def validate_apellidos(self, value):
        if not value.replace(" ", "").isalpha():
            raise serializers.ValidationError(
                "Los apellidos solo deben contener letras."
            )
        if len(value) < 2:
            raise serializers.ValidationError(
                "Los apellidos deben tener al menos 2 caracteres."
            )
        return value

    def validate_edad(self, value):
        if value is None:
            raise serializers.ValidationError("La edad es obligatoria.")
        if value < 0:
            raise serializers.ValidationError("La edad no puede ser un número negativo.")
        if value < 18:
            raise serializers.ValidationError(
                "Debes tener al menos 18 años para registrarte."
            )
        if value > 120:
            raise serializers.ValidationError("La edad ingresada no es válida.")
        return value

    def validate_sexo(self, value):
        if value not in ["Masculino", "Femenino", "Otro"]:
            raise serializers.ValidationError(
                "El sexo debe ser Masculino, Femenino u Otro."
            )
        return value

    def validate_peso(self, value):
        if value is not None:
            if value <= 0:
                raise serializers.ValidationError(
                    "El peso debe ser un número positivo."
                )
            if value > 300:
                raise serializers.ValidationError("El peso ingresado no es válido.")
        return value

    def validate_telefono(self, value):
        if not value.isdigit():
            raise serializers.ValidationError(
                "El número de teléfono solo debe contener dígitos."
            )
        if len(value) != 10:
            raise serializers.ValidationError(
                "El número de teléfono debe tener exactamente 10 dígitos."
            )
        if User.objects.filter(telefono=value).exists():
            raise serializers.ValidationError(
                "Este número de teléfono ya está registrado."
            )
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError(
                "La contraseña debe tener al menos 8 caracteres."
            )
        if not any(char.isdigit() for char in value):
            raise serializers.ValidationError(
                "La contraseña debe contener al menos un número."
            )
        if not any(char.isalpha() for char in value):
            raise serializers.ValidationError(
                "La contraseña debe contener al menos una letra."
            )
        if value.isdigit():
            raise serializers.ValidationError(
                "La contraseña no puede estar compuesta solo por números."
            )
        if value.lower() in ["password", "12345678", "admin"]:
            raise serializers.ValidationError(
                "La contraseña es demasiado común. Elige una más segura."
            )
        return value

    def create(self, validated_data):
        validated_data.pop("password2")
        validated_data["role"] = "PACIENTE"
        return User.objects.create_user(**validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    """Para que un ADMIN cree cuentas de especialistas y otros usuarios"""

    password = serializers.CharField(
        write_only=True,
        min_length=6,
        validators=[validate_password],
    )

    class Meta:
        model = User
        fields = [
            "id",
            "password",
            "nombre",
            "apellidos",
            "edad",
            "sexo",
            "peso",
            "telefono",
            "role",
        ]

    def validate_telefono(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Solo se permiten números en el teléfono.")
        if User.objects.filter(telefono=value).exists():
            raise serializers.ValidationError("Este teléfono ya está registrado.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    telefono = serializers.CharField(max_length=10)
    password = serializers.CharField(write_only=True)

    def validate_telefono(self, value):
        value = value.strip()
        if len(value) != 10 or not value.isdigit():
            raise serializers.ValidationError("El teléfono debe contener 10 dígitos")
        return value

    def validate(self, data):
        user = authenticate(
            self.context.get("request"),
            telefono=data.get("telefono"),
            password=data.get("password"),
        )
        if not user:
            raise serializers.ValidationError(
                {"non_field_errors": ["Teléfono o contraseña incorrectos"]}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": ["Cuenta desactivada"]}
            )
        data["user"] = user
        return data


# =========================
#  Catálogos / Pacientes
# =========================

class EspecialidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = ["id", "nombre", "descripcion", "requiere_consentimiento"]


class HorarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Horario
        fields = ["id", "doctor", "dia_semana", "hora_inicio", "hora_fin"]
        extra_kwargs = {
            "doctor": {"read_only": True},
        }


class PacienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "nombre",
            "apellidos",
            "edad",
            "sexo",
            "peso",
            "telefono",
            "role",
        ]


# =========================
#  Pagos / Citas / Tratamientos / Procedimientos
# =========================

class PagoSerializer(serializers.ModelSerializer):
    comprobante = serializers.ImageField(
        use_url=True,
        required=False,
        allow_null=True,
    )
    metodo_pago_display = serializers.CharField(
        source="get_metodo_pago_display",
        read_only=True,
    )
    estado_pago_display = serializers.CharField(
        source="get_estado_pago_display",
        read_only=True,
    )

    class Meta:
        model = Pago
        fields = "__all__"
        read_only_fields = [
            "paciente",
            "fecha",
            "verificado",
            "pagado",
            "total",
            "metodo_pago",
            "estado_pago",
            "revertido",
            "motivo_reverso",
            "fecha_reverso",
            "creado_en",
            "actualizado_en",
            "creado_por",
            "actualizado_por",
        ]


class ProcedimientoConsultaSerializer(serializers.ModelSerializer):
    paciente = PacienteSerializer(read_only=True)
    doctor = DoctorSerializer(read_only=True)

    class Meta:
        model = ProcedimientoConsulta
        fields = [
            "id",
            "cita",
            "paciente",
            "doctor",
            "nombre",
            "descripcion",
            "costo",
            "estado_pago",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "paciente",
            "doctor",
            "creado_en",
            "actualizado_en",
        ]

    def validate_costo(self, value):
        if value < 0:
            raise serializers.ValidationError("El costo no puede ser negativo.")
        return value


class TratamientoLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tratamiento
        fields = (
            "id",
            "nombre",
            "activo",
            "frecuencia_dias",
            "fecha_inicio",
            "fecha_fin",
        )
        read_only_fields = fields


class CitaSerializer(serializers.ModelSerializer):
    doctor = DoctorSerializer(read_only=True)
    especialidad = EspecialidadSerializer(read_only=True)
    # Campo write-only para crear/editar
    especialidad_id = serializers.PrimaryKeyRelatedField(
        source="especialidad",
        queryset=Especialidad.objects.all(),
        write_only=True,
        required=True,
    )
    # Texto legible: "Pendiente", "Confirmada", "Cancelada"
    estado = serializers.CharField(source="get_estado_display", read_only=True)
    # Codigo crudo: "P", "C", "X"
    estado_codigo = serializers.CharField(source="estado", read_only=True)
    # Texto legible: "Inicial" / "Subsecuente"
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    paciente = PacienteSerializer(read_only=True)
    pagos = serializers.SerializerMethodField()
    procedimientos = ProcedimientoConsultaSerializer(many=True, read_only=True)
    consentimiento_completado = serializers.BooleanField(read_only=True)
    atendida = serializers.BooleanField(read_only=True)
    tratamiento = TratamientoLiteSerializer(read_only=True)

    # 👇 NUEVO: bandera directa para el front
    requiere_consentimiento = serializers.SerializerMethodField()
    paciente_puede_reprogramar = serializers.SerializerMethodField()
    paciente_puede_cancelar = serializers.SerializerMethodField()

    class Meta:
        model = Cita
        fields = [
            "id",
            "paciente",
            "doctor",
            "especialidad",
            "especialidad_id",
            "fecha_hora",
            "tipo",
            "tipo_display",
            "estado",
            "estado_codigo",
            "tratamiento",
            "pagos",
            "procedimientos",
            "consentimiento_completado",
            "atendida",
            "metodo_pago_preferido",
            "requiere_consentimiento",  # 👈 NUEVO
            "paciente_puede_reprogramar",
            "paciente_puede_cancelar",
        ]
        read_only_fields = (
            "estado",
            "estado_codigo",
            "tratamiento",
            "paciente",
            "doctor",
            "consentimiento_completado",
            "atendida",
            "requiere_consentimiento",  # 👈 NUEVO
            "paciente_puede_reprogramar",
            "paciente_puede_cancelar",
        )

    def get_pagos(self, obj):
        pagos = obj.pagos.all()
        return PagoSerializer(
            pagos,
            many=True,
            context=self.context,
        ).data

    # 👇 NUEVO
    def get_requiere_consentimiento(self, obj):
        try:
            return bool(obj.requiere_consentimiento())
        except Exception:
            return False

    def _es_paciente_duenio(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return (
            user
            and getattr(user, "is_authenticated", False)
            and getattr(user, "role", None) == "PACIENTE"
            and obj.paciente_id == user.id
        )

    def get_paciente_puede_reprogramar(self, obj):
        if not self._es_paciente_duenio(obj):
            return False

        ahora = timezone.now()

        if obj.estado == "X":
            return False
        if getattr(obj, "atendida", False):
            return False
        if obj.fecha_hora <= ahora:
            return False
        if obj.tratamiento and not obj.tratamiento.activo:
            return False

        return True

    def get_paciente_puede_cancelar(self, obj):
        if not self._es_paciente_duenio(obj):
            return False

        ahora = timezone.now()

        if obj.estado not in ["P", "C"]:
            return False
        if obj.fecha_hora <= ahora:
            return False

        dias_restantes = (obj.fecha_hora.date() - ahora.date()).days
        if dias_restantes < 7:
            return False

        return True


class TratamientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tratamiento
        fields = "__all__"
        read_only_fields = (
            "fecha_inicio",
            "fecha_fin",
            "activo",
            "motivo_cierre",
            "creado_en",
            "actualizado_en",
            "creado_por",
            "actualizado_por",
        )

    def validate_doctor(self, value):
        # Cualquier rol medico valido puede llevar tratamientos
        if value.role not in ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]:
            raise serializers.ValidationError(
                "El doctor asignado no tiene un rol medico valido"
            )
        return value

    def validate(self, data):
        """
        Evita mas de un tratamiento activo por paciente/doctor.
        Considera tambien el caso de actualizacion (self.instance).
        """
        data = super().validate(data)

        paciente = data.get("paciente") or getattr(self.instance, "paciente", None)
        doctor = data.get("doctor") or getattr(self.instance, "doctor", None)

        if paciente and doctor:
            qs = Tratamiento.objects.filter(
                paciente=paciente,
                doctor=doctor,
                activo=True,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    "Ya existe un tratamiento activo para este paciente y doctor."
                )
        return data


# Serializer ligero para exponer info de tratamiento al paciente
class TratamientoPacienteSerializer(serializers.ModelSerializer):
    """Endpoint de tratamiento actual del paciente.

    Expone nombre del doctor, especialidad y contadores basicos.
    """

    doctor_nombre = serializers.SerializerMethodField()
    doctor_especialidad = serializers.SerializerMethodField()
    total_citas = serializers.SerializerMethodField()
    total_recetas = serializers.SerializerMethodField()

    class Meta:
        model = Tratamiento
        fields = [
            "id",
            "nombre",
            "activo",
            "frecuencia_dias",
            "fecha_inicio",
            "fecha_fin",
            "doctor",
            "doctor_nombre",
            "doctor_especialidad",
            "total_citas",
            "total_recetas",
        ]
        read_only_fields = fields

    def get_doctor_nombre(self, obj):
        doctor = getattr(obj, "doctor", None)
        if not doctor:
            return None

        nombre = f"{getattr(doctor, 'nombre', '')} {getattr(doctor, 'apellidos', '')}".strip()
        if nombre:
            return nombre

        username = getattr(doctor, "username", None)
        return username or None

    def get_doctor_especialidad(self, obj):
        doctor = getattr(obj, "doctor", None)

        # 1) FK directa en el doctor
        if doctor and hasattr(doctor, "especialidad"):
            esp = getattr(doctor, "especialidad", None)
            if esp:
                return getattr(esp, "nombre", str(esp))

        # 2) ManyToMany de especialidades
        if doctor and hasattr(doctor, "especialidades"):
            try:
                first_esp = doctor.especialidades.all().first()
            except Exception:
                first_esp = None
            if first_esp:
                return getattr(first_esp, "nombre", str(first_esp))

        # 3) Desde la primera cita del tratamiento
        primera_cita = None
        try:
            primera_cita = obj.citas.order_by("fecha_hora").first()
        except Exception:
            try:
                primera_cita = obj.cita_set.order_by("fecha_hora").first()
            except Exception:
                primera_cita = None

        if primera_cita and getattr(primera_cita, "especialidad", None):
            esp = primera_cita.especialidad
            return getattr(esp, "nombre", str(esp))

        return None

    def get_total_citas(self, obj):
        try:
            return obj.citas.count()
        except Exception:
            try:
                return obj.cita_set.count()
            except Exception:
                return 0

    def get_total_recetas(self, obj):
        return Receta.objects.filter(cita__tratamiento=obj).count()

# =========================
#  Reportes / Recetas
# =========================

class ReportePacienteSerializer(serializers.ModelSerializer):
    paciente = PacienteSerializer(read_only=True)
    doctor = DoctorSerializer(read_only=True)

    class Meta:
        model = ReportePaciente
        fields = [
            "id",
            "cita",
            "paciente",
            "doctor",
            "resumen",
            "diagnostico",
            "recomendaciones",
            "estado",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "paciente",
            "doctor",
            "creado_en",
            "actualizado_en",
        ]

    def validate(self, data):
        data = super().validate(data)
        cita = data.get("cita") or getattr(self.instance, "cita", None)
        if cita is not None:
            qs = ReportePaciente.objects.filter(cita=cita)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"cita": "Ya existe un reporte clínico asociado a esta cita."}
                )
        return data

    def _actualizar_cita_atendida(self, reporte):
        cita = reporte.cita
        if not cita:
            return
        if hasattr(cita, "actualizar_atendida"):
            cita.actualizar_atendida()

    def create(self, validated_data):
        reporte = super().create(validated_data)
        self._actualizar_cita_atendida(reporte)
        return reporte

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._actualizar_cita_atendida(instance)
        return instance


class RecetaMedicamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecetaMedicamento
        fields = [
            "id",
            "nombre",
            "dosis",
            "frecuencia",
            "duracion",
            "via_administracion",
            "notas",
        ]


class RecetaSerializer(serializers.ModelSerializer):
    paciente = PacienteSerializer(read_only=True)
    doctor = DoctorSerializer(read_only=True)
    medicamentos = RecetaMedicamentoSerializer(many=True)

    class Meta:
        model = Receta
        fields = [
            "id",
            "cita",
            "paciente",
            "doctor",
            "indicaciones_generales",
            "notas",
            "fecha_emision",
            "vigente_hasta",
            "medicamentos",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "paciente",
            "doctor",
            "fecha_emision",
            "creado_en",
            "actualizado_en",
        ]

    def validate(self, data):
        data = super().validate(data)
        cita = data.get("cita") or getattr(self.instance, "cita", None)
        if cita is not None:
            qs = Receta.objects.filter(cita=cita)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"cita": "Ya existe una receta asociada a esta cita."}
                )
        return data

    def _actualizar_cita_atendida(self, receta):
        cita = receta.cita
        if not cita:
            return
        if hasattr(cita, "actualizar_atendida"):
            cita.actualizar_atendida()

    def create(self, validated_data):
        meds_data = validated_data.pop("medicamentos", [])
        receta = Receta.objects.create(**validated_data)
        for med in meds_data:
            RecetaMedicamento.objects.create(receta=receta, **med)
        self._actualizar_cita_atendida(receta)
        return receta

    def update(self, instance, validated_data):
        meds_data = validated_data.pop("medicamentos", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if meds_data is not None:
            instance.medicamentos.all().delete()
            for med in meds_data:
                RecetaMedicamento.objects.create(receta=instance, **med)

        self._actualizar_cita_atendida(instance)
        return instance


# =========================
#  Consentimiento informado
# =========================

class ConsentimientoSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.CharField(
        source="cita.paciente.nombre",
        read_only=True,
    )
    paciente_apellidos = serializers.CharField(
        source="cita.paciente.apellidos",
        read_only=True,
    )
    paciente_edad = serializers.IntegerField(
        source="cita.paciente.edad",
        read_only=True,
    )
    paciente_sexo = serializers.CharField(
        source="cita.paciente.sexo",
        read_only=True,
    )
    paciente_telefono = serializers.CharField(
        source="cita.paciente.telefono",
        read_only=True,
    )

    doctor_nombre = serializers.CharField(
        source="cita.doctor.nombre",
        read_only=True,
    )
    doctor_apellidos = serializers.CharField(
        source="cita.doctor.apellidos",
        read_only=True,
    )
    doctor_especialidad = serializers.CharField(
        source="cita.especialidad.nombre",
        read_only=True,
    )

    tipo_cita = serializers.CharField(
        source="cita.get_tipo_display",
        read_only=True,
    )

    firma_paciente = serializers.ImageField(
        required=False,
        allow_null=True,
    )
    firma_paciente_url = serializers.SerializerMethodField()

    class Meta:
        model = Consentimiento
        fields = [
            "id",
            "cita",
            "diagnostico_principal",
            "procedimiento_propuesto",
            "beneficios",
            "riesgos",
            "alternativas",
            "testigo1_nombre",
            "testigo2_nombre",
            "lugar",
            "fecha",
            "hora",
            "firma_paciente",
            "firma_paciente_url",
            # contexto
            "paciente_nombre",
            "paciente_apellidos",
            "paciente_edad",
            "paciente_sexo",
            "paciente_telefono",
            "doctor_nombre",
            "doctor_apellidos",
            "doctor_especialidad",
            "tipo_cita",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "cita",
            "lugar",
            "fecha",
            "hora",
            "firma_paciente_url",
            "paciente_nombre",
            "paciente_apellidos",
            "paciente_edad",
            "paciente_sexo",
            "paciente_telefono",
            "doctor_nombre",
            "doctor_apellidos",
            "doctor_especialidad",
            "tipo_cita",
            "creado_en",
            "actualizado_en",
        ]

    def get_firma_paciente_url(self, obj):
        if not obj.firma_paciente:
            return None

        request = self.context.get("request")
        try:
            url = obj.firma_paciente.url
        except ValueError:
            return None

        if request is not None:
            return request.build_absolute_uri(url)
        return url
