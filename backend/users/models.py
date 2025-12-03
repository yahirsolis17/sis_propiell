from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.core.exceptions import ValidationError
from datetime import timedelta


# =========================
#  Validadores y constantes
# =========================

def validate_phone_length(value):
    if len(value) < 10:
        raise ValidationError("El teléfono debe tener al menos 10 dígitos")


# Choices compartidos para métodos/estados de pago
METODO_PAGO_CHOICES = [
    ("TRANSFERENCIA", "Transferencia / Depósito"),
    ("CONSULTORIO", "Pago en consultorio"),
]

ESTADO_PAGO_CHOICES = [
    ("PENDIENTE", "Pendiente de revisión"),
    ("APROBADO", "Aprobado"),
    ("RECHAZADO", "Rechazado"),
]


# =========================
#  Auditoría ligera
# =========================

class AuditMixin(models.Model):
    """
    Mixin de auditoría:
    - creado_en / actualizado_en
    - creado_por / actualizado_por (FK a User, opcional)
    """

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    creado_por = models.ForeignKey(
        "User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_creado_por",
    )
    actualizado_por = models.ForeignKey(
        "User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_actualizado_por",
    )

    class Meta:
        abstract = True


# =========================
#  User y catálogos
# =========================

class UserManager(BaseUserManager):
    def create_user(self, telefono, password=None, **extra_fields):
        if not telefono:
            raise ValueError("El número de teléfono es obligatorio")

        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)

        user = self.model(telefono=telefono, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, telefono, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "ADMIN")
        return self.create_user(telefono, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("PACIENTE", "Paciente"),
        ("DERMATOLOGO", "Dermatólogo"),
        ("PODOLOGO", "Podólogo"),
        ("TAMIZ", "Tamiz"),
        ("ADMIN", "Administrador"),
    ]

    email = None
    username = None

    nombre = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    edad = models.IntegerField()
    sexo = models.CharField(
        max_length=10,
        choices=[
            ("Masculino", "Masculino"),
            ("Femenino", "Femenino"),
            ("Otro", "Otro"),
        ],
    )
    peso = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    telefono = models.CharField(
        max_length=15,
        unique=True,
        validators=[validate_phone_length],
    )
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default="PACIENTE")
    especialidad = models.ForeignKey(
        "Especialidad",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = "telefono"
    REQUIRED_FIELDS = ["nombre", "apellidos", "edad"]

    objects = UserManager()

    def clean(self):
        if not self.telefono.isdigit():
            raise ValidationError({"telefono": "Solo se permiten números"})

    def __str__(self):
        return f"{self.nombre} {self.apellidos} - {self.role}"

class Especialidad(models.Model):
    nombre = models.CharField(
        max_length=50,
        unique=True,
        choices=[
            ("DERMATOLOGIA", "Dermatología"),
            ("PODOLOGIA", "Podología"),
            ("TAMIZ", "Tamiz"),
        ],
    )
    descripcion = models.TextField(blank=True)

    # 👇 NUEVO: define si esta especialidad requiere consentimiento informado
    requiere_consentimiento = models.BooleanField(
        default=False,
        help_text="Indica si las citas de esta especialidad requieren consentimiento informado.",
    )

    def __str__(self):
        return self.nombre

class Horario(models.Model):
    DIAS_SEMANA = [
        (1, "Lunes"),
        (2, "Martes"),
        (3, "Miércoles"),
        (4, "Jueves"),
        (5, "Viernes"),
        (6, "Sábado"),
    ]

    doctor = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )
    especialidad = models.ForeignKey("Especialidad", on_delete=models.CASCADE)

    dia_semana = models.IntegerField(choices=DIAS_SEMANA)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        unique_together = ("doctor", "dia_semana", "hora_inicio")

    def __str__(self):
        return f"{self.doctor.nombre} - {dict(self.DIAS_SEMANA)[self.dia_semana]} {self.hora_inicio} - {self.hora_fin}"


# =========================
#  Citas / Pagos / Consentimiento / Tratamiento
# =========================

