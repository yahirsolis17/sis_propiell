# archivo: backend/tu_app/utils/pdf_consentimiento.py

from io import BytesIO
from datetime import datetime

import textwrap
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm


def _draw_wrapped_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    font_name: str = "Helvetica",
    font_size: int = 10,
    leading: int = 14,
):
    """
    Dibuja texto multilínea con wrap básico dentro de un ancho máximo.
    Devuelve la coordenada Y final después de dibujar.
    """
    if not text:
        return y

    c.setFont(font_name, font_size)

    # Aproximación de caracteres por línea según el tamaño del font
    # (no perfecto, pero suficiente para que no se desborde)
    chars_per_line = max(40, int(max_width / (font_size * 0.55)))

    # Soporta párrafos separados por saltos de línea
    paragraphs = text.split("\n")

    for para in paragraphs:
        if not para.strip():
            y -= leading
            continue

        for line in textwrap.wrap(para, width=chars_per_line):
            c.drawString(x, y, line)
            y -= leading

    return y


def build_consentimiento_pdf(cita, consentimiento):
    """
    Genera el PDF del consentimiento informado para una cita específica.

    Recibe:
      - cita: instancia de Cita (ya con paciente, doctor, especialidad)
      - consentimiento: instancia de Consentimiento

    Devuelve:
      - bytes del PDF listo para enviar en un HttpResponse.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Márgenes
    left_margin = 25 * mm
    right_margin = width - 25 * mm
    top_margin = height - 25 * mm
    bottom_margin = 20 * mm
    max_width = right_margin - left_margin

    # Datos base
    paciente = cita.paciente
    doctor = cita.doctor
    especialidad = cita.especialidad
    fecha_cita = cita.fecha_hora

    # =========================
    # ENCABEZADO
    # =========================
    y = top_margin
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "CONSENTIMIENTO INFORMADO")
    y -= 30

    c.setFont("Helvetica", 10)
    c.drawCentredString(
        width / 2,
        y,
        "Documento de consentimiento informado para procedimientos y tratamientos médicos",
    )
    y -= 30

    # =========================
    # DATOS DEL PACIENTE Y DOCTOR
    # =========================
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left_margin, y, "Datos del paciente")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(
        left_margin,
        y,
        f"Nombre: {paciente.nombre} {paciente.apellidos}",
    )
    y -= 14
    c.drawString(left_margin, y, f"Edad: {paciente.edad} años")
    y -= 14
    c.drawString(left_margin, y, f"Sexo: {paciente.sexo}")
    y -= 14
    c.drawString(left_margin, y, f"Teléfono: {paciente.telefono}")
    y -= 22

    c.setFont("Helvetica-Bold", 11)
    c.drawString(left_margin, y, "Datos del profesional de la salud")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(
        left_margin,
        y,
        f"Nombre: {doctor.nombre} {doctor.apellidos}",
    )
    y -= 14
    c.drawString(
        left_margin,
        y,
        f"Especialidad: {especialidad.nombre if especialidad else 'N/A'}",
    )
    y -= 14
    c.drawString(
        left_margin,
        y,
        f"Tipo de cita: {cita.get_tipo_display()}",
    )
    y -= 14
    c.drawString(
        left_margin,
        y,
        f"Fecha y hora de la cita: {fecha_cita.strftime('%d/%m/%Y %H:%M')}",
    )
    y -= 24

    # =========================
    # TEXTO INTRODUCTORIO
    # =========================
    c.setFont("Helvetica", 10)
    intro = (
        f"Yo, {paciente.nombre} {paciente.apellidos}, declaro que he sido informado(a) "
        "de manera clara, suficiente y comprensible sobre mi estado de salud, "
        "el procedimiento propuesto y sus implicaciones, y que he tenido oportunidad "
        "de hacer preguntas y obtener respuestas satisfactorias."
    )
    y = _draw_wrapped_text(c, intro, left_margin, y, max_width)
    y -= 10

    # =========================
    # SECCIONES CLÍNICAS
    # =========================
    def draw_section(title, content):
        nonlocal y
        if y < bottom_margin + 80:  # Nueva página si estamos casi al final
            c.showPage()
            y = top_margin

        c.setFont("Helvetica-Bold", 11)
        c.drawString(left_margin, y, title)
        y -= 16
        c.setFont("Helvetica", 10)
        if content:
            y = _draw_wrapped_text(c, content, left_margin, y, max_width)
        else:
            y = _draw_wrapped_text(
                c,
                "Sin información registrada.",
                left_margin,
                y,
                max_width,
            )
        y -= 8

    draw_section("Diagnóstico principal", consentimiento.diagnostico_principal)
    draw_section("Procedimiento propuesto", consentimiento.procedimiento_propuesto)
    draw_section("Beneficios esperados", consentimiento.beneficios)
    draw_section("Riesgos y posibles complicaciones", consentimiento.riesgos)
    draw_section("Alternativas disponibles", consentimiento.alternativas)

    # =========================
    # TESTIGOS
    # =========================
    if y < bottom_margin + 100:
        c.showPage()
        y = top_margin

    c.setFont("Helvetica-Bold", 11)
    c.drawString(left_margin, y, "Testigos")
    y -= 18
    c.setFont("Helvetica", 10)

    testigo1 = consentimiento.testigo1_nombre or "____________________________"
    testigo2 = consentimiento.testigo2_nombre or "____________________________"

    c.drawString(left_margin, y, f"Testigo 1: {testigo1}")
    y -= 16
    c.drawString(left_margin, y, f"Testigo 2: {testigo2}")
    y -= 30

    # =========================
    # LUGAR, FECHA Y HORA
    # =========================
    lugar = consentimiento.lugar or "Zihuatanejo, Guerrero"
    fecha = consentimiento.fecha
    hora = consentimiento.hora

    fecha_str = (
        fecha.strftime("%d/%m/%Y") if isinstance(fecha, datetime) else fecha.strftime("%d/%m/%Y")
    )
    hora_str = hora.strftime("%H:%M")

    c.setFont("Helvetica", 10)
    c.drawString(left_margin, y, f"Lugar: {lugar}")
    y -= 14
    c.drawString(left_margin, y, f"Fecha: {fecha_str}")
    y -= 14
    c.drawString(left_margin, y, f"Hora: {hora_str}")
    y -= 30

    # =========================
    # FIRMAS
    # =========================
    if y < bottom_margin + 120:
        c.showPage()
        y = top_margin

    linea_firma_ancho = 60 * mm

    # Firma del paciente (con imagen si existe)
    c.setFont("Helvetica", 10)
    firma_y = y

    if consentimiento.firma_paciente:
        try:
            # Dibuja la imagen de la firma justo encima de la línea
            img_path = consentimiento.firma_paciente.path
            img_height = 20 * mm
            img_width = 40 * mm
            c.drawImage(
                img_path,
                left_margin,
                firma_y + 5,
                width=img_width,
                height=img_height,
                preserveAspectRatio=True,
                mask="auto",
            )
        except Exception:
            # Si falla la carga de la imagen, simplemente mostramos la línea
            pass

    # Línea de firma del paciente
    c.line(left_margin, firma_y, left_margin + linea_firma_ancho, firma_y)
    c.drawString(left_margin, firma_y - 12, "Firma del paciente")

    # Firma del médico
    medico_x = left_margin + linea_firma_ancho + 40 * mm
    c.line(medico_x, firma_y, medico_x + linea_firma_ancho, firma_y)
    c.drawString(medico_x, firma_y - 12, "Firma del médico")

    y = firma_y - 40

    # Nota final
    c.setFont("Helvetica-Oblique", 8)
    nota = (
        "Este documento de consentimiento informado forma parte del expediente clínico "
        "del paciente y ha sido emitido electrónicamente."
    )
    _draw_wrapped_text(c, nota, left_margin, bottom_margin, max_width)

    # Cerrar PDF
    c.showPage()
    c.save()

    pdf = buffer.getvalue()
    buffer.close()
    return pdf
