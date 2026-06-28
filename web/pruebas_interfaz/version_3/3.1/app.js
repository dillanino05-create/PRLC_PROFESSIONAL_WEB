/* ═══════════════════════════════════════════════════════
   MecaPsi v3.1 — app.js
   Motor SPA: Auth, Router, Modales, Dropdowns, Sede
   Reglas de Oro: DSS, privacidad, Neural Prism
═══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────
   CONSTANTES DE SECCIÓN
──────────────────────────────────────── */
const SECTIONS = {
  admin: ['dashboard','catalogo','facturacion','tendencias','config'],
  psicologo: ['dashboard','agenda','nueva-eval','catalogo','pacientes','tendencias','config']
};

/* ────────────────────────────────────────
   1. LOGIN / AUTH
──────────────────────────────────────── */
document.getElementById('btn-login').addEventListener('click', doLogin);
['inp-user','inp-pass'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (id === 'inp-user') document.getElementById('inp-pass').focus();
      else doLogin();
    }
  });
});

function doLogin() {
  const user  = document.getElementById('inp-user').value.trim().toLowerCase();
  const pass  = document.getElementById('inp-pass').value.trim();
  const errEl = document.getElementById('login-error');
  const btnEl = document.getElementById('btn-login');

  if (DB.users[user] && DB.users[user].pass === pass) {
    errEl.style.display = 'none';
    DB.state.currentUser = { ...DB.users[user], username: user };
    btnEl.textContent = '✅ Autenticando...';
    btnEl.disabled = true;
    setTimeout(launchApp, 700);
  } else {
    errEl.style.display = 'block';
    document.getElementById('inp-pass').value = '';
    document.getElementById('inp-pass').focus();
  }
}

function doLogout() {
  DB.state.currentUser = null;
  DB.state.currentSection = 'dashboard';
  DB.state.currentSede    = 'principal';
  document.getElementById('app').classList.remove('visible');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('btn-login').textContent = 'Ingresar al Ecosistema →';
  document.getElementById('btn-login').disabled   = false;
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  closeAllDropdowns();
}

/* ────────────────────────────────────────
   2. LAUNCH APP
──────────────────────────────────────── */
function launchApp() {
  const u       = DB.state.currentUser;
  const isAdmin = u.role === 'admin';

  /* Banner de rol */
  document.getElementById('role-banner').className = `role-banner ${u.role}`;

  /* Sidebar */
  const badge = document.getElementById('sb-role-badge');
  badge.textContent = isAdmin ? 'Admin' : 'Psicólogo';
  badge.className   = `sb-logo-badge ${isAdmin ? 'badge-admin' : 'badge-psicologo'}`;

  document.getElementById('sb-org-av').className   = `sb-org-av ${u.role}`;
  document.getElementById('sb-org-av').textContent  = u.orgCode;
  document.getElementById('sb-org-name').textContent = u.org;
  document.getElementById('sb-org-role').textContent = isAdmin ? 'Organización Matriz' : 'Sede Principal';

  /* Topbar */
  document.getElementById('tb-org').textContent = u.org;
  updateSedeBtn();

  const tbAv = document.getElementById('tb-av');
  tbAv.className   = `topbar-av ${u.role}`;
  tbAv.textContent = u.initials;

  /* Sidebar bajo del usuario */
  document.getElementById('sb-user-av').className    = `user-av ${u.role}`;
  document.getElementById('sb-user-av').textContent   = u.initials;
  document.getElementById('sb-user-name').textContent = u.name;
  document.getElementById('sb-user-role-lbl').textContent = u.cargo;

  /* Notif badge (non-leídas) */
  const unread = (DB.notificaciones[u.role] || []).filter(n => !n.leido).length;
  document.getElementById('notif-badge-dot').style.display = unread > 0 ? 'block' : 'none';

  /* Construir nav */
  buildNav(isAdmin);

  /* Mostrar app */
  document.getElementById('login-overlay').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  setTimeout(() => app.classList.add('visible'), 10);

  /* Sede selector: solo admin ve dropdown */
  document.getElementById('sede-wrapper').style.display = isAdmin ? 'block' : 'none';

  /* Navegar a dashboard */
  navigateTo('dashboard');
}