class Cita(AuditMixin, models.Model):
    ESTADOS = (
        ("P", "Pendiente"),
        ("C", "Confirmada"),
        ("X", "Cancelada"),
    )

    paciente = models.ForeignKey(
        "User",
        related_name="citas_paciente",
        on_delete=models.CASCADE,
        limit_choices_to={"role": "PACIENTE"},
    )
    doctor = models.ForeignKey(
        "User",
        related_name="citas_doctor",
        on_delete=models.CASCADE,
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )
    especialidad = models.ForeignKey("Especialidad", on_delete=models.CASCADE)
    fecha_hora = models.DateTimeField()
    tipo = models.CharField(
        max_length=1,
        choices=[("I", "Inicial"), ("S", "Subsecuente")],
        default="I",
    )
    estado = models.CharField(max_length=1, choices=ESTADOS, default="P")

    tratamiento = models.ForeignKey(
        "Tratamiento",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="citas_tratamiento",
    )

    consentimiento_completado = models.BooleanField(default=False)

    # Indica si la cita ya tuvo consulta FINAL + receta asociada
    atendida = models.BooleanField(
        default=False,
        help_text="Indica si la cita ya fue atendida (consulta y receta completas).",
    )

    metodo_pago_preferido = models.CharField(
        max_length=20,
        choices=METODO_PAGO_CHOICES,
        null=True,
        blank=True,
        help_text="Método de pago preferido (informativo) para esta cita.",
    )

    class Meta:
        indexes = [
            models.Index(fields=["fecha_hora"]),
        ]

    def __str__(self):
        return f"Cita {self.id} - {self.paciente.nombre} con {self.doctor.nombre}"

    # 👇 NUEVO: regla central para saber si esta cita requiere consentimiento
    def requiere_consentimiento(self) -> bool:
        """
        Regla única:
        - Usa el flag de la especialidad si existe.
        - Si no hay especialidad, se asume que no requiere consentimiento.
        """
        esp = getattr(self, "especialidad", None)
        if not esp:
            return False

        flag = getattr(esp, "requiere_consentimiento", None)
        if flag is not None:
            return bool(flag)

        return False

    def actualizar_atendida(self):
        """
        Recalcula el flag `atendida` en función de:
        - Si existe al menos un reporte clínico en estado FINAL para esta cita.
        - Si existe una receta asociada a esta cita.
        Por diseño clínico estricto, consideramos "atendida" cuando hay
        consulta (reporte FINAL) + receta.
        """
        has_reporte_final = self.reportes.filter(estado="FINAL").exists()
        has_receta = hasattr(self, "receta") and self.receta is not None

        nueva_val = has_reporte_final and has_receta

        if self.atendida != nueva_val:
            self.atendida = nueva_val
            # actualizado_en viene de AuditMixin
            self.save(update_fields=["atendida", "actualizado_en"])


class Pago(AuditMixin, models.Model):
    METODO_CHOICES = METODO_PAGO_CHOICES
    ESTADO_CHOICES = ESTADO_PAGO_CHOICES

    paciente = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="pagos_paciente",
    )
    cita = models.ForeignKey(
        "Cita",
        on_delete=models.CASCADE,
        related_name="pagos",
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)
    pagado = models.DecimalField(max_digits=10, decimal_places=2)
    fecha = models.DateField(auto_now_add=True)
    verificado = models.BooleanField(default=False)

    metodo_pago = models.CharField(
        max_length=20,
        choices=METODO_CHOICES,
    )
    estado_pago = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default="PENDIENTE",
    )

    comprobante = models.ImageField(
        upload_to="users/comprobantes/",
        null=True,
        blank=True,
    )

    revertido = models.BooleanField(default=False)
    motivo_reverso = models.TextField(blank=True)
    fecha_reverso = models.DateTimeField(null=True, blank=True)

    def saldo_pendiente(self):
        return self.total - self.pagado

    def __str__(self):
        return f"Pago {self.id} - {self.paciente.nombre} ({self.get_metodo_pago_display()})"


class Consentimiento(AuditMixin, models.Model):
    cita = models.OneToOneField(
        Cita,
        on_delete=models.CASCADE,
        related_name="consentimiento",
    )

    diagnostico_principal = models.TextField(blank=True)
    procedimiento_propuesto = models.TextField(blank=True)
    beneficios = models.TextField(blank=True)
    riesgos = models.TextField(blank=True)
    alternativas = models.TextField(blank=True)

    testigo1_nombre = models.CharField(max_length=255, blank=True)
    testigo2_nombre = models.CharField(max_length=255, blank=True)

    lugar = models.CharField(max_length=255, default="Zihuatanejo, Guerrero")
    fecha = models.DateField()
    hora = models.TimeField()

    firma_paciente = models.ImageField(
        upload_to="users/firmas/",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"Consentimiento cita {self.cita_id} - {self.cita.paciente.nombre}"


class Tratamiento(AuditMixin, models.Model):
    """
    Tratamiento asociado a un paciente y un doctor.
    Soporta citas subsecuentes y alta del paciente (finalización del tratamiento).
    """

    paciente = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tratamientos_paciente",
        limit_choices_to={"role": "PACIENTE"},
    )
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tratamientos_doctor",
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )

    # Ej: "Tratamiento para acné", "Tratamiento onicomicosis"
    nombre = models.CharField(max_length=255, blank=True)
    descripcion = models.TextField(blank=True)

    # Frecuencia esperada de revisiones (en días)
    frecuencia_dias = models.PositiveIntegerField(default=15)

    # Vida del tratamiento
    fecha_inicio = models.DateTimeField(auto_now_add=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)

    # Flag lógico de si el tratamiento sigue activo
    activo = models.BooleanField(default=True)

    motivo_cierre = models.TextField(blank=True)

    class Meta:
        constraints = [
            # No permitir más de un tratamiento ACTIVO para el mismo paciente/doctor
            models.UniqueConstraint(
                fields=["paciente", "doctor"],
                condition=models.Q(activo=True),
                name="unique_active_tratamiento_paciente_doctor",
            )
        ]

    def proxima_cita(self):
        """
        Calcula una fecha sugerida para la próxima cita:
        - Si hay citas ligadas al tratamiento y atendidas, toma la última atendida.
        - Si no hay atendidas, toma la última cita del tratamiento (cualquiera).
        - Si no hay citas, usa fecha_inicio.
        - Si el tratamiento está inactivo, retorna None.
        """
        if not self.activo:
            return None

        from django.utils import timezone

        ultima_cita_atendida = None
        ultima_cita = None

        if hasattr(self, "citas_tratamiento"):
            qs = self.citas_tratamiento.order_by("-fecha_hora")
            ultima_cita_atendida = qs.filter(atendida=True).first()
            ultima_cita = qs.first()

        if ultima_cita_atendida:
            base_fecha = ultima_cita_atendida.fecha_hora
        elif ultima_cita:
            base_fecha = ultima_cita.fecha_hora
        else:
            base_fecha = self.fecha_inicio or timezone.now()

        return base_fecha + timedelta(days=self.frecuencia_dias)

    def finalizar(self, usuario=None, motivo=None):
        """
        Marca el tratamiento como finalizado (alta del paciente).
        Opcionalmente guarda el usuario que lo cerró y el motivo.
        """
        from django.utils import timezone

        self.activo = False
        self.fecha_fin = timezone.now()
        if motivo:
            self.motivo_cierre = motivo
        if usuario is not None:
            self.actualizado_por = usuario
        self.save(update_fields=["activo", "fecha_fin", "motivo_cierre", "actualizado_por", "actualizado_en"])

    def __str__(self):
        base = f"Tratamiento {self.id} - {self.paciente.nombre}"
        if self.nombre:
            return f"{base} ({self.nombre})"
        return base


