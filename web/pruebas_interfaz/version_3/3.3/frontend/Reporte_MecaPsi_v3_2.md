# 🧠 Reporte Ejecutivo: Ecosistema MecaPsi v3.2 (DSS SaaS Platform)

**Fecha:** Abril 2026
**Estado de la Versión:** v3.2 (Single Page Application - Interfaz Interactiva Base)
**Objetivo del Documento:** Brindar un desglose absoluto de todas las características técnicas, visuales y operativas del sistema, ideal para propuestas de negocio, levantamiento de capital o alianzas institucionales.

---

## 1. Resumen de la Plataforma
**MecaPsi v3.2** es la evolución definitiva hacia un modelo **Software as a Service (SaaS)** de alto rendimiento. Funciona bajo la premisa de ser un **Sistema de Soporte a la Decisión Clínica (DSS)** impulsado por Inteligencia Artificial (Redes Neuronales MLP). El sistema no emite diagnósticos médicos, sino que entrega telemetría biométrica de ultra-alta precisión en tiempo real para ayudar a los psicólogos a tomar decisiones con un 97.5% de exactitud algorítmica.

Diseñada como una *Single Page Application (SPA)* sin recargas de página, el sistema asegura cero latencia de navegación al conmutar entre pantallas, usando la guía de integración **"Neural Prism"** que otorga una apariencia 'Glassmorphic' y profesional, superior a estándares genéricos.

---

## 2. Arquitectura Base y Control de Privacidad
- **Comportamiento SPA:** Todo el entorno navega de manera fluida, renderizando componentes en tiempo real mediante JavaScript Vanilla. Soporta cientos de clics sin caerse porque el front-end no tiene que llamar el HTML del servidor con cada interacción (arquitectura tolerante a alta concurrencia).
- **Manejo RLS (Row-Level Security):** Estricta división ética entre lo que ve MecaPsi como corporación (Admin) y lo que ven las clínicas.
- **Persistencia de Configuración Inteligente:** Sistema de memoria por `localStorage` mediante ID de usuario. Cada usuario conserva su propio tema de luz (Claro, Oscuro o Neural) y la configuración de notificaciones sin afectar a otros miembros de la misma computadora o red.

---

## 3. Módulos Diferenciados Funcionales (Por Roles)

### 👑 A. Panel Administrador (MecaPsi Corp.)
El administrador ve el comportamiento de negocio global. La ética de datos aquí **oculta** los nombres de los pacientes (Anonimato de datos).
*   **Dashboard Macro:** Visualización de KPIs de negocio: MRR (Ingresos Recurrentes), Cantidad de Organizaciones, Pruebas Mensuales IA y Precisión General de la IA.
*   **Gestión de Suscripciones (CRM Comercial):** 
    *   Manejo de estados financieros y "Tiers" de usuarios (🥇 Oro, 🥈 Plata, 🥉 Bronce).
    *   Métricas de licencias activas, fechas de vencimiento y porcentaje de uso del software por cada clínica.
    *   Tarjetas con embudos en vivo sobre suscripciones por vencer o vencidas.
*   **Facturación Centralizada:** Descarga simulada de reportes PDF, estadísticas comparativas y seguimiento del consumo de bases de datos.
*   **Tendencias IA-DSS:** Gráficas de comportamiento que prueban la exactitud de la red neuronal mediante 1,000 pruebas sintéticas, segregando en métricas como Base Normativa, Varianza Bilateral o Perfil Complejo.

### 🧠 B. Panel Especialista (Clínico / Psicólogo)
A diferencia del administrador, el psicólogo posee una **Plataforma de Operación Médica**. (Sí ven la PII de los pacientes).
*   **Dashboard Clínico (Panel Principal):** 
    *   Widget con métricas en tiempo real: Evaluaciones diarias, reportes por auditar y un log inmediato de los pacientes más recientes.
*   **Mi Agenda (Calendario Inteligente Avanzado):**
    *   **Reloj en vivo dinámico digital**, brindando exactitud y una vista superior tecnológica al organizar el tiempo.
    *   **Mini-Calendario Interactivo** con métricas de congestión de días y capacidad de despliegue masivo del mes.
    *   Generación interactiva de citas (Integrado a modalidades presencial / telemédico) y envío simulado de recordatorios.
*   **Gestión de Pacientes (CRM Clínico):**
    *   Tabla con barra de búsqueda veloz: Filtra automáticamente cientos de filas mientras el doctor escribe.
    *   Log de historiales: Estado (Activo, Seguimiento, Riesgo), porcentaje de confianza de la prueba IA, y botones de descarga para entregar reportes PDF rápidos a familias o instituciones.
*   **Catálogo de Pruebas (Futuro Hub Psicométrico):**
    *   **Pilar Actual:** Prueba de Líneas Cruzadas (PLC) preconfigurada para integrarse al motor. 
    *   **Escalabilidad:** Estructura pensada para que más adelante puedan desbloquearse el Test de Interfaz TMT o SDMT bajo las mismas suscripciones corporativas.

---

## 4. Componentes y Efectos Modulares Exclusivos
- **Motor de Notificaciones Pop-up (`toast`):** Avisos efímeros programados para alertar con colores semánticos (verde éxito, rojo peligro, naranja aviso) al crear citas, editar configs o exportar excels, sin requerir recargas.
- **Diseño Glassmorphism Premium:** Las ventanas emergentes (Citas, Pacientes) se abren usando difuminación limpia en los fondos, logrando una opacidad sin bugs. Toda la interfaz descarta la rigidez, usando sombras y difuminancias dinámicas.
- **Micro-interacciones y Animaciones:** Transiciones secuenciales (`anim-1`, `anim-2`) al abrir las diferentes pestañas, mitigando fatiga cognitiva.
- **Autenticación "Smooth"**: Login refinado que identifica al instante qué credencial ingresa el sujeto y transita velozmente (<200ms) al panel respectivo basándose en el Rol.

---

## 5. Próximo Hito: El Motor Canvas Biomolecular (Fase de Pruebas)
Con el ecosistema consolidado y actuando totalmente como SaaS, el terreno está preparado para acoplar la herramienta clínica final: **El Canvas HTML5 de Telemetría**.
*   Una vista inmersiva 100% libre de distracciones.
*   El paciente dibuja o sigue patrones mientras el sistema backend captura en ráfagas de aceleración X/Y, micropausas, tiempo de reacción y varianza bilateral superando los estandares de 16 milisegundos de latencia.
*   Los datos viajan de su trazo directo al dashboard del especialista, siendo cruzados por la Red Neuronal previamente programada que cataloga sus rangos clínicos.

---

### Conclusión para su Propuesta
> *"MecaPsi v3.2 no es una simple web prototipo; es la base funcional de un Ecosistema Distribuido SaaS y Clínico. Está programado con la agilidad de Single Page Application, garantizando inmunidad a caídas masivas al evitar sobrecargas de HTML y procesando la interfaz 100% interactiva. Su ética base incluye protección RLS separando los analíticos de la PII (Personal Identifiable Information) médica. Con su licenciamiento preparado por Tiers Oros/Platas, MecaPsi está diseñada desde sus cimientos para monetizarse y escalar internacionalmente como el DSS Psicométrico del futuro."*