/* ────────────────────────────────────────
   3. NAVEGACIÓN SPA
──────────────────────────────────────── */
function navigateTo(section) {
  const u       = DB.state.currentUser;
  const isAdmin = u.role === 'admin';
  DB.state.currentSection = section;

  /* Breadcrumb */
  const labels = {
    dashboard:      isAdmin ? 'Dashboard Administrador' : 'Dashboard Clínico',
    pacientes:      'Mis Pacientes', agenda: 'Mi Agenda',
    'nueva-eval':   'Nueva Evaluación PLC', catalogo: 'Catálogo de Pruebas',
    suscripciones:  isAdmin ? 'Gestión de Suscripciones' : 'Facturación & Plan',
    tendencias:     'Tendencias IA-DSS',
    config:         'Configuración', reportes: 'Reportes', equipo: 'Gestión de Equipo',
    'mi-plan':      'Mi Plan'
  };
  document.getElementById('tb-page').textContent = labels[section] || section;

  /* Active nav */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  /* Fade workspace */
  const ws = document.getElementById('workspace');
  ws.classList.add('fading');

  setTimeout(() => {
    let html = '';
    switch (section) {
      case 'dashboard':       html = isAdmin ? buildAdminDashboard() : buildPsicologoDashboard(); break;
      case 'pacientes':       html = buildPacientes();              break;
      case 'agenda':          html = buildAgenda();                 break;
      case 'catalogo':        html = buildCatalogo(isAdmin);        break;
      case 'suscripciones':   html = isAdmin ? buildSuscripciones() : buildMiPlan(); break;
      case 'mi-plan':         html = buildMiPlan();                 break;
      case 'tendencias':      html = buildTendencias(isAdmin);      break;
      case 'nueva-eval':      openModalNuevaEval(); html = isAdmin ? buildAdminDashboard() : buildPsicologoDashboard(); break;
      case 'config':          html = buildComingSoon('Configuración & Perfil', '⚙️'); break;
      case 'reportes':        html = buildComingSoon('Reportes', '📁');  break;
      case 'equipo':          html = buildComingSoon('Gestión de Equipo', '👥'); break;
      default:                html = buildComingSoon(section, '🚧');
    }
    ws.innerHTML = html;
    ws.classList.remove('fading');
    attachSectionListeners(section, isAdmin);
  }, 140);

  closeAllDropdowns();
}

/* ────────────────────────────────────────
   4. SIDEBAR NAV BUILDER
──────────────────────────────────────── */
function buildNav(isAdmin) {
  const nav = document.getElementById('sidebar-nav');
  if (isAdmin) {
    nav.innerHTML = `
      <span class="sb-section">Principal</span>
      <button class="nav-item" data-section="dashboard"><span class="nav-icon">📊</span>Dashboard<span class="nav-badge">!</span></button>
      <span class="sb-section">Organización</span>
      <button class="nav-item" data-section="equipo"><span class="nav-icon">👥</span>Gestión de Equipo<span class="nav-badge">8</span></button>
      <span class="sb-section">Clínica</span>
      <button class="nav-item" data-section="catalogo"><span class="nav-icon">🧪</span>Catálogo de Pruebas<span class="nav-badge">4</span></button>
      <button class="nav-sub active-sub">PLC — Líneas Cruzadas</button>
      <button class="nav-item" data-section="reportes"><span class="nav-icon">📁</span>Reportes<span class="nav-badge">3</span></button>
      <span class="sb-section">Analytics</span>
      <button class="nav-item" data-section="tendencias"><span class="nav-icon">📈</span>Tendencias IA-DSS</button>
      <span class="sb-section">Administración</span>
      <button class="nav-item" data-section="suscripciones"><span class="nav-icon">👑</span>Suscripciones<span class="nav-badge">${DB.clientes.length}</span></button>
      <button class="nav-item" data-section="config"><span class="nav-icon">⚙️</span>Configuración</button>`;
  } else {
    nav.innerHTML = `
      <span class="sb-section">Principal</span>
      <button class="nav-item" data-section="dashboard"><span class="nav-icon">🧠</span>Dashboard Clínico</button>
      <span class="sb-section">Mi Práctica</span>
      <button class="nav-item" data-section="agenda"><span class="nav-icon">📅</span>Mi Agenda<span class="nav-badge">4</span></button>
      <button class="nav-item" data-section="nueva-eval"><span class="nav-icon">➕</span>Nueva Evaluación PLC</button>
      <span class="sb-section">Clínica</span>
      <button class="nav-item" data-section="catalogo"><span class="nav-icon">🧪</span>Catálogo<span class="nav-badge">4</span></button>
      <button class="nav-sub active-sub">PLC — Líneas Cruzadas</button>
      <button class="nav-item" data-section="pacientes"><span class="nav-icon">👥</span>Mis Pacientes<span class="nav-badge">${DB.pacientes.length}</span></button>
      <span class="sb-section">Analytics</span>
      <button class="nav-item" data-section="reportes"><span class="nav-icon">📁</span>Mis Reportes</button>
      <button class="nav-item" data-section="tendencias"><span class="nav-icon">📈</span>Tendencias IA-DSS</button>
      <span class="sb-section">Mi Cuenta</span>
      <button class="nav-item" data-section="suscripciones"><span class="nav-icon">💳</span>Facturación & Plan</button>
      <button class="nav-item" data-section="config"><span class="nav-icon">⚙️</span>Perfil & Preferencias</button>`;
  }

  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });
}

