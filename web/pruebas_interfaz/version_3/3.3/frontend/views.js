/* MecaPsi v3.3 — views.js */
const Views = {

  dashboard(user) {
    if (user.role === 'admin') return Views.dashboardAdmin(user);
    return Views.dashboardPsicologo(user);
  },

  dashboardAdmin(user) {
    const sede = DB.sedes[DB.state.currentSede];
    return `<div class="workspace-inner">
      <div class="page-header">
        <div><div class="page-title">Panel de Control</div><div class="page-sub">Ecosistema MecaPsi — Vista Administrador</div></div>
        <button class="btn-primary" onclick="Views.showTokensModal()">🪙 Gestionar Tokens</button>
      </div>
      <div class="kpi-row">
        ${Views.kpi('Especialistas', sede.especialistas, '👨‍⚕️','c-gold','Activos en sede')}
        ${Views.kpi('Evaluaciones', sede.pruebas.toLocaleString(), '🧠','c-blue','Este mes')}
        ${Views.kpi('Ingresos', sede.ingresos, '💰','c-green','Facturación mensual')}
        ${Views.kpi('Precisión IA', sede.precision+'%', '🤖','c-purple','Modelo MLP v3')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">Especialistas Activos</span></div>
          <div class="card-body">
            ${DB.clientes.map(c=>`<div class="list-row">
              <div class="list-av ${c.plan}">${c.nombre.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
              <div style="flex:1"><div class="list-name">${c.nombre}</div><div class="list-sub">${c.org}</div></div>
              <span class="badge-plan ${c.plan}">${c.planLabel}</span>
              <span class="token-chip">🪙 ${c.tokens}</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Planes Disponibles</span></div>
          <div class="card-body">
            ${DB.planes.map(p=>`<div class="plan-card">
              <div style="font-size:1.5rem">${p.emoji}</div>
              <div style="flex:1"><div style="font-weight:700">${p.label}</div><div style="font-size:.75rem;color:var(--text-muted)">${p.precio}</div></div>
              <div style="font-size:.75rem;font-weight:700;color:var(--text-muted)">${p.tokens} tokens</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  dashboardPsicologo(user) {
    return `<div class="workspace-inner">
      <div class="page-header">
        <div><div class="page-title">Mi Dashboard Clínico</div><div class="page-sub">${user.org || 'Clínica'} · ${new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div></div>
        <button class="btn-primary" onclick="App.navigate('plc')">🧠 Nueva Evaluación PLC</button>
      </div>
      <div class="kpi-row">
        ${Views.kpi('Tokens','42','🪙','c-gold','Disponibles este mes',true)}
        ${Views.kpi('Pacientes','5','👥','c-blue','Activos en agenda')}
        ${Views.kpi('Evaluaciones','3','🧠','c-green','Esta semana')}
        ${Views.kpi('Citas hoy','5','📅','c-purple','En agenda')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📅 Agenda de Hoy</span>
            <button class="btn-secondary" onclick="App.navigate('agenda')">Ver todo</button></div>
          <div class="card-body">
            ${DB.agenda.map(c=>`<div class="agenda-row">
              <div class="agenda-dot" style="background:${c.color}"></div>
              <div class="agenda-time">${c.time}</div>
              <div style="flex:1"><div class="agenda-name">${c.name}</div><div class="agenda-tipo">${c.tipo}</div></div>
              <span class="estado-chip ${c.estado.toLowerCase().replace(' ','-')}">${c.estado}</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">👥 Pacientes Recientes</span>
            <button class="btn-secondary" onclick="App.navigate('pacientes')">Ver todos</button></div>
          <div class="card-body">
            ${DB.pacientes.slice(0,4).map(p=>`<div class="list-row">
              <div class="list-av psicologo">${p.name.split(',')[0][0]}${p.name.split(',')[0][1]||''}</div>
              <div style="flex:1"><div class="list-name">${p.name}</div><div class="list-sub">${p.prueba} · ${p.fecha}</div></div>
              <span class="conf-chip">${p.conf}%</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  kpi(label, val, icon, cls, sub, clickable) {
    return `<div class="kpi-card ${cls}" ${clickable?'onclick="App.navigate(\'tokens\')" style="cursor:pointer"':''}>
      <div class="kpi-top"><span class="kpi-icon">${icon}</span><span class="kpi-label">${label}</span></div>
      <div class="kpi-val">${val}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  },

  pacientes() {
    return `<div class="workspace-inner">
      <div class="page-header">
        <div><div class="page-title">Gestión de Pacientes</div><div class="page-sub">${DB.pacientes.length} pacientes activos</div></div>
        <button class="btn-primary" onclick="App.openNewPacienteModal()">+ Nuevo Paciente</button>
      </div>
      <div class="card">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Paciente</th><th>Edad</th><th>Perfil DSS</th><th>Confianza</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${DB.pacientes.map(p=>`<tr>
              <td><code>${p.id}</code></td>
              <td><strong>${p.name}</strong></td>
              <td>${p.edad}a</td>
              <td><span class="dss-chip ${p.chip}">${p.chipLabel}</span></td>
              <td><span class="conf-chip">${p.conf}%</span></td>
              <td><span class="estado-chip ${p.estado.toLowerCase()}">${p.estado}</span></td>
              <td>
                <button class="btn-icon" onclick="App.openNotaModal('${p.id}')" title="Crear Nota">📝</button>
                <button class="btn-icon" onclick="App.openHistorialModal('${p.id}')" title="Ver Historial">📋</button>
                <button class="btn-icon" onclick="App.openEditPacienteModal('${p.id}')" title="Editar Perfil">✏️</button>
                <button class="btn-icon" onclick="App.navigate('plc', '${p.id}')" title="Evaluar">🧠</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  agenda() {
    return `<div class="workspace-inner">
      <div class="page-header">
        <div><div class="page-title">Agenda Clínica</div><div class="page-sub">${new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div>
        <button class="btn-primary" onclick="App.openAgendarModal()">+ Agendar Cita</button>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📅 Citas de Hoy</span></div>
          <div class="card-body" style="padding:12px 16px;">
            ${DB.agenda.map((c,i)=>`<div class="agenda-item-full" style="border-left:3px solid ${c.color};padding:14px 16px;border-radius:0 10px 10px 0;margin-bottom:10px;background:var(--surface-low);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-size:.9375rem;font-weight:700;color:var(--text);">${c.time} — ${c.name}</div>
                  <div style="font-size:.8125rem;color:var(--text-muted);margin-top:3px;">${c.tipo}</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="estado-chip ${c.estado.toLowerCase().replace(' ','-')}">${c.estado}</span>
                  <button class="btn-icon" onclick="App.openTeleconsultaModal()" title="Videollamada">📹</button>
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📊 Resumen Semanal</span></div>
          <div class="card-body">
            ${[['Lun','4',100],['Mar','3',75],['Mié','5',100],['Jue','2',50],['Vie','5',100],['Sáb','1',25]].map(([d,n,p])=>`
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <div style="width:32px;font-size:.75rem;font-weight:700;color:var(--text-muted);">${d}</div>
                <div style="flex:1;height:8px;background:var(--surface-high);border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${p}%;background:var(--primary-vivid);border-radius:99px;"></div>
                </div>
                <div style="width:20px;font-size:.75rem;font-weight:700;color:var(--text);">${n}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  tokens() {
    return `<div class="workspace-inner">
      <div class="page-header"><div><div class="page-title">Billetera de Tokens</div><div class="page-sub">Gestión de créditos para evaluaciones PLC</div></div></div>
      <div class="kpi-row">
        <div class="tokens-widget" style="grid-column:span 2;">
          <div class="tokens-label">Tokens Disponibles</div>
          <div class="tokens-val">42</div>
          <div class="tokens-bar"><div class="tokens-bar-fill" style="width:84%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;">
            <div style="font-size:.75rem;color:rgba(255,255,255,.6);">8 utilizados este mes</div>
            <div style="font-size:.75rem;color:rgba(255,255,255,.6);">Plan Oro · 50/mes</div>
          </div>
        </div>
        ${Views.kpi('Consumidos','8','⚡','c-gold','Este mes')}
        ${Views.kpi('Próx. Recarga','21 días','📅','c-blue','15 May 2026')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Historial de Uso</span></div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Paciente</th><th>Prueba</th><th>Tokens</th></tr></thead>
            <tbody>
              ${DB.pacientes.slice(0,5).map((p,i)=>`<tr>
                <td>${p.fecha}</td><td>${p.name}</td><td>${p.prueba}</td><td>-1 🪙</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  catalogo() {
    const sw = DB.catalogo.filter(c=>c.tipo==='software');
    const hw = DB.catalogo.filter(c=>c.tipo==='hardware');
    return `<div class="workspace-inner">
      <div class="page-header"><div><div class="page-title">Catálogo de Instrumentos</div><div class="page-sub">20 pruebas psicométricas y neurocognitivas · MecaPsi v3.3</div></div></div>
      <div class="catalog-grid-v33">
        <div class="cat-section-label">💻 Instrumentos Software (${sw.length})</div>
        ${sw.map(c=>`<div class="catalog-card-v33 ${c.flagship?'flagship':''}" onclick="${c.id==='plc'?"App.navigate('plc')":"App.showComingSoon('"+c.nombre+"')"}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <span class="cat33-icon">${c.icon}</span>
            <span class="cat33-tag ${c.estado==='activo'?'t-active':'t-soon'}">${c.estado==='activo'?'Activo':'Próximo'}</span>
          </div>
          <div class="cat33-name">${c.nombre}</div>
          <div class="cat33-desc">${c.desc}</div>
          <div class="cat33-tags">
            <span class="cat33-tag sw">Software</span>
            <span class="cat33-tag sw">${c.tiempo}</span>
          </div>
        </div>`).join('')}
        <div class="cat-section-label">⚙️ Instrumentos Hardware (${hw.length})</div>
        ${hw.map(c=>`<div class="catalog-card-v33 hardware-cat locked-cat" onclick="App.showComingSoon('${c.nombre}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <span class="cat33-icon">${c.icon}</span>
            <span class="cat33-tag t-soon">Próximo</span>
          </div>
          <div class="cat33-name">${c.nombre}</div>
          <div class="cat33-desc">${c.desc}</div>
          <div class="cat33-tags">
            <span class="cat33-tag hw">Hardware</span>
            ${c.hw_req?`<span class="cat33-tag hw">${c.hw_req}</span>`:''}
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  },

  teleconsulta() {
    return `<div class="workspace-inner">
      <div class="page-header"><div><div class="page-title">Teleconsulta</div><div class="page-sub">Módulo de videoconsulta clínica · Simulación WebRTC</div></div></div>
      <div class="grid-2" style="align-items:start;">
        <div class="teleconsulta-room">
          <div class="teleconsulta-video-main">
            <div style="text-align:center;">
              <div class="teleconsulta-avatar-big">👤</div>
              <div style="color:rgba(255,255,255,.4);font-size:.875rem;margin-top:12px;">Ramírez, C. A.</div>
              <div style="color:rgba(255,255,255,.25);font-size:.75rem;margin-top:4px;">Esperando conexión...</div>
            </div>
            <div class="teleconsulta-name-badge">Ramírez, C. A. — PAC-0041</div>
            <div class="teleconsulta-self-thumb">🧑‍⚕️</div>
          </div>
          <div class="teleconsulta-controls">
            <button class="tele-btn active" id="btn-mic" title="Micrófono" onclick="App.toggleTele(this)">🎤</button>
            <button class="tele-btn active" id="btn-cam" title="Cámara" onclick="App.toggleTele(this)">📷</button>
            <button class="tele-btn end" title="Terminar llamada" onclick="App.endCall()">📵</button>
            <button class="tele-btn inactive" title="Compartir pantalla">🖥️</button>
            <button class="tele-btn inactive" title="Chat" onclick="App.openTeleChat()">💬</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header"><span class="card-title">Ficha de Sesión</span></div>
            <div class="card-body" style="font-size:.875rem;">
              <div class="info-row"><span>Paciente:</span><strong>Ramírez, C. A.</strong></div>
              <div class="info-row"><span>Código:</span><code>PAC-0041</code></div>
              <div class="info-row"><span>Tipo:</span><strong>PLC v3 + Entrevista</strong></div>
              <div class="info-row"><span>Modalidad:</span><span class="badge-online">🔴 En línea</span></div>
              <div class="info-row"><span>Duración:</span><strong id="tele-timer">00:00</strong></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Notas de Sesión</span></div>
            <div class="card-body">
              <textarea id="tele-notes" style="width:100%;min-height:120px;resize:vertical;border:1px solid var(--outline-var);border-radius:8px;padding:10px;font-family:inherit;font-size:.875rem;" placeholder="Observaciones clínicas..."></textarea>
              <button class="btn-primary" style="margin-top:8px;width:100%;" onclick="App.saveTeleNotes()">💾 Guardar Notas</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  plc() {
    // Sin wrapper — el engine PLC llena todo el workspace directamente
    return `<div id="plc-container" style="min-height:100vh;"></div>`;
  },

  plcResultReal(res) {
    const m = res.metrics;
    const p = res.participant || {};
    const now = new Date().toLocaleString('es-CO',{dateStyle:'long',timeStyle:'short'});
    const cpColor = m.CP >= 80 ? '#16a34a' : m.CP >= 55 ? '#d97706' : '#dc2626';
    const cpLabel = m.CP >= 80 ? 'Óptimo' : m.CP >= 55 ? 'Moderado' : 'Deficitario';

    const html = `<div class="workspace-inner">

      <!-- ═══ HEADER RESULTADOS ═══ -->
      <div class="page-header">
        <div>
          <div class="page-title">📊 Resultados — Prueba de Líneas Cruzadas (PLC)</div>
          <div class="page-sub">
            <strong>${p.name || 'Evaluado'}</strong> &nbsp;·&nbsp; ID: ${p.id || '—'} &nbsp;·&nbsp;
            Edad: ${p.age || '—'} &nbsp;·&nbsp; ${p.gender || '—'} &nbsp;·&nbsp;
            Escolaridad: ${p.education || '—'} &nbsp;·&nbsp; Lateralidad: ${p.hand || '—'} &nbsp;·&nbsp;
            ${now}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="App.generateExcel()" style="background:linear-gradient(135deg,#16a34a,#15803d);">📊 Exportar Excel</button>
          <button class="btn-secondary" onclick="App.generatePDF()">📄 PDF</button>
          <button class="btn-secondary" onclick="App.navigate('plc')">🔄 Nueva Evaluación</button>
          <button class="btn-secondary" onclick="App.navigate('dashboard')">🏠 Inicio</button>
        </div>
      </div>

      <!-- ═══ KPIs PRINCIPALES ═══ -->
      <div class="kpi-row">
        ${Views.kpi('Aciertos (TA)', m.TA, '🎯', 'c-green', 'Total objetivos marcados')}
        ${Views.kpi('Omisiones (O)', m.O, '👁️', 'c-gold', 'Objetivos no marcados')}
        ${Views.kpi('Comisiones (C)', m.COM, '❌', 'c-red', 'Distractores marcados')}
        ${Views.kpi('CP %', m.CP.toFixed(1)+'%', '📈', 'c-purple', 'Índice de Concentración')}
        ${Views.kpi('CON', m.CON, '🧠', 'c-blue', 'Acierto Neto (TA−O−COM)')}
        ${Views.kpi('IVR', m.IVR.toFixed(2), '⚡', 'c-green', 'Vel./Error (impulsividad)')}
      </div>

      <!-- ═══ FILA 1: Perfil DSS + Clasificación MLP ═══ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Clasificación DSS -->
        <div class="card">
          <div class="card-header"><span class="card-title">🤖 Clasificación DSS / MLP</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="text-align:center;">
                <div style="font-size:2.5rem;font-weight:900;color:${cpColor};">${m.CP.toFixed(1)}%</div>
                <div style="font-size:.75rem;font-weight:700;color:${cpColor};text-transform:uppercase;">${cpLabel}</div>
              </div>
              <div style="flex:1;">
                <div style="height:12px;background:var(--surface-high);border-radius:99px;overflow:hidden;margin-bottom:8px;">
                  <div style="width:${Math.min(m.CP,100)}%;height:100%;background:${cpColor};border-radius:99px;transition:width 1s;"></div>
                </div>
                <span class="dss-chip ${res.chip}" style="font-size:.9375rem;padding:8px 16px;">${res.chipLabel}</span>
              </div>
            </div>
            <div style="font-size:.8125rem;color:var(--text-muted);padding:10px 14px;background:var(--surface-low);border-radius:8px;border-left:3px solid var(--primary-vivid);">
              <strong>Patrón Atencional:</strong> ${m.attnStyle} — ${m.attnDesc}
            </div>
            <div style="font-size:.8125rem;color:var(--text-muted);padding:10px 14px;background:var(--surface-low);border-radius:8px;">
              <strong>Redes cognitivas:</strong> ${m.focusType}
            </div>
            <div style="font-size:.8125rem;color:var(--text-muted);padding:10px 14px;background:var(--surface-low);border-radius:8px;">
              <strong>Confianza modelo:</strong> ${res.conf ? res.conf+'%' : (55 + Math.round(m.CP * 0.35)) + '%'}
            </div>
          </div>
        </div>

        <!-- Métricas extendidas -->
        <div class="card">
          <div class="card-header"><span class="card-title">📐 Métricas Cuantitativas</span></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              ${[
                ['Velocidad Proc.', Math.round(m.procSpeed)+' estím/min'],
                ['Estabilidad', Math.round(m.estabilidad)+'%'],
                ['TRM Monotonía', (m.TRM>=0?'+':'')+m.TRM.toFixed(1)+'%'],
                ['TR Medio', Math.round(m.meanRt)+' ms'],
                ['Varianza (VAR)', m.VAR.toFixed(1)+'%'],
                ['Tiempo Total', Math.round(m.totalTime)+' s'],
                ['Estím. / Línea', '47 (24 + 23)'],
                ['Total Blancos', res.linesData.reduce((a,l)=>a+l.targets_total,0)],
              ].map(([l,v]) => `<div style="background:var(--surface-low);border-radius:8px;padding:10px 12px;">
                <div style="font-size:1rem;font-weight:800;color:var(--text);">${v}</div>
                <div style="font-size:.6875rem;color:var(--text-muted);margin-top:2px;font-weight:600;">${l}</div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ FILA 2: Gráfica de Aciertos/Omisiones/Comisiones por Línea ═══ -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">📊 Aciertos, Omisiones y Comisiones por Línea</span>
          <span style="font-size:.75rem;color:var(--text-muted);">Desempeño detallado — 14 líneas de evaluación</span>
        </div>
        <div class="card-body">
          <canvas id="chart-lines" style="max-height:280px;"></canvas>
        </div>
      </div>

      <!-- ═══ FILA 3: Radar + Curva de Monotonía ═══ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Radar Perfil Cognitivo -->
        <div class="card">
          <div class="card-header"><span class="card-title">🕸️ Radar — Perfil Cognitivo</span></div>
          <div class="card-body" style="display:flex;justify-content:center;align-items:center;">
            <canvas id="chart-radar" style="max-height:260px;max-width:260px;"></canvas>
          </div>
        </div>

        <!-- Curva de Monotonía (tiempo por línea) -->
        <div class="card">
          <div class="card-header"><span class="card-title">📉 Curva de Monotonía (Tiempo por Línea)</span></div>
          <div class="card-body">
            <canvas id="chart-monotony" style="max-height:260px;"></canvas>
          </div>
        </div>
      </div>

      <!-- ═══ FILA 4: Exactitud % por Línea (sparkline) ═══ -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">📈 Exactitud (%) por Línea — Evolución de la Atención</span>
        </div>
        <div class="card-body">
          <canvas id="chart-accuracy" style="max-height:220px;"></canvas>
        </div>
      </div>

      <!-- ═══ NARRATIVA ═══ -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><span class="card-title">📝 Narrativa Técnica Automática</span></div>
        <div class="card-body">
          <div style="font-size:.875rem;color:var(--text-muted);line-height:1.8;background:var(--surface-low);border-radius:10px;padding:16px;">${res.narrative}</div>
        </div>
      </div>

      <!-- ═══ TABLA DESGLOSE POR LÍNEA ═══ -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><span class="card-title">📋 Desglose por Línea — Datos Completos</span></div>
        <div class="card-body" style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr>
              <th>Línea</th><th>Blancos</th><th>Aciertos</th><th>Omisiones</th><th>Comisiones</th>
              <th>Tiempo (s)</th><th>Exactitud %</th><th>Tiempo %</th><th>Estado</th>
            </tr></thead>
            <tbody>
              ${res.linesData.map(l => {
                const acc = ((l.aciertos/Math.max(l.targets_total,1))*100).toFixed(0);
                const estado = acc>=80?'🟢 Bueno':acc>=55?'🟡 Regular':'🔴 Bajo';
                return `<tr>
                  <td><strong>#${l.linea}</strong></td>
                  <td>${l.targets_total}</td>
                  <td style="color:var(--success);font-weight:700;">${l.aciertos}</td>
                  <td style="color:#d97706;">${l.omisiones}</td>
                  <td style="color:#dc2626;">${l.comisiones}</td>
                  <td>${l.tiempo_s.toFixed(1)}</td>
                  <td><strong>${acc}%</strong></td>
                  <td>${(l.tiempo_pct||0).toFixed(1)}%</td>
                  <td>${estado}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ DISCLAIMER ═══ -->
      <div style="background:#fefce8;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;font-size:.8125rem;color:#92400e;margin-bottom:16px;">
        ⚠️ <strong>NOTA DSS:</strong> Este informe describe parámetros biométricos observacionales generados por la Prueba de Líneas Cruzadas (PLC v3). <strong>No emite diagnósticos clínicos.</strong> La interpretación psicométrica es exclusiva del profesional evaluador certificado. RedCOLSI · MecaPsi v3.3
      </div>
    </div>`;

    // Renderizar gráficas después de que el DOM esté listo
    setTimeout(() => Views._renderPLCCharts(res), 80);
    return html;
  },

  /* ── Renderizado de Gráficas PLC ── */
  _renderPLCCharts(res) {
    if (typeof Chart === 'undefined') return;
    const m = res.metrics;
    const ld = res.linesData;
    const labels = ld.map(l => `L${l.linea}`);

    const palette = {
      green:  'rgba(22,163,74,0.85)',
      amber:  'rgba(217,119,6,0.85)',
      red:    'rgba(220,38,38,0.85)',
      blue:   'rgba(37,99,235,0.85)',
      purple: 'rgba(126,34,206,0.85)',
      teal:   'rgba(13,148,136,0.85)',
      greenBg: 'rgba(22,163,74,0.12)',
      blueBg:  'rgba(37,99,235,0.10)',
    };

    const tickFont = { family: 'Inter, sans-serif', size: 11 };
    const gridColor = 'rgba(0,0,0,0.06)';

    // ── 1. Bar Chart: Aciertos / Omisiones / Comisiones por línea ──
    const c1 = document.getElementById('chart-lines');
    if (c1) {
      new Chart(c1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Aciertos (TA)',    data: ld.map(l=>l.aciertos),   backgroundColor: palette.green },
            { label: 'Omisiones (O)',    data: ld.map(l=>l.omisiones),  backgroundColor: palette.amber },
            { label: 'Comisiones (COM)', data: ld.map(l=>l.comisiones), backgroundColor: palette.red   },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'top', labels: { font: tickFont, boxWidth: 14 } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { font: tickFont } },
            y: { grid: { color: gridColor }, ticks: { font: tickFont }, beginAtZero: true }
          }
        }
      });
    }

    // ── 2. Radar: Perfil Cognitivo ──
    const c2 = document.getElementById('chart-radar');
    if (c2) {
      const cp100 = Math.min(m.CP, 100);
      const estab = Math.min(m.estabilidad, 100);
      const vel   = Math.min((m.procSpeed/60)*100, 100); // norm a 60 estím/min = 100%
      const inh   = Math.max(0, 100 - (m.COM/Math.max(m.TA+m.COM,1))*100); // inhibición
      const cons  = Math.max(0, 100 - Math.abs(m.TRM));
      const prec  = ((m.TA / Math.max(m.TA+m.O,1))*100);

      new Chart(c2, {
        type: 'radar',
        data: {
          labels: ['Concentración', 'Estabilidad', 'Velocidad', 'Inhibición', 'Consistencia', 'Precisión'],
          datasets: [{
            label: res.participant?.name || 'Paciente',
            data: [cp100, estab, vel, inh, cons, prec],
            backgroundColor: 'rgba(37,99,235,0.15)',
            borderColor: palette.blue,
            borderWidth: 2,
            pointBackgroundColor: palette.blue,
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { stepSize: 25, font: { size: 9 }, display: false },
              pointLabels: { font: { size: 10, family: 'Inter, sans-serif' } },
              grid: { color: 'rgba(0,0,0,0.08)' },
              angleLines: { color: 'rgba(0,0,0,0.08)' },
            }
          }
        }
      });
    }

    // ── 3. Line Chart: Curva de Monotonía (tiempo por línea) ──
    const c3 = document.getElementById('chart-monotony');
    if (c3) {
      new Chart(c3, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Tiempo (s)',
            data: ld.map(l => +l.tiempo_s.toFixed(2)),
            borderColor: palette.purple,
            backgroundColor: 'rgba(126,34,206,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: palette.purple,
            fill: true,
            tension: 0.35,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { font: tickFont } },
            y: {
              grid: { color: gridColor }, ticks: { font: tickFont },
              title: { display: true, text: 'Segundos / Línea', font: tickFont }
            }
          }
        }
      });
    }

    // ── 4. Line Chart: Exactitud % por línea ──
    const c4 = document.getElementById('chart-accuracy');
    if (c4) {
      const accData = ld.map(l => +((l.aciertos/Math.max(l.targets_total,1))*100).toFixed(1));
      new Chart(c4, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Exactitud %',
              data: accData,
              borderColor: palette.green,
              backgroundColor: palette.greenBg,
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: accData.map(v => v>=80?palette.green:v>=55?palette.amber:palette.red),
              fill: true,
              tension: 0.3,
            },
            {
              label: 'Umbral Óptimo (80%)',
              data: Array(ld.length).fill(80),
              borderColor: 'rgba(22,163,74,0.4)',
              borderWidth: 1.5,
              borderDash: [6,4],
              pointRadius: 0,
              fill: false,
            },
            {
              label: 'Umbral Mínimo (55%)',
              data: Array(ld.length).fill(55),
              borderColor: 'rgba(217,119,6,0.4)',
              borderWidth: 1.5,
              borderDash: [4,3],
              pointRadius: 0,
              fill: false,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'top', labels: { font: tickFont, boxWidth: 14 } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { font: tickFont } },
            y: {
              min: 0, max: 100,
              grid: { color: gridColor }, ticks: { font: tickFont, callback: v => v+'%' },
              title: { display: true, text: 'Exactitud por Línea (%)', font: tickFont }
            }
          }
        }
      });
    }
  },

  adminMetrics() {
    return `<div class="workspace-inner">
      <div class="page-header"><div><div class="page-title">Métricas Globales</div><div class="page-sub">Vista Administrador — Todos los usuarios</div></div></div>
      <div class="kpi-row">
        ${Views.kpi('Usuarios','5','👤','c-gold','Registrados')}
        ${Views.kpi('Pacientes','47','👥','c-blue','Total sistema')}
        ${Views.kpi('Evaluaciones','287','🧠','c-green','Total histórico')}
        ${Views.kpi('Tokens Consumidos','245','🪙','c-purple','Este mes')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Especialistas del Sistema</span></div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>Especialista</th><th>Organización</th><th>Plan</th><th>Tokens</th><th>Estado</th></tr></thead>
            <tbody>
              ${DB.clientes.map(c=>`<tr>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.org}</td>
                <td><span class="badge-plan ${c.plan}">${c.planLabel}</span></td>
                <td>🪙 ${c.tokens}</td>
                <td><span class="estado-chip ${c.estado.toLowerCase().replace(' ','-')}">${c.estado}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  config(user) {
    return `<div class="workspace-inner">
      <div class="page-header"><div><div class="page-title">Configuración</div><div class="page-sub">Preferencias de cuenta y sistema</div></div></div>
      <div class="grid-2" style="align-items:start;">
        <div class="card">
          <div class="card-header"><span class="card-title">Mi Perfil</span></div>
          <div class="card-body" style="font-size:.875rem;">
            <div class="info-row"><span>Nombre:</span><strong>${user.name}</strong></div>
            <div class="info-row"><span>Rol:</span><strong>${user.role==='admin'?'Administrador':'Psicólogo'}</strong></div>
            <div class="info-row"><span>Organización:</span><strong>${user.org||'—'}</strong></div>
            <div class="info-row"><span>Plan:</span><strong>${user.plan||'Admin'}</strong></div>
            <div class="info-row"><span>Tokens:</span><strong>🪙 ${user.tokens_disponibles}</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Apariencia</span></div>
          <div class="card-body">
            <div class="pref-row">
              <div><div class="pref-label">Modo Oscuro</div><div class="pref-sub">Tema Neural Prism Dark</div></div>
              <label class="switch"><input type="checkbox" id="toggle-dark" onchange="App.toggleDark(this.checked)"><span class="slider round"></span></label>
            </div>
            <div class="pref-row" style="margin-top:12px;">
              <div><div class="pref-label">🌟 Bright Minds</div><div class="pref-sub">Modo infantil lúdico</div></div>
              <label class="switch"><input type="checkbox" id="toggle-bm" ${DB.state.brightMinds?'checked':''} onchange="App.toggleBrightMinds(this.checked)"><span class="slider round"></span></label>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  showComingSoon(name) {
    App.openModal(`${name}`, `<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:3rem;margin-bottom:16px;">🚧</div>
      <div style="font-size:1.125rem;font-weight:700;margin-bottom:8px;">Próximamente</div>
      <div style="color:var(--text-muted);">${name} estará disponible en una próxima actualización de MecaPsi.</div>
    </div>`, []);
  },

  showTokensModal() {
    App.openModal('🪙 Gestión Global de Tokens', `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="kpi-card c-gold">
          <div class="kpi-label" style="color:var(--text-muted);font-size:.75rem;font-weight:700;">Tokens Totales Emitidos</div>
          <div class="kpi-val" style="font-size:2rem;font-weight:900;">12,450</div>
        </div>
        <div class="login-field">
          <label style="display:block;margin-bottom:6px;font-size:.875rem;font-weight:600;">Asignar Tokens a Especialista</label>
          <select style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;background:var(--surface-white);color:var(--text);font-family:inherit;">
            ${DB.clientes.map(c => `<option>${c.nombre} (${c.org})</option>`).join('')}
          </select>
        </div>
        <div class="login-field">
          <label style="display:block;margin-bottom:6px;font-size:.875rem;font-weight:600;">Cantidad a Sumar</label>
          <input type="number" value="50" style="width:100%;padding:10px;border:1px solid var(--outline-var);border-radius:8px;background:var(--surface-white);color:var(--text);font-family:inherit;">
        </div>
      </div>
    `, [
      `<button class="btn-secondary" onclick="App.closeModal()">Cancelar</button>`,
      `<button class="btn-primary" onclick="App.closeModal(); App.toast('✅ Tokens asignados correctamente','success')">Asignar Tokens</button>`
    ]);
  }
};
