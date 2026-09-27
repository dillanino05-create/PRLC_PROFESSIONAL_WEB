---
title: Plc Backend
emoji: 🦀
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: openrail
---

# MecaPsi: Sistema de Soporte a las Decisiones Clínicas (CDSS)
### Análisis de Biomarcadores Digitales mediante Redes Neuronales

MecaPsi es un proyecto de investigación tecnológica desarrollado en el semillero **ROBOLAB** (Universidad de Pamplona, Sede Villa del Rosario) enfocado en la digitalización y captura de alta resolución temporal en pruebas neuropsicológicas de atención y memoria de trabajo.

---

## Resumen del Proyecto

Tradicionalmente, la evaluación de funciones cognitivas como la atención sostenida o la memoria visoespacial se realiza mediante instrumentos analógicos en papel y lápiz (como el Test d2) o materiales físicos (como los Bloques de Corsi). Si bien estas herramientas son ampliamente conocidas y utilizadas, la calificación manual presenta limitaciones evidentes:

- Dificultad para registrar tiempos de respuesta y latencias en milisegundos.
- Imposibilidad de observar la variabilidad rítmica o la fatiga progresiva durante la prueba.
- Demora en la tabulación y conteo manual de aciertos y errores.

MecaPsi traslada estas dinámicas a un entorno web estructurado que registra de forma continua los eventos de interacción (tiempos por estímulo, desplazamientos del cursor y selección), permitiendo obtener un perfil objetivo del desempeño del evaluado en tiempo real.

---

## Pruebas Implementadas

1. **Prueba de Líneas Cruzadas (PLC):**
   - Basada en el paradigma de cancelación visual continua (Test d2).
   - Consta de 14 líneas de estímulos sucesivos con una ventana temporal fija de 20 segundos por línea.
   - Evalúa la velocidad de procesamiento, la atención selectiva y la concentración.

2. **Batería de Bloques de Corsi:**
   - Orientada a la evaluación de la memoria de trabajo visoespacial.
   - Presenta secuencias de bloques iluminados con intervalos estandarizados de 1 segundo.
   - Incluye modalidad directa (retención y reproducción pasiva) e inversa (manipulación ejecutiva en memoria de trabajo).

---

## ¿Cómo Funciona el Sistema?

A nivel general, el funcionamiento de MecaPsi se organiza en tres fases principales:

1. **Administración e Interacción:** El evaluado realiza las pruebas desde un navegador web. El sistema registra las marcas de tiempo exactas de cada acción y los movimientos del cursor de forma fluida y transparente.
2. **Análisis y Clasificación Descriptiva:** Los datos recopilados son procesados por un modelo de red neuronal (Perceptrón Multicapa) entrenado para identificar patrones de respuesta conductual, ayudando a contextualizar el ritmo del usuario y evitando penalizaciones injustas causadas por la lentitud propia del uso del ratón frente al lápiz tradicional.
3. **Consolidación de Resultados:** La plataforma genera automáticamente un reporte con el resumen de la prueba, las métricas clave y las curvas de fatiga, facilitando el análisis por parte del evaluador sin necesidad de conteos manuales.

---

## Resultados Preliminares

El prototipo ha sido probado de forma experimental en una muestra preliminar de **92 evaluaciones en 71 personas** (estudiantes universitarios y adultos sanos), observándose:

- **Memoria Visoespacial:** Los puntajes en la prueba de Corsi presentaron una distribución acorde a los baremos normativos tradicionales de referencia para población adulta.
- **Atención y Cancelación:** El análisis de patrones permitió identificar un desempeño funcional y saludable en la gran mayoría de los evaluados, compensando las diferencias temporales naturales entre hacer clic y tachar en papel.
- **Eficiencia Operativa:** Automatización inmediata en la generación de resúmenes de rendimiento y reportes de sesión.

---

## Consideraciones Éticas y Alcance

- **Herramienta de Asistencia (CDSS):** MecaPsi es un sistema de soporte a la decisión clínica. Su propósito es brindar información cuantitativa descriptiva al profesional; **no emite diagnósticos médicos ni psicológicos automatizados**.
- **Investigación en Curso:** El proyecto se encuentra en etapa de desarrollo y pruebas técnicas preliminares. La validación clínica formal junto a especialistas en neuropsicología y la aplicación en pacientes diagnosticados constituye la fase futura del trabajo.
- **Protección de Datos:** Toda la información recopilada en las pruebas experimentales es anónima y agregada, orientada con fines estrictamente académicos y de investigación.

---

## Autores e Información Institucional

* **Institución:** Universidad de Pamplona (Sede Villa del Rosario, Norte de Santander, Colombia)
* **Facultad:** Ingenierías y Arquitecturas
* **Programa:** Ingeniería Mecatrónica
* **Semillero de Investigación:** ROBOLAB

### Investigadores
* **Dilan Alejandro Lamus Pabón** (Ponente e Investigador Principal)
* **Ximena Alexandra Mora Navarro** (Coautora)
* **Andrea Daniela Victoria Vivas** (Coautora)

### Tutores de Investigación
* **MsC(c). Jeisson Harvey Martínez Flórez**
* **PhD. Edgar Alexis Díaz Camargo**