/* ────────────────────────────────────────
   5. LISTENERS POR SECCIÓN
──────────────────────────────────────── */
function attachSectionListeners(section, isAdmin) {
  /* ── Botones comunes en AMBOS dashboards ── */
  qs('#btn-export-exec')?.addEventListener('click', () => {
    toast('📊 Generando informe ejecutivo... (simulado)', 'info');
  });
  qs('#btn-goto-subs')?.addEventListener('click', () => navigateTo('suscripciones'));
  qs('.btn-goto-subs-inline')?.addEventListener('click', () => navigateTo('suscripciones'));
  // Ver detalle cliente
  document.querySelectorAll('.btn-cliente-detail').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cliente = DB.clientes.find(c => c.id === btn.dataset.id);
      if (cliente) openModalClienteDetail(cliente);
    });
  });
  qs('#btn-upgrade-plan')?.addEventListener('click', () => toast('📧 Solicitud de upgrade enviada. Te contactaremos en 24h.', 'success'));
  qs('#btn-nueva-eval')?.addEventListener('click', openModalNuevaEval);
  qs('#btn-goto-agenda')?.addEventListener('click', () => navigateTo('agenda'));
  qs('#btn-goto-pac')?.addEventListener('click', () => navigateTo('pacientes'));
  qs('#btn-start-plc')?.addEventListener('click', openPLCMessage);
  qs('#btn-manage-catalog')?.addEventListener('click', () => toast('⚙️ Gestión de catálogo — Panel Admin (próximamente)', 'info'));
  qs('#btn-add-pac')?.addEventListener('click', openModalNuevoPaciente);
  qs('#btn-add-cita')?.addEventListener('click', openModalNuevaCita);
  qs('#btn-cambiar-plan')?.addEventListener('click', openModalPlanes);
  qs('#btn-renovar')?.addEventListener('click', () => toast('🔄 Enviando solicitud de renovación Enterprise...', 'success'));

  /* Botones de descarga simulada */
  document.querySelectorAll('.btn-dl').forEach(btn => attachDownload(btn));
  document.querySelectorAll('.btn-dl-factura').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      simulateDownload(btn, `📄 Descargando ${btn.dataset.pdf}...`);
    });
  });

  /* Ver historial paciente */
  document.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pac = DB.pacientes.find(p => p.id === btn.dataset.id);
      if (pac) openModalHistorial(pac);
    });
  });

  /* Log admin (detalle anónimo) */
  document.querySelectorAll('.btn-admin-detail').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openModalAdminLog(btn.dataset.id);
    });
  });

  /* Buscador de pacientes */
  qs('#search-pac')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#pac-tbody tr').forEach(tr => {
      tr.style.display = tr.dataset.name?.includes(q) ? '' : 'none';
    });
  });

  /* Detalle de cita desde agenda */
  document.querySelectorAll('.btn-cita-detail').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cita = DB.agenda[parseInt(btn.dataset.idx)];
      if (cita) openModalCitaDetail(cita);
    });
  });

  /* Facturación */
  qs('#btn-renovar')?.addEventListener('click', () => {
    toast('✅ Solicitud de renovación enviada. Recibirás confirmación por email.', 'success');
  });
}

function qs(selector) {
  return document.querySelector(selector);
}

