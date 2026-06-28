/* ═══════════════════════════════════════════════════════
   MecaPsi v3.3 — data.js
   Capa de datos: API REST (FastAPI) + fallback local
   Reglas de Oro: DSS, privacidad, Neural Prism
═══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000/api';
let API_ONLINE = false;

/* ── API Layer ───────────────────────────────────────── */
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('mecapsi_token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    API_ONLINE = true;
    return await res.json();
  } catch (e) {
    API_ONLINE = false;
    return null;
  }
}

async function checkApiStatus() {
  const data = await apiCall('/');
  const dot = document.getElementById('api-status-dot');
  if (dot) {
    dot.className = `api-dot ${API_ONLINE ? 'online' : 'offline'}`;
    dot.title = API_ONLINE ? '✅ API conectada (localhost:8000)' : '⚠️ API offline — modo demo local';
  }
  return API_ONLINE;
}

async function apiLogin(username, password) {
  return await apiCall('/auth/login', 'POST', { username, password });
}

async function apiGetPacientes() {
  const data = await apiCall('/pacientes');
  return data || DB.pacientes;
}

async function apiGetNotas(pacienteId) {
  const data = await apiCall(`/notas/${pacienteId}`);
  return data || [];
}

async function apiPostNota(pacienteId, texto, tipo) {
  const data = await apiCall(`/notas/${pacienteId}`, 'POST', { texto, tipo });
  return data;
}

async function apiGetAgenda() {
  const data = await apiCall('/agenda');
  return data || DB.agenda;
}

async function apiPostCita(cita) {
  return await apiCall('/agenda', 'POST', cita);
}

async function apiGetTokens() {
  const data = await apiCall('/tokens');
  return data || { disponibles: DB.state.currentUser?.tokens_disponibles || 42, mes: 50, consumidos: 8 };
}

async function apiConsumeToken() {
  return await apiCall('/tokens/consume', 'POST');
}

async function apiGetAdminMetrics() {
  return await apiCall('/admin/metrics');
}

