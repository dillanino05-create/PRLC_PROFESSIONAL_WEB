import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Frame, PageTemplate
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class TwoColumnDocTemplate(SimpleDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        self.addPageTemplates([
            PageTemplate(id='OneCol', frames=[Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='normal')]),
            PageTemplate(id='TwoCol', frames=[
                Frame(self.leftMargin, self.bottomMargin, self.width/2 - 6, self.height, id='col1'),
                Frame(self.leftMargin + self.width/2 + 6, self.bottomMargin, self.width/2 - 6, self.height, id='col2')
            ])
        ])

def generate_report():
    doc = TwoColumnDocTemplate("Informe_Avance_PLC_Final.pdf", pagesize=LETTER)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'JournalTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        alignment=1, # Center
        spaceAfter=12
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        fontSize=8,
        leading=10,
        alignment=0 # Left
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        fontSize=9,
        leading=11,
        alignment=4, # Justify
        spaceAfter=6
    )

    heading_style = ParagraphStyle(
        'HeadingStyle',
        fontSize=11,
        leading=13,
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=6
    )

    authors_style = ParagraphStyle(
        'AuthorsStyle',
        fontSize=10,
        leading=12,
        alignment=1,
        spaceAfter=10
    )

    affil_style = ParagraphStyle(
        'AffilStyle',
        fontSize=8,
        leading=10,
        alignment=0,
        leftIndent=20
    )

    story = []

    # 1. Header (Journal Info)
    story.append(Paragraph("ISSN: 1692-7257 - Vol. X - No. XX - 20XX", header_style))
    story.append(Paragraph("<b>Revista Colombiana de Tecnologías de Avanzada</b>", header_style))
    story.append(Spacer(1, 0.3 * inch))

    # 2. Title
    story.append(Paragraph("DESARROLLO DE UN SISTEMA DE EVALUACIÓN NEUROPSICOLÓGICA AUTOMATIZADO CON CLASIFICACIÓN PREDICTIVA: INTEGRACIÓN MECATRÓNICA-CLÍNICA", title_style))
    
    # 3. Authors
    story.append(Paragraph("Dilan Alejandro Lamus Pabón<sup>1</sup>, Ximena Alexandra Mora Navarro<sup>2</sup>, Andrea Daniela Victoria Vivas<sup>2</sup>, PhD. Edgar Alexis Diaz-Camargo<sup>2</sup>", authors_style))
    
    # 4. Affiliations
    story.append(Paragraph("<sup>1</sup> Universidad de Pamplona, Facultad de Ingenierías y Arquitecturas, Programa de Ingeniería Mecatrónica.", affil_style))
    story.append(Paragraph("<sup>2</sup> Universidad Simón Bolívar, Facultad de Ciencias Jurídicas y Sociales, Programa de Psicología.", affil_style))
    story.append(Spacer(1, 0.2 * inch))

    # 5. Abstract
    story.append(Paragraph("<b>Resumen:</b> PLC Professional es una plataforma SaaS diseñada para optimizar la aplicación y corrección del test D2. Utiliza una arquitectura desacoplada con FastAPI, Supabase y una red neuronal MLP que clasifica perfiles cognitivos con un 97.5% de precisión. El sistema busca reducir el error humano y la fatiga en la corrección manual, proveyendo métricas objetivas bajo el modelo atencional de Sohlberg y Mateer.", body_style))
    story.append(Paragraph("<b>Palabras Clave:</b> Neuropsicología, Mecatrónica, MLP, Sistemas de Adquisición de Datos, SaaS.", body_style))
    story.append(Spacer(1, 0.3 * inch))

    # Switch to Two Columns
    story.append(NextPageTemplate('TwoCol'))

    # 6. Introduction
    story.append(Paragraph("1. INTRODUCCIÓN", heading_style))
    story.append(Paragraph("La evaluación neuropsicológica tradicional, específicamente el test D2 de Brickenkamp, presenta desafíos significativos en cuanto a la precisión cronométrica y la carga operativa del examinador. Este proyecto, denominado PLC Professional, surge de la colaboración interdisciplinaria entre el programa de Mecatrónica de la Universidad de Pamplona y el programa de Psicología de la Universidad Simón Bolívar. El objetivo es digitalizar este proceso mediante ingeniería de software avanzada y clasificación por inteligencia artificial.", body_style))

    # 7. Desarrollo Técnico (Mecatrónica)
    story.append(Paragraph("2. INGENIERÍA MECATRÓNICA Y ADQUISICIÓN", heading_style))
    story.append(Paragraph("El sistema se diseñó como un dispositivo de adquisición de señales comportamentales de alta fidelidad. Utilizando el API de Canvas de HTML5, se capturan interacciones con latencia en milisegundos (ms). La arquitectura del backend, desarrollada en FastAPI y alojada en Hugging Face, implementa un manejador de procesos asíncronos con colas FIFO (First-In, First-Out). Esta gestión de procesos asegura que el servidor de recursos limitados pueda procesar evaluaciones secuencialmente sin bloqueos ni fugas de memoria (RAM), utilizando recolección de basura (GC) explícita tras cada operación pesada.", body_style))

    # 8. Modelo de Inteligencia Artificial
    story.append(Paragraph("3. MODELO PREDICTIVO MLP", heading_style))
    story.append(Paragraph("El núcleo analítico es una red neuronal de tipo Multilayer Perceptron (MLP) programada en Keras/TensorFlow. El modelo recibe un vector de 32 descriptores biométricos (edad, aciertos, omisiones, comisiones, TRM, varianza temporal, etc.). La arquitectura incluye capas densas con activación ReLU y una capa de salida Softmax para clasificar 8 perfiles de rendimiento clínico. Con una precisión probada del 97.5% sobre 15,000 muestras sintéticas y reales, el sistema provee una base descriptiva neutra que asiste al profesional en su dictamen final.", body_style))

    # 9. Perspectiva Psicológica
    story.append(Paragraph("4. FUNDAMENTACIÓN NEUROPSICOLÓGICA", heading_style))
    story.append(Paragraph("Bajo el modelo de Sohlberg y Mateer, el software analiza las redes atencionales selectiva y sostenida. Se ha implementado una lógica de despatologización, donde las etiquetas interpretativas subjetivas (como 'impulsivo') han sido sustituidas por descripciones físicas de rendimiento (ej. 'Comisión predominante'). Esto garantiza que la herramienta sea un soporte clínico objetivo y respete la autonomía del profesional en la Universidad Simón Bolívar.", body_style))

    # 10. Resultados y Dashboard
    story.append(Paragraph("5. RESULTADOS Y VISUALIZACIÓN", heading_style))
    story.append(Paragraph("Se ha desarrollado un dashboard interactivo con visualización de semáforos normativos (Rojo/Amarillo/Verde) basados en percentiles poblacionales. El sistema permite la visualización instantánea de curvas de fatiga y la exportación de reportes profesionales en Excel y PDF, reduciendo el tiempo de corrección en un 95% respecto a los métodos manuales.", body_style))

    # 11. Conclusiones
    story.append(Paragraph("6. CONCLUSIONES", heading_style))
    story.append(Paragraph("La integración de la mecánica de software y la psicología clínica permite una evaluación más precisa y eficiente. Se ha logrado un sistema escalable y seguro bajo estándares RLS de Supabase. La participación de los tutores, el Ing. Jeisson Martínez y el Prof. Jair Araujo (Unipamplona), junto al PhD. Edgar Alexis Diaz-Camargo (Unisimón), ha sido vital para el éxito del semillero.", body_style))

    # 12. Referencias
    story.append(Paragraph("7. REFERENCIAS", heading_style))
    story.append(Paragraph("- Brickenkamp, R. (2002). d2, Test de Atención. TEA Ediciones.", body_style))
    story.append(Paragraph("- Sohlberg, M. M., & Mateer, C. A. (1987). Attention training program. J. Clin. Exp. Neuropsychol.", body_style))
    story.append(Paragraph("- Chollet, F. (2021). Deep Learning with Python. Manning.", body_style))

    doc.build(story)
    print("✅ Informe generado: Informe_Avance_PLC_Final.pdf")

if __name__ == "__main__":
    # Workaround for NextPageTemplate issue in simple build
    # We will use a more standard build for simplicity first
    from reportlab.platypus import NextPageTemplate
    generate_report()