/* ────────────────────────────────────────
   6. SEDE SELECTOR (Admin)
──────────────────────────────────────── */
function updateSedeBtn() {
  const s = DB.sedes[DB.state.currentSede];
  document.getElementById('sede-label').textContent = s.label;
}

document.getElementById('btn-sede').addEventListener('click', e => {
  e.stopPropagation();
  const isAdmin = DB.state.currentUser?.role === 'admin';
  if (!isAdmin) return;
  const dd = document.getElementById('sede-dropdown');
  dd.classList.toggle('open');
  closeDropdowns(['sede-dropdown']);
});

document.getElementById('sede-dropdown').addEventListener('click', e => {
  const opt = e.target.closest('.sede-option');
  if (!opt) return;
  const key = opt.dataset.sede;
  if (key === DB.state.currentSede) { document.getElementById('sede-dropdown').classList.remove('open'); return; }

  DB.state.currentSede = key;
  updateSedeBtn();
  document.getElementById('sede-dropdown').classList.remove('open');
  animateKpiUpdate(key);
  toast(`🏛️ Cambiando a ${DB.sedes[key].label}...`, 'info');
});

function animateKpiUpdate(sede) {
  const s = DB.sedes[sede];
  const map = {
    'k-orgs': s.orgs,
    'k-esp':  s.especialistas,
    'k-pru':  s.pruebas.toLocaleString(),
    'k-mrr':  s.ingresos,
    'k-mlp':  `${s.precision}%`,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('kpi-counting');
    el.textContent = val;
    setTimeout(() => el.classList.remove('kpi-counting'), 500);
  });
  // Barra de capacidad
  const fill = document.getElementById('subs-bar-fill');
  if (fill) fill.style.width = `${s.capacidad}%`;
}

/* ────────────────────────────────────────
   7. NOTIFICACIONES
──────────────────────────────────────── */
document.getElementById('btn-notif').addEventListener('click', e => {
  e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  closeDropdowns(['notif-panel']);
  renderNotifPanel();
});

