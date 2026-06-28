/* MecaPsi v3.3 — app.js */
const App = {

  init() {
    document.getElementById('btn-login').addEventListener('click', () => App.login());
    document.getElementById('inp-pass').addEventListener('keydown', e => e.key==='Enter' && App.login());
    document.getElementById('btn-logout').addEventListener('click', () => App.logout());
    document.getElementById('btn-bright-minds').addEventListener('click', () => App.toggleBrightMinds());
    document.getElementById('modal-close').addEventListener('click', () => App.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) App.closeModal(); });
    document.getElementById('btn-notif').addEventListener('click', () => App.toggleNotifPanel());
    document.getElementById('btn-mark-all').addEventListener('click', () => App.markAllRead());
    document.getElementById('tb-av').addEventListener('click', () => App.toggleAvatarMenu());
    document.getElementById('btn-sede').addEventListener('click', () => App.toggleSedeDropdown());
    document.querySelectorAll('.sede-option').forEach(el => {
      el.addEventListener('click', () => App.selectSede(el.dataset.sede));
    });
    document.addEventListener('click', e => {
      if(!e.target.closest('#btn-notif') && !e.target.closest('#notif-panel')) document.getElementById('notif-panel').classList.remove('open');
      if(!e.target.closest('#tb-av') && !e.target.closest('#avatar-menu')) document.getElementById('avatar-menu').classList.remove('open');
      if(!e.target.closest('#btn-sede') && !e.target.closest('#sede-dropdown')) document.getElementById('sede-dropdown')?.classList.remove('open');
    });
    checkApiStatus();
    setInterval(checkApiStatus, 15000);
  },

  async login() {
    const user = document.getElementById('inp-user').value.trim().toLowerCase();
    const pass = document.getElementById('inp-pass').value;
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-error');

    btn.disabled = true; btn.textContent = 'Verificando...';
    err.style.display = 'none';

    // Intentar API real
    const apiResult = await apiLogin(user, pass);
    let userData = null;

    if (apiResult && apiResult.token) {
      localStorage.setItem('mecapsi_token', apiResult.token);
      userData = { ...apiResult.user, role: apiResult.user.role };
    } else {
      // Fallback demo
      const u = DB.users[user];
      if (u && u.pass === pass) {
        userData = { username: user, role: u.role, name: u.name, initials: u.initials, org: u.org, orgCode: u.orgCode, cargo: u.cargo, tokens_disponibles: u.tokens_disponibles, tokens_mes: u.tokens_mes, plan: u.plan };
      }
    }

    if (!userData) {
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Acceder al Sistema →';
      return;
    }

    DB.state.currentUser = userData;
    App.showApp(userData);
    btn.disabled = false; btn.textContent = 'Acceder al Sistema →';
  },

  showApp(user) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').classList.add('visible');

    // Banda de rol
    const banner = document.getElementById('role-banner');
    banner.className = `role-banner ${user.role}`;

    // Sidebar info
    const isAdmin = user.role === 'admin';
    document.getElementById('sb-role-badge').textContent = isAdmin ? 'Admin' : 'Especialista';
    document.getElementById('sb-role-badge').className = `sb-logo-badge ${isAdmin ? 'badge-admin' : 'badge-psicologo'}`;
    document.getElementById('sb-org-name').textContent = user.org || 'MecaPsi Corp.';
    document.getElementById('sb-org-role').textContent = user.cargo || (isAdmin ? 'Organización Matriz' : 'Clínica Asociada');
    document.getElementById('sb-org-av').className = `sb-org-av ${user.role}`;
    document.getElementById('sb-org-av').textContent = (user.org||'MP').slice(0,2).toUpperCase();
    document.getElementById('sb-user-name').textContent = user.name;
    document.getElementById('sb-user-role-lbl').textContent = user.cargo || (isAdmin?'Administrador':'Psicólogo');
    document.getElementById('sb-user-av').textContent = user.initials || user.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    document.getElementById('sb-user-av').className = `user-av ${user.role}`;
    document.getElementById('tb-av').textContent = user.initials || 'MP';
    document.getElementById('tb-av').className = `topbar-av ${user.role}`;
    document.getElementById('tb-org').textContent = user.org || 'MecaPsi Corp.';

    // Sede wrapper solo admin
    document.getElementById('sede-wrapper').style.display = isAdmin ? 'block' : 'none';

    // Notificaciones
    App.loadNotifications(user.role);

    // Buildnav
    App.buildNav(user.role);

    // Dashboard inicial
    App.navigate('dashboard');

    // Avatar menu
    App.buildAvatarMenu(user);
  },

  buildNav(role) {
    const nav = document.getElementById('sidebar-nav');
    const isAdmin = role === 'admin';
    const items = isAdmin ? [
      { section: 'GLOBAL' },
      { id:'dashboard', icon:'🏠', label:'Panel de Control' },
      { id:'metricas', icon:'📊', label:'Métricas Globales', badge:'Admin' },
      { section: 'GESTIÓN' },
      { id:'clientes', icon:'🏢', label:'Especialistas', badge: DB.clientes.length },
      { id:'config', icon:'⚙️', label:'Configuración' },
    ] : [
      { section: 'CLÍNICO' },
      { id:'dashboard', icon:'🏠', label:'Mi Dashboard' },
      { id:'pacientes', icon:'👥', label:'Pacientes', badge: DB.pacientes.length },
      { id:'agenda', icon:'📅', label:'Agenda', badge: DB.agenda.length },
      { section: 'EVALUACIÓN' },
      { id:'plc', icon:'🧠', label:'PLC — Prueba', badge:'🪙1' },
      { id:'catalogo', icon:'📚', label:'Catálogo (20)', badge:'nuevo' },
      { section: 'HERRAMIENTAS' },
      { id:'teleconsulta', icon:'📹', label:'Teleconsulta', badge:'LIVE' },
      { id:'tokens', icon:'🪙', label:'Billetera Tokens' },
      { id:'config', icon:'⚙️', label:'Configuración' },
    ];

    nav.innerHTML = items.map(item => {
      if (item.section) return `<div class="sb-section">${item.section}</div>`;
      return `<button class="nav-item" id="nav-${item.id}" onclick="App.navigate('${item.id}')">
        <span class="nav-icon">${item.icon}</span>
        <span style="flex:1">${item.label}</span>
        ${item.badge ? `<span class="nav-badge ${item.badge==='LIVE'?'live':''}">${item.badge}</span>` : ''}
      </button>`;
    }).join('');
  },

  navigate(section, data) {
    // Si estamos saliendo de PLC, asegurar que restauramos la UI
    if (DB.state.currentSection === 'plc' && section !== 'plc') {
      App.exitPLCMode();
    }
    
    DB.state.currentSection = section;
    // Actualizar nav activo
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.id===`nav-${section}`));
    document.getElementById('tb-page').textContent = {
      dashboard:'Dashboard', pacientes:'Pacientes', agenda:'Agenda', plc:'PLC — Prueba',
      catalogo:'Catálogo', teleconsulta:'Teleconsulta', tokens:'Tokens', config:'Configuración',
      metricas:'Métricas', clientes:'Especialistas'
    }[section] || section;

    const ws = document.getElementById('workspace');
    ws.innerHTML = '';
    ws.style.opacity = '0';

    let content = '';
    const user = DB.state.currentUser;
    switch(section) {
      case 'dashboard':    content = Views.dashboard(user); break;
      case 'pacientes':    content = Views.pacientes(); break;
      case 'agenda':       content = Views.agenda(); break;
      case 'teleconsulta': content = Views.teleconsulta(); break;
      case 'tokens':       content = Views.tokens(); break;
      case 'catalogo':     content = Views.catalogo(); break;
      case 'config':       content = Views.config(user); break;
      case 'plc':          content = Views.plc(); break;
      case 'metricas':     content = Views.adminMetrics(); break;
      case 'clientes':     content = Views.dashboardAdmin(user); break;
      default:             content = Views.dashboard(user);
    }

    ws.innerHTML = content;
    requestAnimationFrame(() => { ws.style.transition='opacity .2s'; ws.style.opacity='1'; });

    // Activar modo PLC inmersivo (ocultar UI, fullscreen)
    if (section === 'plc') {
      App.enterPLCMode();

      setTimeout(() => {
        const user = DB.state.currentUser;
        let participant = null;
        if (data) {
          const pac = DB.pacientes.find(p => p.id === data);
          if (pac) participant = {
            id:          pac.id,
            name:        pac.name,
            age:         pac.edad        || 25,
            gender:      pac.genero === 'M' ? 'Masculino' : pac.genero === 'F' ? 'Femenino' : (pac.genero || 'No especificado'),
            education:   pac.educacion   || 'Universitario',
            hand:        pac.lateralidad || 'Derecha',
            occupation:  pac.cargo       || pac.occupation || ''
          };
        }
        PLCEngine.start('plc-container', participant, (result) => {
          DB.state.lastPLCResult = result;
          // Doble seguridad: restaurar UI al completar
          App.exitPLCMode();
          
          const ws2 = document.getElementById('workspace');
          if (ws2) {
            ws2.innerHTML = Views.plcResultReal(result);
            requestAnimationFrame(() => { ws2.style.transition='opacity .3s'; ws2.style.opacity='1'; });
          }
          App.toast('✅ Evaluación completada — ' + result.linesData.length + ' líneas procesadas', 'success');
          document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', false));
          document.getElementById('tb-page').textContent = 'Resultados PLC';
        });
        if (user?.role === 'psicologo') apiConsumeToken();
      }, 300);
    }
    if (section === 'teleconsulta') App.startTeleTimer();
  },

  /* ── Modo PLC Inmersivo ──────────────────── */
  enterPLCMode() {
    document.body.classList.add('plc-mode');
    const el = document.documentElement;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (rfs) rfs.call(el).catch(() => {});
  },

  exitPLCMode() {
    document.body.classList.remove('plc-mode');
    if (document.fullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
    }
  },

  /* ── Bright Minds ─────────────────────── */
  brightMindsActive: false,
  toggleBrightMinds(forceVal) {
    const active = forceVal !== undefined ? forceVal : !App.brightMindsActive;
    App.brightMindsActive = active;
    DB.state.brightMinds = active;
    document.body.classList.toggle('bright-minds', active);
    const cb = document.getElementById('toggle-bm');
    if (cb) cb.checked = active;
    App.navigate(DB.state.currentSection);
    App.toast(active ? '🌈 Bright Minds activado' : '🧠 Modo clínico restaurado', 'info');
  },

  /* ── Dark Mode ────────────────────────── */
  toggleDark(on) {
    document.body.classList.toggle('dark-theme', on);
  },

  /* ── Modales ──────────────────────────── */
  openModal(title, body, footerBtns=[]) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footerBtns.join('');
    document.getElementById('modal-overlay').classList.add('open');
  },
  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  },

  openNotaModal(pacId) {
    const pac = DB.pacientes.find(p=>p.id===pacId);
    App.openModal(`📝 Crear Nota — ${pac?.name||pacId}`,
      `<div class="login-field"><label>Tipo de Nota</label>
        <select id="nota-tipo" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;">
          <option>Sesión</option><option>Evaluación</option><option>Seguimiento</option><option>Devolución</option>
        </select></div>
       <div class="login-field" style="margin-top:12px;"><label>Observación Clínica</label>
        <textarea id="nota-texto" style="width:100%;min-height:120px;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;" placeholder="Escribe la nota clínica..."></textarea>
       </div>`,
      [`<button class="btn-secondary" onclick="App.closeModal()">Cancelar</button>`,
       `<button class="btn-primary" onclick="App.saveNota('${pacId}')">💾 Guardar Nota</button>`]
    );
  },

  async saveNota(pacId) {
    const texto = document.getElementById('nota-texto').value;
    const tipo = document.getElementById('nota-tipo').value;
    if (!texto.trim()) { App.toast('Escribe el contenido de la nota','error'); return; }
    await apiPostNota(pacId, texto, tipo);
    App.closeModal();
    App.toast('✅ Nota guardada correctamente', 'success');
  },

  openHistorialModal(pacId) {
    const pac = DB.pacientes.find(p=>p.id===pacId);
    const notas = [
      { tipo:'Evaluación', texto: pac?.notas||'Sin notas previas.', fecha:'Abr 17, 2026 — 10:30am' },
      { tipo:'Seguimiento', texto:'Paciente muestra mejoría en latencia. Se recomienda continuar protocolo.', fecha:'Abr 10, 2026 — 09:00am' }
    ];
    App.openModal(`📋 Historial — ${pac?.name||pacId}`,
      notas.map(n=>`<div class="nota-item"><div class="nota-tipo">${n.tipo}</div><div class="nota-texto">${n.texto}</div><div class="nota-fecha">📅 ${n.fecha}</div></div>`).join(''),
      [`<button class="btn-pdf" onclick="App.generatePDF()">📄 Exportar PDF</button>`,
       `<button class="btn-secondary" onclick="App.closeModal()">Cerrar</button>`]
    );
  },

  openAgendarModal() {
    App.openModal('📅 Agendar Cita',
      `<div class="login-field"><label>Paciente</label>
        <select id="agenda-pac" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;">
          ${DB.pacientes.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
        </select></div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
        <div class="login-field"><label>Fecha</label><input type="date" id="agenda-fecha" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;"></div>
        <div class="login-field"><label>Hora</label><input type="time" id="agenda-hora" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;"></div>
       </div>
       <div class="login-field" style="margin-top:12px;"><label>Tipo de Cita</label>
        <select id="agenda-tipo" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;font-family:inherit;">
          <option>PLC v3 — Evaluación</option><option>Entrevista Clínica</option><option>Devolución de Resultados</option><option>Seguimiento</option>
        </select></div>`,
      [`<button class="btn-secondary" onclick="App.closeModal()">Cancelar</button>`,
       `<button class="btn-primary" onclick="App.saveCita()">✅ Agendar</button>`]
    );
  },

  async saveCita() {
    const pac = document.getElementById('agenda-pac').value;
    const fecha = document.getElementById('agenda-fecha').value;
    const hora = document.getElementById('agenda-hora').value;
    const tipo = document.getElementById('agenda-tipo').value;
    if (!fecha || !hora) { App.toast('Completa fecha y hora', 'error'); return; }
    await apiPostCita({ paciente_nombre: pac, fecha, hora, tipo, modalidad: 'Presencial', color: '#2563eb' });
    App.closeModal();
    App.toast('✅ Cita agendada correctamente', 'success');
  },

  openNewPacienteModal() {
    const lbl = (t) => `<label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">${t}</label>`;
    const inp = (id,ph,type='text',extra='') => `<input id="${id}" type="${type}" placeholder="${ph}" ${extra} style="width:100%;padding:9px 11px;border:1.5px solid var(--outline-var);border-radius:8px;font-family:inherit;font-size:.875rem;color:var(--text);box-sizing:border-box;">`;
    const radios = (name,opts,def) => opts.map(o=>`<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem;font-weight:500;"><input type="radio" name="${name}" value="${o}" ${o===def?'checked':''} style="accent-color:#1e3a8a;"> ${o}</label>`).join('');
    App.openModal('👤 Registrar Nuevo Paciente',
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>${lbl('ID del Participante *')}${inp('pac-id','ej: PAC-0201')}</div>
        <div>${lbl('Nombre Completo *')}${inp('pac-nombre','Apellido, Nombre')}</div>
       </div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>${lbl('Edad * (Años)')}${inp('pac-edad','25','number','min="4" max="120"')}</div>
        <div>${lbl('Ocupación / Cargo')}${inp('pac-cargo','Ej: Estudiante')}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Género')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('new-genero',['Masculino','Femenino','Otro','No especificado'],'Masculino')}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Nivel Educativo')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('new-edu',['Primaria','Secundaria','Universitario','Posgrado'],'Universitario')}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Lateralidad')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('new-lat',['Derecha','Izquierda','Ambidiestro'],'Derecha')}</div>
       </div>
       <div>${lbl('Motivo de Consulta')}
        <textarea id="pac-motivo" style="width:100%;min-height:70px;padding:9px 11px;border:1.5px solid var(--outline-var);border-radius:8px;font-family:inherit;font-size:.875rem;resize:vertical;" placeholder="Motivo de consulta inicial..."></textarea>
       </div>`,
      [`<button class="btn-secondary" onclick="App.closeModal()">Cancelar</button>`,
       `<button class="btn-primary" onclick="App.saveNuevoPaciente()">✅ Registrar Paciente</button>`]
    );
  },

  async saveNuevoPaciente() {
    const id     = document.getElementById('pac-id')?.value.trim();
    const nombre = document.getElementById('pac-nombre')?.value.trim();
    const edad   = parseInt(document.getElementById('pac-edad')?.value)||25;
    const cargo  = document.getElementById('pac-cargo')?.value.trim()||'';
    const motivo = document.getElementById('pac-motivo')?.value.trim()||'';
    const genero = document.querySelector('input[name="new-genero"]:checked')?.value||'No especificado';
    const edu    = document.querySelector('input[name="new-edu"]:checked')?.value||'Universitario';
    const lat    = document.querySelector('input[name="new-lat"]:checked')?.value||'Derecha';
    if (!nombre.trim()) { App.toast('El nombre es obligatorio','error'); return; }
    const newId = id || ('PAC-' + String(Date.now()).slice(-4));
    DB.pacientes.unshift({
      id: newId, name: nombre, edad, genero, educacion: edu, lateralidad: lat,
      cargo, prueba: 'Pendiente', chip: '', chipLabel: 'Sin eval.',
      conf: 0, fecha: 'Hoy', estado: 'Activo', notas: motivo
    });
    App.closeModal();
    App.toast(`✅ Paciente ${nombre} registrado como ${newId}`, 'success');
    App.navigate('pacientes');
  },

  openEditPacienteModal(pacId) {
    const pac = DB.pacientes.find(p=>p.id===pacId);
    if (!pac) return;
    const lbl = (t) => `<label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">${t}</label>`;
    const inp = (id,val,ph,type='text',extra='') => `<input id="${id}" type="${type}" value="${val}" placeholder="${ph}" ${extra} style="width:100%;padding:9px 11px;border:1.5px solid var(--outline-var);border-radius:8px;font-family:inherit;font-size:.875rem;color:var(--text);box-sizing:border-box;">`;
    const radios = (name,opts,def) => opts.map(o=>`<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem;"><input type="radio" name="${name}" value="${o}" ${o===def?'checked':''} style="accent-color:#1e3a8a;"> ${o}</label>`).join('');
    const gDef = pac.genero==='M'?'Masculino':pac.genero==='F'?'Femenino':(pac.genero||'No especificado');
    App.openModal(`✏️ Editar Perfil — ${pac.name}`,
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>${lbl('Edad (Años)')}${inp('edit-edad',pac.edad||25,'25','number','min="4" max="120"')}</div>
        <div>${lbl('Ocupación / Cargo')}${inp('edit-cargo',pac.cargo||'','Ej: Estudiante')}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Género')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('edit-genero',['Masculino','Femenino','Otro','No especificado'],gDef)}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Nivel Educativo')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('edit-edu',['Primaria','Secundaria','Universitario','Posgrado'],pac.educacion||'Universitario')}</div>
       </div>
       <div style="margin-bottom:12px;">${lbl('Lateralidad')}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">${radios('edit-lat',['Derecha','Izquierda','Ambidiestro'],pac.lateralidad||'Derecha')}</div>
       </div>
       <div>${lbl('Notas Clínicas')}
        <textarea id="edit-notas" style="width:100%;min-height:80px;padding:9px 11px;border:1.5px solid var(--outline-var);border-radius:8px;font-family:inherit;font-size:.875rem;resize:vertical;">${pac.notas||''}</textarea>
       </div>`,
      [`<button class="btn-secondary" onclick="App.closeModal()">Cancelar</button>`,
       `<button class="btn-primary" onclick="App.saveEditPaciente('${pacId}')">💾 Guardar Cambios</button>`]
    );
  },

  saveEditPaciente(pacId) {
    const pac = DB.pacientes.find(p=>p.id===pacId);
    if (!pac) return;
    pac.edad       = parseInt(document.getElementById('edit-edad')?.value)||pac.edad;
    pac.cargo      = document.getElementById('edit-cargo')?.value.trim()||pac.cargo;
    pac.notas      = document.getElementById('edit-notas')?.value.trim()||pac.notas;
    pac.genero     = document.querySelector('input[name="edit-genero"]:checked')?.value||pac.genero;
    pac.educacion  = document.querySelector('input[name="edit-edu"]:checked')?.value||pac.educacion;
    pac.lateralidad= document.querySelector('input[name="edit-lat"]:checked')?.value||pac.lateralidad;
    App.closeModal();
    App.toast(`✅ Perfil de ${pac.name} actualizado`, 'success');
    App.navigate('pacientes');
  },


  openTeleconsultaModal() {
    App.navigate('teleconsulta');
  },

  /* ── Teleconsulta ─────────────────────── */
  _teleTimer: null,
  _teleSecs: 0,
  startTeleTimer() {
    clearInterval(App._teleTimer);
    App._teleSecs = 0;
    App._teleTimer = setInterval(() => {
      App._teleSecs++;
      const m = String(Math.floor(App._teleSecs/60)).padStart(2,'0');
      const s = String(App._teleSecs%60).padStart(2,'0');
      const el = document.getElementById('tele-timer');
      if (el) el.textContent = `${m}:${s}`;
      else clearInterval(App._teleTimer);
    }, 1000);
  },
  toggleTele(btn) {
    btn.classList.toggle('active');
    btn.classList.toggle('inactive');
  },
  endCall() {
    clearInterval(App._teleTimer);
    App.toast('📵 Teleconsulta finalizada', 'info');
    App.navigate('agenda');
  },
  saveTeleNotes() {
    App.toast('💾 Notas de sesión guardadas', 'success');
  },

  openTeleChat() {
    App.toast('💬 El chat de teleconsulta se habilitará en la versión 3.4', 'info');
  },

  /* ── Notificaciones ───────────────────── */
  loadNotifications(role) {
    const notifs = DB.notificaciones[role] || [];
    const body = document.getElementById('notif-body');
    const badge = document.getElementById('notif-badge-dot');
    const unread = notifs.filter(n=>!n.leido).length;
    badge.style.display = unread > 0 ? 'block' : 'none';
    body.innerHTML = notifs.map(n=>`
      <div class="notif-item ${n.leido?'':'unread'}">
        <span style="font-size:1.125rem">${n.icon}</span>
        <div style="flex:1"><div style="font-size:.8125rem;font-weight:${n.leido?400:600}">${n.msg}</div><div style="font-size:.6875rem;color:var(--text-muted)">${n.hora}</div></div>
      </div>`).join('');
  },
  toggleNotifPanel() {
    document.getElementById('notif-panel').classList.toggle('open');
    document.getElementById('avatar-menu').classList.remove('open');
  },
  markAllRead() {
    const role = DB.state.currentUser?.role;
    if (DB.notificaciones[role]) DB.notificaciones[role].forEach(n=>n.leido=true);
    App.loadNotifications(role);
  },

  /* ── Avatar Menu ──────────────────────── */
  buildAvatarMenu(user) {
    const menu = document.getElementById('avatar-menu');
    menu.innerHTML = `
      <div class="av-menu-header"><div style="font-weight:700">${user.name}</div><div style="font-size:.75rem;color:var(--text-muted)">${user.role==='admin'?'Administrador':'Psicólogo'}</div></div>
      <div class="av-menu-item" onclick="App.navigate('config');App.toggleAvatarMenu()">⚙️ Configuración</div>
      <div class="av-menu-item" onclick="App.navigate('tokens');App.toggleAvatarMenu()">🪙 Mis Tokens</div>
      <div class="av-menu-separator"></div>
      <div class="av-menu-item danger" onclick="App.logout()">↩ Cerrar Sesión</div>`;
  },
  toggleAvatarMenu() {
    document.getElementById('avatar-menu').classList.toggle('open');
    document.getElementById('notif-panel').classList.remove('open');
  },

  /* ── Sede ─────────────────────────────── */
  toggleSedeDropdown() {
    document.getElementById('sede-dropdown').classList.toggle('open');
  },
  selectSede(sede) {
    DB.state.currentSede = sede;
    document.getElementById('sede-label').textContent = DB.sedes[sede]?.label || sede;
    document.getElementById('sede-dropdown').classList.remove('open');
    App.navigate('dashboard');
  },

  /* ── Logout ───────────────────────────── */
  logout() {
    App.exitPLCMode();
    DB.state.currentUser = null;
    localStorage.removeItem('mecapsi_token');
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('inp-user').value = '';
    document.getElementById('inp-pass').value = '';
    document.body.classList.remove('dark-theme','bright-minds');
  },

  /* ── Excel (SheetJS) ──────────────────────── */
  generateExcel() {
    if (typeof XLSX === 'undefined') {
      App.toast('⚠️ SheetJS no cargado. Verifica conexión.', 'error'); return;
    }
    const r = DB.state.lastPLCResult;
    if (!r) { App.toast('⚠️ No hay resultados para exportar.', 'error'); return; }
    const m = r.metrics;
    const p = r.participant || {};
    const now = new Date().toLocaleString('es-CO');
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Resumen Clínico Completo ──
    const resumen = [
      ['MECAPSI v3.3 — INFORME PRUEBA DE LÍNEAS CRUZADAS (PLC)', '', '', ''],
      ['Generado:', now, '', ''],
      ['DISCLAIMER:', 'Este informe es apoyo al criterio clínico (DSS). NO emite diagnósticos.', '', ''],
      [],
      ['=== DATOS DEL EVALUADO ===', '', '', ''],
      ['ID Paciente:', p.id || '—',       'Nombre:', p.name || '—'],
      ['Edad:', p.age || '—',             'Ocupación:', p.occupation || '—'],
      ['Género:', p.gender || '—',        'Nivel Educativo:', p.education || '—'],
      ['Lateralidad:', p.hand || '—',     'Psicólogo evaluador:', DB.state.currentUser?.name || '—'],
      [],
      ['=== MÉTRICAS PRINCIPALES ===', '', '', ''],
      ['Total Aciertos (TA):', m.TA,              'Total Omisiones (O):', m.O],
      ['Total Comisiones (COM):', m.COM,          'Acierto Neto (CON):', m.CON],
      ['CP % (Concentración):', +m.CP.toFixed(2), 'Velocidad (estím/min):', +m.procSpeed.toFixed(1)],
      ['Estabilidad %:', +m.estabilidad.toFixed(1),'TRM Monotonía %:', +m.TRM.toFixed(2)],
      ['TR Medio (ms):', +m.meanRt.toFixed(0),    'IVR Vel/Error:', +m.IVR.toFixed(3)],
      ['Tiempo Total (s):', +m.totalTime.toFixed(1),'Varianza (VAR) %:', +m.VAR.toFixed(2)],
      [],
      ['=== PERFIL COGNITIVO (RADAR) ===', '', '', ''],
      ['Concentración (CP%):', +m.CP.toFixed(1),
       'Estabilidad:', +m.estabilidad.toFixed(1)],
      ['Velocidad (norm.):', +(Math.min((m.procSpeed/60)*100,100)).toFixed(1),
       'Inhibición:', +(Math.max(0,100-(m.COM/Math.max(m.TA+m.COM,1))*100)).toFixed(1)],
      ['Consistencia:', +(Math.max(0,100-Math.abs(m.TRM))).toFixed(1),
       'Precisión:', +((m.TA/Math.max(m.TA+m.O,1))*100).toFixed(1)],
      [],
      ['=== CLASIFICACIÓN DSS / MLP ===', '', '', ''],
      ['Chip Perfil:', r.chipLabel || '—', 'Patrón:', m.attnStyle || '—'],
      ['Descripción patrón:', m.attnDesc || '—', '', ''],
      ['Redes cognitivas:', m.focusType || '—', '', ''],
      ['Confianza modelo:', (r.conf ? r.conf+'%' : (55+Math.round(m.CP*0.35))+'%'), '', ''],
      [],
      ['=== NARRATIVA TÉCNICA ===', '', '', ''],
      [r.narrative || ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resumen);
    ws1['!cols'] = [{wch:30},{wch:24},{wch:26},{wch:32}];
    XLSX.utils.book_append_sheet(wb, ws1, '01_Resumen_Clínico');

    // ── Hoja 2: Desglose por Línea ──
    const lineas = [
      ['Línea','Blancos Totales','Aciertos','Omisiones','Comisiones','Tiempo (s)','Exactitud %','Tiempo %','Estado'],
      ...r.linesData.map(l => {
        const acc = +((l.aciertos / Math.max(l.targets_total,1))*100).toFixed(1);
        const estado = acc>=80?'Bueno':acc>=55?'Regular':'Bajo';
        return [
          l.linea, l.targets_total, l.aciertos, l.omisiones, l.comisiones,
          +l.tiempo_s.toFixed(2), acc, +(l.tiempo_pct||0).toFixed(1), estado
        ];
      })
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(lineas);
    ws2['!cols'] = [{wch:8},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws2, '02_Análisis_Líneas');

    // ── Hoja 3: Perfil Radar (valores para gráfica Excel) ──
    const radar = [
      ['DIMENSIÓN COGNITIVA','VALOR (0-100)','REFERENCIA ÓPTIMA'],
      ['Concentración (CP%)', +m.CP.toFixed(1), 80],
      ['Estabilidad', +m.estabilidad.toFixed(1), 80],
      ['Velocidad de Procesamiento', +(Math.min((m.procSpeed/60)*100,100)).toFixed(1), 75],
      ['Inhibición de Distractores', +(Math.max(0,100-(m.COM/Math.max(m.TA+m.COM,1))*100)).toFixed(1), 85],
      ['Consistencia (anti-monotonía)', +(Math.max(0,100-Math.abs(m.TRM))).toFixed(1), 80],
      ['Precisión de Detección', +((m.TA/Math.max(m.TA+m.O,1))*100).toFixed(1), 85],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(radar);
    ws3['!cols'] = [{wch:34},{wch:18},{wch:20}];
    XLSX.utils.book_append_sheet(wb, ws3, '03_Perfil_Radar');

    // ── Hoja 4: Glosario de Métricas ──
    const glosario = [
      ['MÉTRICA','DESCRIPCIÓN','INTERPRETACIÓN'],
      ['TA','Total Aciertos','Número de estímulos objetivo correctamente identificados'],
      ['O','Omisiones','Objetivos no marcados — asociados a déficit de rastreo atencional'],
      ['COM','Comisiones','Distractores marcados — asociados a falla inhibitoria'],
      ['CON','Acierto Neto','TA − O − COM — capacidad neta de discriminación'],
      ['CP %','Concentración','(CON/TN)×100 — índice global de concentración'],
      ['TRM','Curva cronológica','% cambio entre primera y segunda mitad — detecta fatiga'],
      ['VAR','Variabilidad','Coeficiente de variación de aciertos por línea'],
      ['IVR','Índice Vel/Error','Relación velocidad vs comisiones — impulsividad'],
      ['TR Medio','Tiempo de reacción','Media aritmética de latencias de primer clic por estímulo (ms)'],
      ['Estabilidad','Consistencia de rendimiento','Porcentaje de líneas sin caída brusca de rendimiento'],
      ['Inhibición','Control inhibitorio','Capacidad de suprimir respuestas a estímulos distractores'],
      ['Precisión','Exactitud de detección','Porcentaje de objetivos correctamente identificados sobre el total de blancos'],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(glosario);
    ws4['!cols'] = [{wch:12},{wch:30},{wch:60}];
    XLSX.utils.book_append_sheet(wb, ws4, '04_Glosario_Métricas');

    // ── Hoja 5: Log de Eventos Crudos ──
    const log = [
      ['Línea','Índice Estímulo','Tipo Estímulo','Es Objetivo','Acción','Latencia (ms)'],
      ...(r.clickLog || []).map(cl => [
        cl.line, cl.stim_idx, cl.stim_key, cl.is_target ? 'SÍ' : 'NO',
        cl.action === 'sel' ? 'Seleccionado' : 'Deseleccionado', cl.elapsed_ms
      ])
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(log);
    ws5['!cols'] = [{wch:8},{wch:16},{wch:16},{wch:12},{wch:18},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws5, '05_Log_Eventos');

    const fname = `MecaPsi_PLC_${(p.id||'EV').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    App.toast('📊 Excel generado: ' + fname, 'success');
  },

  /* ── PDF ──────────────────────────────── */
  generatePDF() {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      App.toast('⚠️ jsPDF no cargado. Verifica conexión a internet.','error'); return;
    }
    const { jsPDF } = window.jspdf || jspdf;
    const doc = new jsPDF();
    const user = DB.state.currentUser;
    const r = DB.state.lastPLCResult || {};
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('MecaPsi v3.3 — Informe PLC', 20, 24);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 20, 34);
    doc.text(`Especialista: ${user?.name||'—'}`, 20, 42);
    doc.text(`Perfil DSS: ${r.perfilLabel||'—'}`, 20, 50);
    doc.text(`Confianza IA: ${r.confianza||'—'}%`, 20, 58);
    doc.text(`Precisión: ${r.accuracy||'—'}%`, 20, 66);
    doc.text(`Latencia prom: ${r.avgLatency||'—'}ms`, 20, 74);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('DISCLAIMER: Este informe es un apoyo clínico (DSS). No constituye diagnóstico.', 20, 280);
    doc.save('MecaPsi_Informe_PLC.pdf');
    App.toast('📄 PDF generado correctamente','success');
  },

  /* ── Toast ────────────────────────────── */
  toast(msg, type='info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${{success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'}[type]||'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(8px)'; setTimeout(()=>t.remove(),300); }, 3500);
  },

  showComingSoon(name) {
    Views.showComingSoon(name);
  }
};

// ── Init ──
window.addEventListener('DOMContentLoaded', () => App.init());