/* ── Base de Datos Local (fallback / mock) ────────────── */
const DB = {

  users: {
    dilan: {
      pass: '123', role: 'admin',
      name: 'Dilan Guerrero', initials: 'DG',
      org: 'MecaPsi Corp.', orgCode: 'MC', cargo: 'Administrador del Sistema',
      tokens_disponibles: 9999, tokens_mes: 9999
    },
    pepito: {
      pass: '123', role: 'psicologo',
      name: 'Dr. Pepito López', initials: 'PL',
      org: 'Clínica Los Andes', orgCode: 'CLA', cargo: 'Psicólogo Evaluador',
      plan: 'oro', planVence: '15 May, 2026', planDias: 21,
      tokens_disponibles: 42, tokens_mes: 50
    }
  },

  sedes: {
    principal: { label: 'Sede Principal — Cúcuta', orgs: 3, especialistas: 24, pruebas: 1432, ingresos: '$18,400', capacidad: 85, precision: 97.5 },
    norte:     { label: 'Sede Norte — Pamplona',    orgs: 1, especialistas: 8,  pruebas: 487,  ingresos: '$6,200',  capacidad: 51, precision: 96.8 },
    sur:       { label: 'Sede Sur — Villa del Rosario', orgs: 2, especialistas: 12, pruebas: 763, ingresos: '$9,750', capacidad: 67, precision: 97.1 }
  },

  pacientes: [
    { id: 'PAC-0041', name: 'Ramírez, C. A.', edad: 28, genero: 'M', esp: 'Dr. Pepito López', prueba: 'PLC v3', chip: 'dss-p0', chipLabel: 'Base Normativa',    conf: 98.5, fecha: 'Abr 17, 2026', estado: 'Activo',      trend: [82,88,91,95,97,98,98.5], notas: 'Rendimiento dentro del rango normativo. Latencia consistente.' },
    { id: 'PAC-0127', name: 'López, M. F.',   edad: 34, genero: 'F', esp: 'Dr. Pepito López', prueba: 'PLC v3', chip: 'dss-p2', chipLabel: 'Alta Reactividad',  conf: 91.2, fecha: 'Abr 16, 2026', estado: 'Activo',      trend: [70,74,78,82,87,90,91.2], notas: 'Variabilidad inter-ítem elevada. Sugiere seguimiento en velocidad de procesamiento.' },
    { id: 'PAC-0088', name: 'Hernández, J. L.', edad: 22, genero: 'M', esp: 'Dr. Pepito López', prueba: 'PLC v3', chip: 'dss-p6', chipLabel: 'Alta Eficiencia', conf: 99.1, fecha: 'Abr 15, 2026', estado: 'Activo',      trend: [94,96,97,98,99,99,99.1], notas: 'Perfil de alta eficiencia cognitiva. Latencias mínimas en todos los ítems.' },
    { id: 'PAC-0203', name: 'Torres, A. P.',  edad: 41, genero: 'F', esp: 'Dr. Pepito López', prueba: 'PLC v3', chip: 'dss-p3', chipLabel: 'Varianza Bilateral',conf: 83.7, fecha: 'Abr 14, 2026', estado: 'Seguimiento', trend: [60,65,71,74,80,82,83.7], notas: 'Asimetría hemisférica detectada. Se recomienda reevaluación en 30 días.' },
    { id: 'PAC-0019', name: 'Gómez, P. R.',   edad: 19, genero: 'M', esp: 'Dr. Pepito López', prueba: 'PLC v3', chip: 'dss-p1', chipLabel: 'Latencia Sostenida', conf: 74.3, fecha: 'Abr 13, 2026', estado: 'Prioritario', trend: [50,55,60,65,70,73,74.3], notas: 'Latencia consistentemente alta. Revisar condiciones de evaluación y re-aplicar.' }
  ],

  agenda: [
    { time: '09:00am', name: 'Ramírez, C. A.', tipo: 'PLC v3 — Evaluación',      color: 'var(--success)',        estado: 'Confirmada' },
    { time: '10:30am', name: 'López, M. F.',   tipo: 'PLC v3 + Entrevista',       color: 'var(--primary-vivid)', estado: 'Confirmada' },
    { time: '12:00pm', name: 'Vargas, S. T.',  tipo: 'Devolución resultados',     color: 'var(--warning)',       estado: 'Pendiente'  },
    { time: '02:00pm', name: 'Hernández, J. L.', tipo: 'Devolución PLC',          color: 'var(--purple)',        estado: 'Confirmada' },
    { time: '04:30pm', name: 'Torres, A. P.',  tipo: 'PLC v3 — Evaluación',       color: 'var(--orange)',        estado: 'Confirmada' }
  ],

  notificaciones: {
    admin: [
      { icon: '📄', msg: 'Nuevo reporte generado para PAC-0127', hora: 'Hace 5 min',   leido: false, id: 'n1' },
      { icon: '⚠️', msg: 'Dr. García — Plan Plata vence en 5 días',  hora: 'Hace 1h',    leido: false, id: 'n2' },
      { icon: '🥉', msg: 'IPS Norte solicitó upgrade a Plan Oro',   hora: 'Hace 3h',    leido: true,  id: 'n3' },
      { icon: '🤖', msg: 'Modelo MLP actualizado a v3.3',           hora: 'Hoy 08:00',  leido: true,  id: 'n4' },
      { icon: '📊', msg: 'Reporte ejecutivo mensual disponible',    hora: 'Ayer 18:30', leido: true,  id: 'n5' }
    ],
    psicologo: [
      { icon: '📄', msg: 'Reporte de Ramírez, C. A. listo',        hora: 'Hace 10 min', leido: false, id: 'n1' },
      { icon: '📅', msg: 'Cita con López, M. F. a las 10:30am',    hora: 'Hace 30 min', leido: false, id: 'n2' },
      { icon: '🪙', msg: 'Te quedan 42 tokens este mes',            hora: 'Hace 1h',     leido: false, id: 'n3' },
      { icon: '🧠', msg: 'IA procesó 3 evaluaciones nuevas',        hora: 'Hace 2h',     leido: true,  id: 'n4' }
    ]
  },

  clientes: [
    { id: 'ORG-001', nombre: 'Dr. Pepito López',  org: 'Clínica Los Andes',         plan: 'oro',    planLabel: 'Plan Oro',    monto: '$280.000/mes', montoCOP: 280000, estado: 'Al día',      vence: '15 May, 2026', diasRestantes: 21, evaluaciones: 92,  limiteEval: 'Ilimitadas', tokens: 42 },
    { id: 'ORG-002', nombre: 'Dra. Clara Ruiz',   org: 'Centro Neurológico Norte',  plan: 'plata',  planLabel: 'Plan Plata',  monto: '$150.000/mes', montoCOP: 150000, estado: 'Por vencer', vence: '22 Abr, 2026', diasRestantes: 5,  evaluaciones: 47,  limiteEval: '200/mes',   tokens: 18 },
    { id: 'ORG-003', nombre: 'Ps. Jorge Mena',    org: 'Consultorio Privado Cali',  plan: 'bronce', planLabel: 'Plan Bronce', monto: '$60.000/mes',  montoCOP: 60000,  estado: 'Vencido',    vence: '10 Abr, 2026', diasRestantes: -15, evaluaciones: 12, limiteEval: '50/mes',    tokens: 0  },
    { id: 'ORG-004', nombre: 'Dra. Ana Torres',   org: 'IPS Salud Mental Bogotá',   plan: 'plata',  planLabel: 'Plan Plata',  monto: '$150.000/mes', montoCOP: 150000, estado: 'Al día',      vence: '30 May, 2026', diasRestantes: 36, evaluaciones: 134, limiteEval: '200/mes',   tokens: 31 },
    { id: 'ORG-005', nombre: 'Ps. Mario Castro',  org: 'Clínica del Valle',         plan: 'bronce', planLabel: 'Plan Bronce', monto: '$60.000/mes',  montoCOP: 60000,  estado: 'Al día',      vence: '5 Jun, 2026',  diasRestantes: 42, evaluaciones: 28,  limiteEval: '50/mes',    tokens: 22 }
  ],

  planes: [
    { id: 'oro',    label: 'Plan Oro',    emoji: '🥇', color: '#f59e0b', bg: '#fef3c7', dark: '#78350f', precio: '$280.000/mes', tokens: 'Ilimitados', features: ['Evaluaciones ilimitadas','Todos los instrumentos (PLC, TMT, SDMT)','Reportes PDF automáticos','Soporte prioritario 24/7','API de integración','Acceso beta nuevas pruebas'] },
    { id: 'plata',  label: 'Plan Plata',  emoji: '🥈', color: '#64748b', bg: '#f1f5f9', dark: '#1e293b', precio: '$150.000/mes', tokens: '200/mes',    features: ['Hasta 200 tokens/mes','PLC v3 completo','Reportes PDF básicos','Soporte horario hábil','Dashboard clínico'] },
    { id: 'bronce', label: 'Plan Bronce', emoji: '🥉', color: '#92400e', bg: '#fff7ed', dark: '#451a03', precio: '$60.000/mes',  tokens: '50/mes',     features: ['Hasta 50 tokens/mes','PLC v3 (modo básico)','Reportes simplificados','Soporte por email'] }
  ],

  /* ── Catálogo de 20 Pruebas ──────────────────────── */
  catalogo: [
    // Software
    { id: 'plc',       nombre: 'PLC — Líneas Cruzadas',      tipo: 'software', icon: '🧠', desc: 'Evaluación de atención selectiva. Canvas HTML5, 32 variables biométricas, latencia ≈16ms. Modelo MLP v3 (97.5% precisión).', tiempo: '~12 min', estado: 'activo', flagship: true },
    { id: 'mmse',      nombre: 'Mini-Mental State (MMSE)',   tipo: 'software', icon: '🧩', desc: 'Tamizaje cognitivo global. Evalúa orientación, memoria, atención y lenguaje.', tiempo: '~10 min', estado: 'activo' },
    { id: 'phq9',      nombre: 'PHQ-9 — Depresión',          tipo: 'software', icon: '💙', desc: 'Cuestionario de salud del paciente. Escala validada de depresión de 9 ítems.', tiempo: '~5 min',  estado: 'activo' },
    { id: 'gad7',      nombre: 'GAD-7 — Ansiedad',           tipo: 'software', icon: '🌀', desc: 'Trastorno de ansiedad generalizada. 7 ítems, alta sensibilidad y especificidad.', tiempo: '~5 min', estado: 'activo' },
    { id: 'audit',     nombre: 'AUDIT — Alcohol',             tipo: 'software', icon: '🍶', desc: 'Identificación de trastornos por uso de alcohol. OMS validado.', tiempo: '~5 min', estado: 'activo' },
    { id: 'dast10',    nombre: 'DAST-10 — Sustancias',       tipo: 'software', icon: '⚗️', desc: 'Detección de abuso de sustancias. Versión corta de alta eficiencia.', tiempo: '~5 min', estado: 'activo' },
    { id: 'pcl5',      nombre: 'PCL-5 — PTSD',               tipo: 'software', icon: '🔷', desc: 'Lista de verificación del trastorno de estrés postraumático. DSM-5.', tiempo: '~8 min', estado: 'activo' },
    { id: 'bdi',       nombre: 'BDI-II — Inventario Beck',   tipo: 'software', icon: '📋', desc: 'Inventario de Depresión de Beck II. 21 ítems, ampliamente validado.', tiempo: '~10 min', estado: 'activo' },
    { id: 'stai',      nombre: 'STAI — Ansiedad Estado',     tipo: 'software', icon: '📊', desc: 'Inventario de Ansiedad Estado-Rasgo. Spielberger, adaptación colombiana.', tiempo: '~8 min', estado: 'activo' },
    { id: 'moca',      nombre: 'MoCA — Evaluación Cognitiva',tipo: 'software', icon: '🔬', desc: 'Montreal Cognitive Assessment. Detecta deterioro cognitivo leve.', tiempo: '~10 min', estado: 'activo' },
    { id: 'tmt',       nombre: 'TMT — Trail Making Test',    tipo: 'software', icon: '🛤️', desc: 'Velocidad de procesamiento y función ejecutiva. Partes A & B digitalizadas.', tiempo: '~8 min', estado: 'pronto' },
    { id: 'sdmt',      nombre: 'SDMT — Symbol Digit',        tipo: 'software', icon: '🔣', desc: 'Velocidad de procesamiento e información y memoria de trabajo.', tiempo: '~5 min', estado: 'pronto' },
    // Software + Hardware
    { id: 'eeg',       nombre: 'EEG Coherencia',             tipo: 'hardware', icon: '⚡', desc: 'Electroencefalografía vía ESP32. Análisis de ondas alfa/beta durante la evaluación cognitiva.', tiempo: '~15 min', estado: 'pronto', hw_req: 'ESP32 + electrodos' },
    { id: 'gsr',       nombre: 'GSR — Respuesta Galvánica',  tipo: 'hardware', icon: '💧', desc: 'Sensor de conductancia de piel. Mide arousal emocional durante PLC. MQTT en tiempo real.', tiempo: '~12 min', estado: 'pronto', hw_req: 'Sensor GSR + ESP32' },
    { id: 'hrv',       nombre: 'HRV — Variabilidad Cardíaca',tipo: 'hardware', icon: '❤️', desc: 'Variabilidad del ritmo cardíaco. Índice de regulación autonómica durante evaluación.', tiempo: '~15 min', estado: 'pronto', hw_req: 'Sensor PPG/ECG' },
    { id: 'pupil',     nombre: 'Pupilometría',               tipo: 'hardware', icon: '👁️', desc: 'Dilatación pupilar como biomarcador de carga cognitiva. Cámara + IR.', tiempo: '~10 min', estado: 'pronto', hw_req: 'Cámara IR + iluminación' },
    { id: 'tremor',    nombre: 'Tremor Assessment',          tipo: 'hardware', icon: '🫳', desc: 'Evaluación de temblor fino mediante acelerómetro. Indicador neuromotor.', tiempo: '~8 min', estado: 'pronto', hw_req: 'IMU ESP32' },
    { id: 'emg',       nombre: 'EMG — Fatiga Muscular',      tipo: 'hardware', icon: '💪', desc: 'Electromiografía de superficie. Mide fatiga muscular cognitiva-motora.', tiempo: '~12 min', estado: 'pronto', hw_req: 'Electrodos EMG' },
    { id: 'spo2',      nombre: 'SpO2 — Cognitivo',           tipo: 'hardware', icon: '🩺', desc: 'Saturación de oxígeno como marcador de performance cognitiva en altitud.', tiempo: '~10 min', estado: 'pronto', hw_req: 'Sensor SpO2' },
    { id: 'galvanic',  nombre: 'Galvanic Fear Response',     tipo: 'hardware', icon: '⚡', desc: 'Respuesta galvánica específica a estímulos de miedo. Protocolo VRET.', tiempo: '~20 min', estado: 'pronto', hw_req: 'Sensor GSR + VR headset' }
  ],

  state: {
    currentUser: null,
    currentSection: 'dashboard',
    currentSede: 'principal',
    brightMinds: false,
    tokensData: null
  }
};