function renderNotifPanel() {
  const role  = DB.state.currentUser?.role || 'psicologo';
  const notifs = DB.notificaciones[role] || [];
  const body  = document.getElementById('notif-body');
  if (!body) return;
  body.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.leido ? '' : 'unread'}" data-nid="${n.id}">
      <div class="notif-icon">${n.icon}</div>
      <div style="flex:1;">
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-hora">${n.hora}</div>
      </div>
      ${!n.leido ? `<div class="notif-unread-dot"></div>` : ''}
    </div>`).join('');

  body.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const nid = item.dataset.nid;
      const notif = notifs.find(n => n.id === nid);
      if (notif) {
        notif.leido = true;
        item.classList.remove('unread');
        item.querySelector('.notif-unread-dot')?.remove();
      }
      updateNotifBadge();
    });
  });
}

document.getElementById('btn-mark-all').addEventListener('click', () => {
  const role  = DB.state.currentUser?.role || 'psicologo';
  DB.notificaciones[role].forEach(n => { n.leido = true; });
  renderNotifPanel();
  updateNotifBadge();
  toast('✅ Todas las notificaciones marcadas como leídas', 'success');
});

function updateNotifBadge() {
  const role   = DB.state.currentUser?.role || 'psicologo';
  const unread = DB.notificaciones[role].filter(n => !n.leido).length;
  document.getElementById('notif-badge-dot').style.display = unread > 0 ? 'block' : 'none';
}

/* ────────────────────────────────────────
   8. AVATAR MENÚ
──────────────────────────────────────── */
document.getElementById('tb-av').addEventListener('click', e => {
  e.stopPropagation();
  const menu = document.getElementById('avatar-menu');
  renderAvatarMenu();
  menu.classList.toggle('open');
  closeDropdowns(['avatar-menu']);
});

function renderAvatarMenu() {
  const u = DB.state.currentUser;
  if (!u) return;
  const body = document.getElementById('avatar-menu');
  body.innerHTML = `
    <div class="av-user">
      <div class="user-av ${u.role}" style="width:36px;height:36px;">${u.initials}</div>
      <div>
        <div class="av-user-name">${u.name}</div>
        <div class="av-user-role">${u.cargo}</div>
      </div>
    </div>
    <button class="av-item" id="av-perfil"><span class="av-icon">👤</span>Mi Perfil</button>
    <button class="av-item" id="av-ajustes"><span class="av-icon">⚙️</span>Ajustes</button>
    <div style="border-top:1px solid var(--surface-mid);margin:4px 0;"></div>
    <button class="av-item danger" id="av-logout"><span class="av-icon">↩</span>Cerrar Sesión</button>`;

  body.querySelector('#av-perfil')?.addEventListener('click',  () => { closeAllDropdowns(); navigateTo('config'); });
  body.querySelector('#av-ajustes')?.addEventListener('click', () => { closeAllDropdowns(); navigateTo('config'); });
  body.querySelector('#av-logout')?.addEventListener('click',  () => {
    closeAllDropdowns();
    openModalConfirm('¿Cerrar sesión de MecaPsi?', 'Tu sesión será finalizada de forma segura.', doLogout);
  });
}

/* ────────────────────────────────────────
   9. DROPDOWNS — Cerrar al clic afuera
──────────────────────────────────────── */
function closeDropdowns(except = []) {
  ['notif-panel','avatar-menu','sede-dropdown'].forEach(id => {
    if (!except.includes(id)) document.getElementById(id)?.classList.remove('open');
  });
}
function closeAllDropdowns() { closeDropdowns([]); }
document.addEventListener('click', closeAllDropdowns);

/* ────────────────────────────────────────
   10. MODALES
──────────────────────────────────────── */
function openModal(title, bodyHtml, footerHtml) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-body').innerHTML      = bodyHtml;
  document.getElementById('modal-footer').innerHTML    = footerHtml || '';
  overlay.classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ── Modal: Nueva Evaluación PLC ── */
function openModalNuevaEval() {
  const opts = DB.pacientes.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  openModal(
    '➕ Nueva Evaluación PLC',
    `<div class="pac-detail-header">
      <div class="pac-av" style="background:linear-gradient(135deg,#2563eb,#006591);">🧠</div>
      <div>
        <div class="pac-name">Prueba de Líneas Cruzadas v3</div>
        <div class="pac-sub">12 min · 32 biomarcadores · Canvas HTML5 · Latencia ~16ms</div>
      </div>
    </div>
    <div class="dss-note" style="margin-bottom:var(--sp-3);">ℹ️ DSS: Esta evaluación expone biomarcadores. El psicólogo interpreta y decide. No es diagnóstico.</div>
    <div class="field">
      <label>Paciente</label>
      <select id="sel-pac-eval">${opts}<option value="nuevo">+ Nuevo paciente...</option></select>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Versión PLC</label>
        <select>
          <option>PLC v3 — Estándar (recomendado)</option>
          <option>PLC v3 — Modo Corto (~6 min)</option>
        </select>
      </div>
      <div class="field">
        <label>Fecha & Hora</label>
        <input type="text" value="18/04/2026 — Ahora" />
      </div>
    </div>
    <div class="field">
      <label>Notas previas (opcional)</label>
      <textarea placeholder="Observaciones antes de la prueba..."></textarea>
    </div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn-primary" id="btn-confirm-eval">🚀 Iniciar Evaluación PLC →</button>`
  );
  document.getElementById('btn-confirm-eval')?.addEventListener('click', openPLCMessage);
}

/* ── Mensaje PLC en desarrollo ── */
function openPLCMessage() {
  closeModal();
  openModal(
    '🧠 Iniciando Entorno de Estímulos',
    `<div style="text-align:center;padding:var(--sp-4);">
      <div style="font-size:3rem;margin-bottom:var(--sp-2);">⚡</div>
      <div style="font-size:1.125rem;font-weight:700;color:var(--text);margin-bottom:var(--sp-1);">
        Iniciando Entorno de Estímulos...
      </div>
      <div style="font-size:.875rem;color:var(--text-muted);margin-bottom:var(--sp-3);">
        Módulo en Desarrollo — Este módulo estará disponible en la integración con el motor Canvas HTML5 de alta precisión.
      </div>
      <div class="dss-note" style="max-width:400px;margin:0 auto;">ℹ️ PLC v3 capturará 32 variables biométricas con latencia ≈16ms. No genera diagnóstico.</div>
    </div>`,
    `<button class="btn-primary" onclick="closeModal()">Entendido</button>`
  );
}