class ProcedimientoConsulta(AuditMixin, models.Model):
    """
    Procedimientos realizados dentro de una consulta (cita).
    Ej.: extracción de uña, limpieza facial, láser, etc.
    Cada procedimiento tiene su propio costo y estado de pago.
    """

    cita = models.ForeignKey(
        Cita,
        on_delete=models.CASCADE,
        related_name="procedimientos",
    )
    paciente = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="procedimientos_paciente",
        limit_choices_to={"role": "PACIENTE"},
    )
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="procedimientos_doctor",
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )

    nombre = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True)
    costo = models.DecimalField(max_digits=10, decimal_places=2)

    estado_pago = models.CharField(
        max_length=20,
        choices=ESTADO_PAGO_CHOICES,
        default="PENDIENTE",
        help_text="Estado del pago específico de este procedimiento.",
    )

    class Meta:
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["cita"]),
            models.Index(fields=["paciente"]),
            models.Index(fields=["doctor"]),
        ]

    def __str__(self):
        return f"Procedimiento {self.nombre} - Cita {self.cita_id}"


# =========================
#  Reportes / Recetas
# =========================

class ReportePaciente(AuditMixin, models.Model):
    ESTADOS = [
        ("BORRADOR", "Borrador"),
        ("FINAL", "Final"),
    ]

    cita = models.ForeignKey(
        Cita,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reportes",
    )
    paciente = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reportes_paciente",
        limit_choices_to={"role": "PACIENTE"},
    )
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reportes_doctor",
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )

    resumen = models.TextField()
    diagnostico = models.TextField(blank=True)
    recomendaciones = models.TextField(blank=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default="FINAL")

    class Meta:
        ordering = ["-creado_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["cita"],
                condition=models.Q(cita__isnull=False),
                name="unique_reporte_por_cita_no_nula",
            )
        ]

    def __str__(self):
        return f"Reporte {self.id} - {self.paciente.nombre} / {self.doctor.nombre}"


class Receta(AuditMixin, models.Model):
    cita = models.OneToOneField(
        Cita,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receta",
    )
    paciente = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="recetas_paciente",
        limit_choices_to={"role": "PACIENTE"},
    )
    doctor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="recetas_doctor",
        limit_choices_to={"role__in": ["DERMATOLOGO", "PODOLOGO", "TAMIZ"]},
    )

    indicaciones_generales = models.TextField(blank=True)
    notas = models.TextField(blank=True)

    fecha_emision = models.DateField(auto_now_add=True)
    vigente_hasta = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_emision"]

    def __str__(self):
        return f"Receta {self.id} - {self.paciente.nombre}"


class RecetaMedicamento(models.Model):
    receta = models.ForeignKey(
        Receta,
        on_delete=models.CASCADE,
        related_name="medicamentos",
    )
    nombre = models.CharField(max_length=255)
    dosis = models.CharField(max_length=255, blank=True)
    frecuencia = models.CharField(max_length=255, blank=True)
    duracion = models.CharField(max_length=255, blank=True)
    via_administracion = models.CharField(max_length=255, blank=True)
    notas = models.TextField(blank=True)

    def __str__(self):
        return f"{self.nombre} ({self.receta_id})"
