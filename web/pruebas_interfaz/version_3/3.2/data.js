/* ═══════════════════════════════════════════════════════
   MecaPsi v3.1 — data.js
   Fuente única de verdad (datos simulados)
   Reglas de Oro: DSS, lenguaje observacional, privacidad
═══════════════════════════════════════════════════════ */

const DB = {

  /* ── Usuarios autorizados ──────────────────────────── */
  users: {
    dilan: {
      pass: '123', role: 'admin',
      name: 'Dilan Guerrero', initials: 'DG',
      org: 'MecaPsi Corp.', orgCode: 'MC', cargo: 'Administrador del Sistema'
    },
    pepito: {
      pass: '123', role: 'psicologo',
      name: 'Dr. Pepito López', initials: 'PL',
      org: 'Clínica Los Andes', orgCode: 'CLA', cargo: 'Psicólogo Evaluador',
      plan: 'oro', planVence: '15 May, 2026', planDias: 27
    }
  },

  /* ── Sedes (Admin — selector funcional) ───────────── */
  sedes: {
    principal: {
      label: 'Sede Principal — Cúcuta',
      orgs: 3, especialistas: 24, pruebas: 1432,
      ingresos: '$18,400', capacidad: 85, precision: 97.5
    },
    norte: {
      label: 'Sede Norte — Pamplona',
      orgs: 1, especialistas: 8, pruebas: 487,
      ingresos: '$6,200', capacidad: 51, precision: 96.8
    },
    sur: {
      label: 'Sede Sur — Villa del Rosario',
      orgs: 2, especialistas: 12, pruebas: 763,
      ingresos: '$9,750', capacidad: 67, precision: 97.1
    }
  },

  /* ── Pacientes (Psicólogo ve nombres, Admin anonimiza) */
  pacientes: [
    {
      id: 'PAC-0041', name: 'Ramírez, C. A.', edad: 28, genero: 'M',
      esp: 'Dr. Pepito López', prueba: 'PLC v3',
      chip: 'dss-p0', chipLabel: 'Base Normativa', conf: 98.5,
      fecha: 'Abr 17, 2026', estado: 'Activo',
      trend: [82, 88, 91, 95, 97, 98, 98.5],
      notas: 'Rendimiento dentro del rango normativo. Latencia consistente.',
    },
    {
      id: 'PAC-0127', name: 'López, M. F.', edad: 34, genero: 'F',
      esp: 'Dr. Pepito López', prueba: 'PLC v3',
      chip: 'dss-p2', chipLabel: 'Alta Reactividad', conf: 91.2,
      fecha: 'Abr 16, 2026', estado: 'Activo',
      trend: [70, 74, 78, 82, 87, 90, 91.2],
      notas: 'Variabilidad inter-ítem elevada. Sugiere seguimiento en velocidad de procesamiento.',
    },
    {
      id: 'PAC-0088', name: 'Hernández, J. L.', edad: 22, genero: 'M',
      esp: 'Dr. Pepito López', prueba: 'PLC v3',
      chip: 'dss-p6', chipLabel: 'Alta Eficiencia', conf: 99.1,
      fecha: 'Abr 15, 2026', estado: 'Activo',
      trend: [94, 96, 97, 98, 99, 99, 99.1],
      notas: 'Perfil de alta eficiencia cognitiva. Latencias mínimas en todos los ítems.',
    },
    {
      id: 'PAC-0203', name: 'Torres, A. P.', edad: 41, genero: 'F',
      esp: 'Dr. Pepito López', prueba: 'PLC v3',
      chip: 'dss-p3', chipLabel: 'Varianza Bilateral', conf: 83.7,
      fecha: 'Abr 14, 2026', estado: 'Seguimiento',
      trend: [60, 65, 71, 74, 80, 82, 83.7],
      notas: 'Asimetría hemisférica detectada. Se recomienda reevaluación en 30 días.',
    },
    {
      id: 'PAC-0019', name: 'Gómez, P. R.', edad: 19, genero: 'M',
      esp: 'Dr. Pepito López', prueba: 'PLC v3',
      chip: 'dss-p1', chipLabel: 'Latencia Sostenida', conf: 74.3,
      fecha: 'Abr 13, 2026', estado: 'Prioritario',
      trend: [50, 55, 60, 65, 70, 73, 74.3],
      notas: 'Latencia consistentemente alta. Revisar condiciones de evaluación y re-aplicar.',
    }
  ],

  /* ── Agenda del día (Psicólogo) ───────────────────── */
  agenda: [
    { time: '09:00', name: 'Ramírez, C. A.', tipo: 'PLC v3 — Evaluación', color: 'var(--success)',        estado: 'Confirmada' },
    { time: '10:30', name: 'López, M. F.',    tipo: 'PLC v3 + Entrevista',  color: 'var(--primary-vivid)', estado: 'Confirmada' },
    { time: '12:00', name: 'Vargas, S. T.',   tipo: 'Devolución resultados', color: 'var(--warning)',       estado: 'Pendiente'  },
    { time: '14:00', name: 'Hernández, J. L.',tipo: 'Devolución PLC',        color: 'var(--purple)',        estado: 'Confirmada' },
    { time: '16:30', name: 'Torres, A. P.',   tipo: 'PLC v3 — Evaluación',  color: 'var(--orange)',        estado: 'Confirmada' },
  ],

  /* ── Notificaciones ────────────────────────────────── */
  notificaciones: {
    admin: [
      { icon: '📄', msg: 'Nuevo reporte generado para PAC-0127', hora: 'Hace 5 min',   leido: false, id: 'n1' },
      { icon: '⚠️', msg: 'Dr. García — Plan Plata vence en 5 días',  hora: 'Hace 1h',    leido: false, id: 'n2' },
      { icon: '🥉', msg: 'IPS Norte solicitó upgrade a Plan Oro',   hora: 'Hace 3h',    leido: true,  id: 'n3' },
      { icon: '🤖', msg: 'Modelo MLP actualizado a v3.1',           hora: 'Hoy 08:00',  leido: true,  id: 'n4' },
      { icon: '📊', msg: 'Reporte ejecutivo mensual disponible',    hora: 'Ayer 18:30', leido: true,  id: 'n5' },
    ],
    psicologo: [
      { icon: '📄', msg: 'Reporte de Ramírez, C. A. listo para descarga', hora: 'Hace 10 min', leido: false, id: 'n1' },
      { icon: '📅', msg: 'Recordatorio: Cita con López, M. F. a las 10:30', hora: 'Hace 30 min', leido: false, id: 'n2' },
      { icon: '🧠', msg: 'MecaPsi IA procesó 3 evaluaciones nuevas', hora: 'Hace 2h', leido: true, id: 'n3' },
      { icon: '📋', msg: 'Gómez, P. R. requiere reevaluación', hora: 'Ayer 17:00', leido: true, id: 'n4' },
    ]
  },

  /* ── Clientes/Suscripciones (Admin) ───────────────── */
  clientes: [
    {
      id: 'ORG-001', nombre: 'Dr. Pepito López', org: 'Clínica Los Andes',
      plan: 'oro', planLabel: 'Plan Oro',
      monto: '$280.000/mes', montoCOP: 280000,
      estado: 'Al día', vence: '15 May, 2026', diasRestantes: 27,
      evaluaciones: 92, limiteEval: 'Ilimitadas',
      pruebas: ['PLC v3', 'TMT', 'SDMT'], acceso: 'Completo',
      pagos: [
        { mes: 'Mar 2026', monto: '$280.000', estado: 'Pagado' },
        { mes: 'Feb 2026', monto: '$280.000', estado: 'Pagado' },
        { mes: 'Ene 2026', monto: '$280.000', estado: 'Pagado' },
      ]
    },
    {
      id: 'ORG-002', nombre: 'Dra. Clara Ruiz', org: 'Centro Neurológico Norte',
      plan: 'plata', planLabel: 'Plan Plata',
      monto: '$150.000/mes', montoCOP: 150000,
      estado: 'Por vencer', vence: '22 Abr, 2026', diasRestantes: 5,
      evaluaciones: 47, limiteEval: '200/mes',
      pruebas: ['PLC v3'], acceso: 'Estándar',
      pagos: [
        { mes: 'Mar 2026', monto: '$150.000', estado: 'Pagado' },
        { mes: 'Feb 2026', monto: '$150.000', estado: 'Pagado' },
        { mes: 'Ene 2026', monto: '$150.000', estado: 'Pagado' },
      ]
    },
    {
      id: 'ORG-003', nombre: 'Ps. Jorge Mena', org: 'Consultorio Privado Cali',
      plan: 'bronce', planLabel: 'Plan Bronce',
      monto: '$60.000/mes', montoCOP: 60000,
      estado: 'Vencido', vence: '10 Abr, 2026', diasRestantes: -8,
      evaluaciones: 12, limiteEval: '50/mes',
      pruebas: ['PLC v3 (básico)'], acceso: 'Limitado',
      pagos: [
        { mes: 'Feb 2026', monto: '$60.000', estado: 'Pagado' },
        { mes: 'Mar 2026', monto: '$60.000', estado: 'Pendiente' },
        { mes: 'Abr 2026', monto: '$60.000', estado: 'Moroso' },
      ]
    },
    {
      id: 'ORG-004', nombre: 'Dra. Ana Torres', org: 'IPS Salud Mental Bogotá',
      plan: 'plata', planLabel: 'Plan Plata',
      monto: '$150.000/mes', montoCOP: 150000,
      estado: 'Al día', vence: '30 May, 2026', diasRestantes: 42,
      evaluaciones: 134, limiteEval: '200/mes',
      pruebas: ['PLC v3'], acceso: 'Estándar',
      pagos: [
        { mes: 'Mar 2026', monto: '$150.000', estado: 'Pagado' },
        { mes: 'Feb 2026', monto: '$150.000', estado: 'Pagado' },
        { mes: 'Ene 2026', monto: '$150.000', estado: 'Pagado' },
      ]
    },
    {
      id: 'ORG-005', nombre: 'Ps. Mario Castro', org: 'Clínica del Valle',
      plan: 'bronce', planLabel: 'Plan Bronce',
      monto: '$60.000/mes', montoCOP: 60000,
      estado: 'Al día', vence: '5 Jun, 2026', diasRestantes: 48,
      evaluaciones: 28, limiteEval: '50/mes',
      pruebas: ['PLC v3 (básico)'], acceso: 'Limitado',
      pagos: [
        { mes: 'Mar 2026', monto: '$60.000', estado: 'Pagado' },
        { mes: 'Feb 2026', monto: '$60.000', estado: 'Pagado' },
        { mes: 'Ene 2026', monto: '$60.000', estado: 'Pagado' },
      ]
    },
  ],

  /* ── Planes MecaPsi ────────────────────────────────── */
  planes: [
    {
      id: 'oro', label: 'Plan Oro', emoji: '🥇', color: '#f59e0b', bg: '#fef3c7', dark: '#78350f',
      precio: '$280.000/mes', descripcion: 'Acceso completo a todo el ecosistema.',
      features: ['Evaluaciones ilimitadas', 'Todos los instrumentos (PLC, TMT, SDMT)', 'Reportes PDF automáticos', 'Soporte prioritario 24/7', 'API de integración', 'Acceso beta nuevas pruebas'],
      limiteEval: 'Ilimitadas', acceso: 'Completo'
    },
    {
      id: 'plata', label: 'Plan Plata', emoji: '🥈', color: '#64748b', bg: '#f1f5f9', dark: '#1e293b',
      precio: '$150.000/mes', descripcion: 'Acceso estándar. Ideal para consultorios medianos.',
      features: ['Hasta 200 evaluaciones/mes', 'PLC v3 completo', 'Reportes PDF básicos', 'Soporte horario hábil', 'Dashboard clínico'],
      limiteEval: '200/mes', acceso: 'Estándar'
    },
    {
      id: 'bronce', label: 'Plan Bronce', emoji: '🥉', color: '#92400e', bg: '#fff7ed', dark: '#451a03',
      precio: '$60.000/mes', descripcion: 'Acceso inicial. Perfecto para consultorios pequeños.',
      features: ['Hasta 50 evaluaciones/mes', 'PLC v3 (modo básico)', 'Reportes simplificados', 'Soporte por email'],
      limiteEval: '50/mes', acceso: 'Limitado'
    }
  ],

  /* ── Estado global de la App ─────────────────────── */
  state: {
    currentUser: null,
    currentSection: 'dashboard',
    currentSede: 'principal',
    notificacionesLeidas: new Set()
  }
};