/* ── Modal: Historial Paciente (con sparkline) ── */
function openModalHistorial(pac) {
  const initials = pac.name.split(',')[0].trim().substring(0,2).toUpperCase();
  const chipColors = { 'dss-p0':'#16a34a','dss-p1':'#006591','dss-p2':'#d97706','dss-p3':'#7c3aed','dss-p6':'#2563eb','dss-p7':'#dc2626' };
  const color = chipColors[pac.chip] || '#2563eb';

  openModal(
    `👁 Historial Clínico — ${pac.name}`,
    `<div class="pac-detail-header">
      <div class="pac-av">${initials}</div>
      <div>
        <div class="pac-name">${pac.name}</div>
        <div class="pac-sub">${pac.edad} años · ${pac.genero === 'M' ? 'Masculino' : 'Femenino'} · ${pac.esp}</div>
      </div>
      ${chipHtml(pac.chip, pac.chipLabel)}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-1);margin-bottom:var(--sp-3);">
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1.125rem;font-weight:700;">${pac.conf}%</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Confianza IA</div>
      </div>
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1.125rem;font-weight:700;">${pac.prueba}</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Instrumento</div>
      </div>
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1.125rem;font-weight:700;">${chipHtml(pac.estado==='Activo'?'dss-p0':pac.estado==='Seguimiento'?'dss-p2':'dss-p7', pac.estado)}</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-top:2px;">Estado</div>
      </div>
    </div>

    <div class="sparkline-wrap">
      <div class="sparkline-label">Tendencia de Confianza IA-DSS — Últimas 7 evaluaciones</div>
      ${sparklineSvg(pac.trend, color)}
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-size:.625rem;color:var(--text-muted);">Eval. más antigua</span>
        <span style="font-size:.625rem;color:var(--text-muted);">Más reciente: <strong>${pac.conf}%</strong></span>
      </div>
    </div>

    <div class="field" style="margin-top:var(--sp-2);">
      <label>Notas del Especialista</label>
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-2);font-size:.875rem;color:var(--text);line-height:1.6;">${pac.notas}</div>
    </div>

    <div class="dss-note" style="margin-top:var(--sp-2);">ℹ️ DSS: Biomarcadores observacionales. El psicólogo interpreta y decide.</div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cerrar</button>
     <button class="btn-mini dl btn-dl" data-id="${pac.name}" onclick="simulateDownload(this,'⬇ Generando reporte PDF...')">⬇ Exportar Reporte</button>
     <button class="btn-primary" onclick="openPLCMessage();closeModal();">🔁 Re-evaluar</button>`
  );
}

/* ── Modal: Log Admin (anónimo) ── */
function openModalAdminLog(pacId) {
  openModal(
    `🔍 Log de Actividad — ${pacId}`,
    `<div class="dss-note" style="margin-bottom:var(--sp-3);">🔒 Vista Admin: Datos anonimizados para protección de identidad (RLS activo).</div>
    <table style="margin-top:0;">
      <thead><tr><th>Evento</th><th>Especialista</th><th>Fecha</th><th>Estado</th></tr></thead>
      <tbody>
        <tr><td>Evaluación PLC v3</td><td>Anonimizado</td><td>Abr 17, 2026</td><td>${chipHtml('dss-p0','Completada')}</td></tr>
        <tr><td>Generación de Reporte</td><td>Anonimizado</td><td>Abr 17, 2026</td><td>${chipHtml('dss-p0','Entregado')}</td></tr>
        <tr><td>Evaluación PLC v2</td><td>Anonimizado</td><td>Mar 20, 2026</td><td>${chipHtml('dss-p0','Completada')}</td></tr>
      </tbody>
    </table>`,
    `<button class="btn-primary" onclick="closeModal()">Cerrar</button>`
  );
}

/* ── Modal: Nuevo Paciente ── */
function openModalNuevoPaciente() {
  openModal(
    '👤 Nuevo Paciente',
    `<div class="field-row">
      <div class="field"><label>Nombres</label><input type="text" placeholder="Nombre(s)" /></div>
      <div class="field"><label>Apellidos</label><input type="text" placeholder="Apellido(s)" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Edad</label><input type="number" placeholder="Años" min="5" max="99" /></div>
      <div class="field"><label>Género</label><select><option>Masculino</option><option>Femenino</option><option>Otro</option></select></div>
    </div>
    <div class="field">
      <label>Motivo de Consulta (observacional)</label>
      <textarea placeholder="Descripción de la demanda clínica..."></textarea>
    </div>
    <div class="dss-note">ℹ️ Los datos se almacenarán cifrados en tu clínica asignada (RLS activo).</div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn-primary" id="btn-save-pac">💾 Guardar Paciente</button>`
  );
  document.getElementById('btn-save-pac')?.addEventListener('click', () => {
    closeModal();
    toast('✅ Paciente registrado correctamente', 'success');
  });
}

/* ── Modal: Nueva Cita ── */
function openModalNuevaCita() {
  const opts = DB.pacientes.map(p => `<option>${p.name}</option>`).join('');
  openModal(
    '📅 Agendar Cita',
    `<div class="field"><label>Paciente</label><select>${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>Fecha</label><input type="date" /></div>
      <div class="field"><label>Hora</label><input type="time" value="09:00" /></div>
    </div>
    <div class="field">
      <label>Tipo de Sesión</label>
      <select>
        <option>PLC v3 — Evaluación</option>
        <option>Devolución de resultados</option>
        <option>Entrevista clínica</option>
      </select>
    </div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn-primary" id="btn-save-cita">✅ Confirmar Cita</button>`
  );
  document.getElementById('btn-save-cita')?.addEventListener('click', () => {
    closeModal();
    toast('📅 Cita agendada correctamente', 'success');
  });
}

/* ── Modal: Detalle Cita ── */
function openModalCitaDetail(cita) {
  openModal(
    `📅 Cita — ${cita.name}`,
    `<div class="pac-detail-header">
      <div class="pac-av">${cita.name.split(',')[0].trim().substring(0,2).toUpperCase()}</div>
      <div>
        <div class="pac-name">${cita.name}</div>
        <div class="pac-sub">${cita.time} · ${cita.tipo}</div>
      </div>
      ${chipHtml(cita.estado==='Confirmada'?'dss-p0':'dss-p2', cita.estado)}
    </div>
    <div class="dss-note" style="margin-top:var(--sp-2);">ℹ️ Puedes iniciar la evaluación PLC desde el botón de abajo.</div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cerrar</button>
     <button class="btn-primary" onclick="openPLCMessage()">🚀 Iniciar PLC →</button>`
  );
}

/* ── Modal: Cambiar Plan ── */
function openModalPlanes() {
  const planes = DB.billing.planes;
  openModal(
    '🔄 Actualizar Plan de Suscripción',
    `<div class="dss-note" style="margin-bottom:var(--sp-3);">Los planes se aplican en el siguiente ciclo. Contacta a soporte para cambios urgentes.</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);" id="planes-list">
      ${planes.map(p => `
      <div class="plan-card${p.activo ? ' selected' : ''}" data-plan="${p.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="plan-name">${p.nombre}</div>
          ${p.activo ? `<span style="font-size:.625rem;font-weight:700;background:var(--primary-fixed);color:var(--primary);padding:2px 8px;border-radius:var(--r-pill);">Plan Actual</span>` : ''}
        </div>
        <div class="plan-price">${p.precio}</div>
        <div class="plan-cap">${p.cap} · hasta ${p.orgs} org${p.orgs>1?'s':''}</div>
      </div>`).join('')}
    </div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn-gold" id="btn-confirmar-plan">💳 Confirmar Cambio de Plan</button>`
  );
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
  document.getElementById('btn-confirmar-plan')?.addEventListener('click', () => {
    closeModal();
    toast('💳 Solicitud de cambio de plan enviada. Te contactaremos en 24h.', 'success');
  });
}

/* ── Modal: Confirmar ── */
function openModalConfirm(title, msg, onConfirm) {
  openModal(
    title,
    `<div style="text-align:center;padding:var(--sp-3) 0;">
      <div style="font-size:2rem;margin-bottom:var(--sp-2);">⚠️</div>
      <div style="font-size:.875rem;color:var(--text-muted);">${msg}</div>
    </div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn-primary" style="background:var(--critical);" id="btn-confirm-action">Confirmar</button>`
  );
  document.getElementById('btn-confirm-action')?.addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

/* ────────────────────────────────────────
   11. TOAST / FEEDBACK
──────────────────────────────────────── */
function toast(msg, type = 'info') {
  const colors = { info: 'var(--primary-fixed)', success: 'var(--success-bg)', warning: 'var(--warning-bg)', error: 'var(--critical-bg)' };
  const textColors = { info: 'var(--primary)', success: 'var(--success-dark)', warning: 'var(--warning-dark)', error: 'var(--critical-dark)' };

  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9998;
    background:${colors[type]}; color:${textColors[type]};
    padding:12px 20px; border-radius:10px;
    font-family:'Inter',sans-serif; font-size:.875rem; font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,.12);
    max-width:320px; line-height:1.4;
    opacity:0; transform:translateY(10px);
    transition: opacity .3s ease, transform .3s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; }, 20);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

/* ────────────────────────────────────────
   12. DOWNLOAD SIMULADO
──────────────────────────────────────── */
function attachDownload(btn) {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    simulateDownload(btn);
  });
}
function simulateDownload(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = '⏳';
  btn.disabled = true;
  const label = btn.dataset.id || btn.dataset.pdf || 'archivo';
  setTimeout(() => {
    btn.textContent = '✅';
    toast(msg || `⬇ Reporte de ${label} generado. Signed URL: 60s`, 'success');
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }, 1200);
}

/* ────────────────────────────────────────
   13. LOGOUT SIDEBAR
──────────────────────────────────────── */
document.getElementById('btn-logout').addEventListener('click', () => {
  openModalConfirm('¿Cerrar sesión?', 'Tu sesión será finalizada de forma segura.', doLogout);
});

/* ────────────────────────────────────────
   14. BÚSQUEDA TOPBAR
──────────────────────────────────────── */
document.getElementById('global-search').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) {
      toast(`🔍 Buscando: "${q}"...`, 'info');
      e.target.value = '';
    }
  }
});

/* ────────────────────────────────────────
   15. MODAL DETALLE CLIENTE (Admin)
──────────────────────────────────────── */
function openModalClienteDetail(c) {
  const planCfg = DB.planes.find(p => p.id === c.plan) || {};
  const estadoChip = c.diasRestantes < 0
    ? chipHtml('dss-p7', 'Vencido')
    : c.diasRestantes <= 7
    ? chipHtml('dss-p2', 'Por vencer')
    : chipHtml('dss-p0', 'Al día');

  const planEmoji = planCfg.emoji || '📋';
  const planColor = planCfg.color || '#2563eb';

  openModal(
    `${planEmoji} ${c.nombre} — ${c.planLabel}`,
    `<div class="pac-detail-header">
      <div class="pac-av" style="background:linear-gradient(135deg,${planColor},${planColor}aa);">${c.org.substring(0,2).toUpperCase()}</div>
      <div>
        <div class="pac-name">${c.nombre}</div>
        <div class="pac-sub">${c.org} · ${c.monto}</div>
      </div>
      ${estadoChip}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-1);margin-bottom:var(--sp-3);">
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1.125rem;font-weight:700;">${c.diasRestantes > 0 ? c.diasRestantes + 'd' : 'VENCIDO'}</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Días restantes</div>
      </div>
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1.125rem;font-weight:700;">${c.evaluaciones}</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Evaluaciones</div>
      </div>
      <div style="background:var(--surface-low);border-radius:var(--r-sm);padding:var(--sp-1);text-align:center;">
        <div style="font-size:1rem;font-weight:700;">${c.acceso}</div>
        <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Nivel Acceso</div>
      </div>
    </div>

    <div style="margin-bottom:var(--sp-3);">
      <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-muted);margin-bottom:var(--sp-1);">Instrumentos Activos</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${c.pruebas.map(p => `<span style="background:var(--primary-fixed);color:var(--primary);padding:4px 10px;border-radius:var(--r-pill);font-size:.75rem;font-weight:600;">${p}</span>`).join('')}
      </div>
    </div>

    <div>
      <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-muted);margin-bottom:var(--sp-1);">Historial de Pagos</div>
      <table style="margin:0;">
        <thead><tr><th>Período</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>
          ${c.pagos.map(p => `
          <tr>
            <td>${p.mes}</td>
            <td style="font-weight:700;">${p.monto}</td>
            <td>${chipHtml(p.estado === 'Pagado' ? 'dss-p0' : p.estado === 'Pendiente' ? 'dss-p2' : 'dss-p7', p.estado)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`,
    `<button class="btn-secondary" onclick="closeModal()">Cerrar</button>
     <button class="btn-primary" onclick="closeModal();toast('📧 Notificación de renovación enviada a ${c.nombre}', 'success');">📧 Enviar Recordatorio</button>`
  );
}

