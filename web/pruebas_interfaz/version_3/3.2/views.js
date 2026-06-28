/* ═══════════════════════════════════════════════════════
   MecaPsi v3.1 — views.js
   Generadores de HTML para cada sección del SPA
   Reglas de Oro: DSS, lenguaje observacional, privacidad
═══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────
   HELPERS
──────────────────────────────────────── */
function chipHtml(chip, chipLabel) {
  return `<span class="dss-chip ${chip}"><span class="chip-dot"></span>${chipLabel}</span>`;
}
function confHtml(conf) {
  return `<div class="conf-wrap">
    <div class="conf-track"><div class="conf-fill" style="width:${conf}%"></div></div>
    <span class="conf-pct">${conf}%</span>
  </div>`;
}
function sedeKpi(sede) {
  const s = DB.sedes[sede];
  return s;
}
function sparklineSvg(trend, color = '#2563eb') {
  const W = 280, H = 60, pad = 6;
  const min = Math.min(...trend), max = Math.max(...trend), range = max - min || 1;
  const pts = trend.map((v, i) => {
    const x = pad + (i / (trend.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `M ${pts.split(' ')[0]} L ${pts} L ${(W - pad).toFixed(1)},${H} L ${pad},${H} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:60px;display:block;">
    <defs>
      <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity=".02"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#sg)"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${trend.map((v, i) => {
    const x = pad + (i / (trend.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
  }).join('')}
  </svg>`;
}

/* ────────────────────────────────────────
   DASHBOARD ADMIN
──────────────────────────────────────── */
function buildAdminDashboard() {
  const sede = DB.state.currentSede;
  const s = DB.sedes[sede];
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">🏛️ Dashboard Administrador</div>
      <div class="page-sub">
        MecaPsi Corp. · Vista macro del ecosistema · ${s.label}
      </div>
    </div>
    <div class="hdr-actions">
      <button class="btn-secondary" id="btn-export-exec">📊 Informe Ejecutivo</button>
      <button class="btn-gold"      id="btn-goto-billing">💳 Facturación</button>
    </div>
  </div>

  <!-- KPIs — 5 cols -->
  <div class="kpi-grid c5 anim anim-2" id="admin-kpis">
    <article class="kpi-card c-blue">
      <div class="kpi-hdr"><span class="kpi-lbl">Organizaciones</span><div class="kpi-icon i-blue">🏛️</div></div>
      <div class="kpi-val" id="k-orgs">${s.orgs}</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 1</span><span class="kpi-meta-txt">este mes</span></div>
    </article>
    <article class="kpi-card c-purple">
      <div class="kpi-hdr"><span class="kpi-lbl">Especialistas</span><div class="kpi-icon i-purple">👥</div></div>
      <div class="kpi-val" id="k-esp">${s.especialistas}</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 3</span><span class="kpi-meta-txt">activos</span></div>
    </article>
    <article class="kpi-card c-green">
      <div class="kpi-hdr"><span class="kpi-lbl">Pruebas (mes)</span><div class="kpi-icon i-green">🧪</div></div>
      <div class="kpi-val" id="k-pru">${s.pruebas.toLocaleString()}</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 48</span><span class="kpi-meta-txt">vs. anterior</span></div>
    </article>
    <article class="kpi-card c-gold">
      <div class="kpi-hdr"><span class="kpi-lbl">MRR</span><div class="kpi-icon i-gold">💰</div></div>
      <div class="kpi-val sm" id="k-mrr">${s.ingresos}</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 12%</span></div>
    </article>
    <article class="kpi-card c-teal">
      <div class="kpi-hdr"><span class="kpi-lbl">Precisión MLP</span><div class="kpi-icon i-teal">🤖</div></div>
      <div class="kpi-val" id="k-mlp">${s.precision}%</div>
      <div class="kpi-meta"><span class="kpi-meta-txt">1,000 ev. recientes</span></div>
    </article>
  </div>

  <!-- Tabla anónima + Panel derecho -->
  <div class="content-row anim anim-3">
    <article class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Actividad Reciente — Vista Admin</div>
          <div class="card-sub">⚠️ Modo Anónimo — identidades protegidas (RLS)</div>
        </div>
        <button class="btn-secondary" style="font-size:.8125rem;padding:7px 14px;" id="btn-ver-todo-admin">Ver todo</button>
      </div>
      <table>
        <thead><tr><th>ID Pac.</th><th>Especialista</th><th>Sede</th><th>Perfil DSS</th><th>Confianza</th><th>Acciones</th></tr></thead>
        <tbody>
          ${DB.pacientes.map(r => `
          <tr data-pac="${r.id}">
            <td><div class="td-anon">${r.id}</div></td>
            <td><div style="font-size:.75rem;color:var(--text-muted)">${r.esp}</div></td>
            <td><div style="font-size:.75rem;color:var(--text-muted)">${DB.sedes[DB.state.currentSede].label.split('—')[0].trim()}</div></td>
            <td>${chipHtml(r.chip, r.chipLabel)}</td>
            <td>${confHtml(r.conf)}</td>
            <td><div class="td-actions">
              <button class="btn-mini dl btn-dl" data-id="${r.id}">⬇ Export</button>
              <button class="btn-mini view btn-admin-detail" data-id="${r.id}">🔍 Log</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </article>

    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <!-- Suscripción -->
      <div class="subs-card">
        <div class="subs-plan">Estado de Suscripción</div>
        <div class="subs-name">Plan <span>Enterprise</span></div>
        <div class="subs-bar-wrap">
          <div class="subs-bar-labels">
            <span style="font-size:.6875rem;color:rgba(255,255,255,.6)">Capacidad usada</span>
            <span style="font-size:.6875rem;font-weight:700;color:var(--gold-vivid)">${s.capacidad}%</span>
          </div>
          <div class="subs-bar-track"><div class="subs-bar-fill" id="subs-bar-fill" style="width:${s.capacidad}%"></div></div>
        </div>
        <div class="subs-alert">
          ⚠️ 12 días para renovación —
          <button class="btn-goto-billing-inline">Renovar ahora</button>
        </div>
      </div>

      <!-- Donut DSS -->
      <div class="donut-panel">
        <div class="card-title" style="margin-bottom:var(--sp-2);">Distribución DSS</div>
        <svg viewBox="0 0 140 140" style="width:130px;height:130px;display:block;margin:0 auto;">
          <circle cx="70" cy="70" r="54" fill="none" stroke="#e6e8ea" stroke-width="20"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#16a34a" stroke-width="20" stroke-dasharray="148.5 211.4" stroke-dashoffset="0"    stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#d97706" stroke-width="20" stroke-dasharray="126.5 233.4" stroke-dashoffset="-148.5" stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#dc2626" stroke-width="20" stroke-dasharray="84.5 275.4"  stroke-dashoffset="-275"   stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <text x="70" y="66" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" font-weight="700" fill="#191c1e">1,432</text>
          <text x="70" y="79" text-anchor="middle" font-family="Inter,sans-serif" font-size="8"  fill="#4a4c5e">sesiones</text>
        </svg>
        <div class="donut-legend" style="margin-top:var(--sp-1);">
          <div class="donut-leg-item"><div class="leg-dot" style="background:#16a34a"></div><div class="leg-label">Normal</div><div class="leg-val">591</div><div class="leg-pct">41.3%</div></div>
          <div class="donut-leg-item"><div class="leg-dot" style="background:#d97706"></div><div class="leg-label">Seguimiento</div><div class="leg-val">504</div><div class="leg-pct">35.2%</div></div>
          <div class="donut-leg-item"><div class="leg-dot" style="background:#dc2626"></div><div class="leg-label">Prioritario</div><div class="leg-val">337</div><div class="leg-pct">23.5%</div></div>
        </div>
        <div class="dss-note" style="margin-top:var(--sp-2);">ℹ️ DSS — No diagnóstico. Apoyo al especialista.</div>
      </div>
    </div>
  </div>`;
}

/* ────────────────────────────────────────
   DASHBOARD PSICÓLOGO
──────────────────────────────────────── */
function buildPsicologoDashboard() {
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">🧠 Dashboard Clínico</div>
      <div class="page-sub">Dr. Pepito López · Sede Principal · Clínica Los Andes · Abril 2026</div>
    </div>
    <div class="hdr-actions">
      <button class="btn-secondary" id="btn-goto-agenda">📅 Mi Agenda</button>
      <button class="btn-primary"   id="btn-nueva-eval">+ Nueva Evaluación PLC</button>
    </div>
  </div>

  <div class="kpi-grid c4 anim anim-2">
    <article class="kpi-card c-blue">
      <div class="kpi-hdr"><span class="kpi-lbl">Mis Pacientes</span><div class="kpi-icon i-blue">👥</div></div>
      <div class="kpi-val">38</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 4</span><span class="kpi-meta-txt">este mes</span></div>
    </article>
    <article class="kpi-card c-green">
      <div class="kpi-hdr"><span class="kpi-lbl">Evaluaciones</span><div class="kpi-icon i-green">🧪</div></div>
      <div class="kpi-val">92</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 11</span><span class="kpi-meta-txt">vs. anterior</span></div>
    </article>
    <article class="kpi-card c-purple">
      <div class="kpi-hdr"><span class="kpi-lbl">Rep. Pendientes</span><div class="kpi-icon i-purple">📁</div></div>
      <div class="kpi-val">3</div>
      <div class="kpi-meta"><span class="kpi-trend down">▼ Revisión</span></div>
    </article>
    <article class="kpi-card c-orange">
      <div class="kpi-hdr"><span class="kpi-lbl">Citas Hoy</span><div class="kpi-icon i-orange">📅</div></div>
      <div class="kpi-val">4</div>
      <div class="kpi-meta"><span class="kpi-meta-txt">próxima: 10:30am</span></div>
    </article>
  </div>

  <div class="content-row anim anim-3">
    <article class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Actividad Reciente — Mis Pacientes</div>
          <div class="card-sub">Vista clínica completa · Solo tus evaluaciones</div>
        </div>
        <button class="btn-secondary" style="font-size:.8125rem;padding:7px 14px;" id="btn-goto-pac">Ver historial →</button>
      </div>
      <table>
        <thead><tr><th>Paciente</th><th>Prueba</th><th>Perfil DSS</th><th>Confianza IA</th><th>Acciones</th></tr></thead>
        <tbody>
          ${DB.pacientes.slice(0, 3).map(r => `
          <tr>
            <td><div class="td-name">${r.name}</div></td>
            <td><div style="font-size:.75rem;font-weight:500;color:var(--text-secondary)">${r.prueba}</div></td>
            <td>${chipHtml(r.chip, r.chipLabel)}</td>
            <td>${confHtml(r.conf)}</td>
            <td><div class="td-actions">
              <button class="btn-mini dl btn-dl"   data-id="${r.name}">⬇ Excel</button>
              <button class="btn-mini view btn-ver" data-id="${r.id}">👁 Ver</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </article>

    <article class="card" style="padding:var(--sp-3);">
      <div class="card-title" style="margin-bottom:var(--sp-2);">📅 Agenda de Hoy</div>
      ${DB.agenda.map(a => `
      <div class="agenda-item">
        <div class="agenda-time">${a.time}</div>
        <div class="agenda-dot" style="background:${a.color};box-shadow:0 0 6px ${a.color}66;"></div>
        <div class="agenda-info">
          <div class="agenda-name">${a.name}</div>
          <div class="agenda-prueba">${a.tipo}</div>
        </div>
        ${chipHtml(a.estado === 'Confirmada' ? 'dss-p0' : 'dss-p2', a.estado)}
      </div>`).join('')}
    </article>
  </div>

  <div class="dss-note anim anim-4">ℹ️ DSS — Apoyo a la decisión clínica. El especialista interpreta y decide.</div>`;
}

/* ────────────────────────────────────────
   PACIENTES (Psicólogo)
──────────────────────────────────────── */
function buildPacientes() {
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">👥 Mis Pacientes</div>
      <div class="page-sub">CRM Clínico · ${DB.pacientes.length} pacientes activos · Dr. Pepito López</div>
    </div>
    <button class="btn-primary" id="btn-add-pac">+ Nuevo Paciente</button>
  </div>
  <article class="card anim anim-2">
    <div class="card-header">
      <div class="card-title">Lista de Pacientes — Vista Clínica</div>
      <div style="position:relative;">
        <input id="search-pac" type="search" placeholder="🔍 Buscar paciente..."
          style="padding:7px 14px;border-radius:var(--r-sm);border:none;background:var(--surface-high);font-family:'Inter',sans-serif;font-size:.875rem;outline:none;" />
      </div>
    </div>
    <table id="pac-table">
      <thead><tr><th>Paciente</th><th>Edad</th><th>Última Eval.</th><th>Perfil DSS</th><th>Confianza</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody id="pac-tbody">
        ${DB.pacientes.map(r => `
        <tr data-name="${r.name.toLowerCase()}">
          <td><div class="td-name">${r.name}</div></td>
          <td><div style="font-size:.75rem;color:var(--text-muted)">${r.edad} años</div></td>
          <td><div style="font-size:.75rem;color:var(--text-muted)">${r.fecha}</div></td>
          <td>${chipHtml(r.chip, r.chipLabel)}</td>
          <td>${confHtml(r.conf)}</td>
          <td>${chipHtml(r.estado === 'Activo' ? 'dss-p0' : r.estado === 'Seguimiento' ? 'dss-p2' : 'dss-p7', r.estado)}</td>
          <td><div class="td-actions">
            <button class="btn-mini dl  btn-dl"  data-id="${r.name}">⬇ Reporte</button>
            <button class="btn-mini view btn-ver" data-id="${r.id}">👁 Historial</button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </article>`;
}

/* ────────────────────────────────────────
   AGENDA (Psicólogo)
──────────────────────────────────────── */
function buildAgenda() {
  const startHour = 8;
  const endHour = 18;
  let timelineHtml = `<div style="display:flex; flex-direction:column; gap:var(--sp-2);">`;
  
  for(let h=startHour; h<=endHour; h++) {
     const p = h >= 12 ? 'pm' : 'am';
     const h12 = h % 12 || 12;
     const timeLabel = `${h12}:00 ${p}`;
     
     const citasEnHora = DB.agenda.filter(a => {
        const match = a.time.match(/(\d+):(\d+)(am|pm)/);
        if(!match) return false;
        let cHour = parseInt(match[1]);
        if(match[3]==='pm' && cHour !== 12) cHour += 12;
        if(match[3]==='am' && cHour === 12) cHour -= 12;
        return cHour === h;
     });

     let slotsHtml = '';
     if(citasEnHora.length > 0) {
        slotsHtml = citasEnHora.map((a) => {
          const idx = DB.agenda.indexOf(a);
          return `
          <div class="agenda-item" onclick="document.querySelector('.btn-cita-detail[data-idx=\\'${idx}\\']')?.click()" style="cursor:pointer; flex:1; background:var(--surface-low); border-left:3px solid ${a.color}; border-radius:0 var(--r-sm) var(--r-sm) 0; position:relative;">
            <div class="agenda-time">${a.time}</div>
            <div class="agenda-info" style="margin-left:8px;">
              <div class="agenda-name">${a.name}</div>
              <div class="agenda-prueba">${a.tipo}</div>
            </div>
            ${chipHtml(a.estado === 'Confirmada' ? 'dss-p0' : 'dss-p2', a.estado)}
            <button class="btn-mini view btn-cita-detail" data-idx="${idx}" style="display:none;">Ver</button>
          </div>
        `}).join('');
     } else {
        slotsHtml = `<div style="flex:1; border-top:1px dashed var(--outline-var); margin-top:16px;"></div>`;
     }

     timelineHtml += `
      <div style="display:flex; gap:16px;">
        <div style="width:65px; text-align:right; font-size:.75rem; font-weight:700; color:var(--text-muted); padding-top:6px;">${timeLabel}</div>
        <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-height:40px;">
           ${slotsHtml}
        </div>
      </div>
     `;
  }
  timelineHtml += `</div>`;

  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">📅 Mi Agenda</div>
      <div class="page-sub">Dr. Pepito López · Hoy, Abril 18, 2026</div>
    </div>
    <div class="hdr-actions">
      <button class="btn-secondary" onclick="window.openModalCalendarioCompleto && window.openModalCalendarioCompleto()">📅 Ver Mes Completo</button>
      <button class="btn-primary" id="btn-add-cita" onclick="window.openModalNuevaCita && window.openModalNuevaCita()">+ Agendar Cita</button>
    </div>
  </div>

  <div class="content-row anim anim-2" style="grid-template-columns:1fr 300px;">
    <article class="card">
      <div class="card-header">
        <div class="card-title">Agenda Diaria — Diseño Reloj</div>
      </div>
      <div style="padding:var(--sp-2);">
        ${timelineHtml}
      </div>
    </article>

    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <article class="card" style="padding:var(--sp-3);background:linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(14,165,233,0.05) 100%);text-align:center;border-top:3px solid var(--primary-vivid);">
        <div style="font-size:2.5rem;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;letter-spacing:-1px;text-shadow:0 0 20px rgba(37,99,235,0.2);" id="live-clock">10:45</div>
        <div style="font-size:.8125rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;" id="live-date">JUEVES, 18 ABR 2026</div>
      </article>

      <article class="card" style="padding:var(--sp-3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-2);">
          <div class="card-title">📆 Abril 2026</div>
          <button style="border:1px solid var(--outline-var);background:var(--surface-high);color:var(--text-secondary);border-radius:var(--r-sm);padding:4px 10px;font-size:.6875rem;font-weight:600;cursor:pointer;">HOY</button>
        </div>
        ${buildMiniCalendar()}
      </article>
      <div class="dss-note">ℹ️ DSS — El psicólogo decide. MecaPsi solo apoya.</div>
    </div>
  </div>`;
}

function buildMiniCalendar() {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const dates = [
    [30, 31, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, 1, 2, 3]
  ];
  const busy = [8, 10, 14, 15, 17, 18, 22];
  const today = 18;
  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">`;
  days.forEach(d => {
    html += `<div style="font-size:.5625rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:2px 0;">${d}</div>`;
  });
  dates.flat().forEach(n => {
    const isToday = n === today;
    const isBusy = busy.includes(n) && n > 0 && n <= 30;
    const isOther = (n < 1 || n > 30);
    html += `<div style="
      padding:5px 2px; border-radius:6px; font-size:.75rem; font-weight:${isToday ? 700 : 500};
      color:${isOther ? 'var(--outline-var)' : isToday ? '#fff' : 'var(--text)'};
      background:${isToday ? 'var(--primary-vivid)' : isBusy ? 'var(--primary-fixed)' : 'transparent'};
      position:relative; cursor:${isOther ? 'default' : 'pointer'};
    ">${n > 0 && n <= 30 ? n : ''}
    ${isBusy && !isToday ? `<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--primary-vivid);"></div>` : ''}
    </div>`;
  });
  html += `</div>`;
  return html;
}

/* ────────────────────────────────────────
   CATÁLOGO
──────────────────────────────────────── */
function buildCatalogo(isAdmin) {
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">🧪 Catálogo de Pruebas Neurocognitivas</div>
      <div class="page-sub">Instrumentos DSS · Integridad Biométrica — Regla de Oro #3</div>
    </div>
    ${isAdmin ? `<button class="btn-gold" id="btn-manage-catalog">⚙️ Gestionar Catálogo</button>` : ''}
  </div>
  <div class="catalog-grid anim anim-2">
    <article class="catalog-card">
      <span class="cat-badge badge-active">✅ Activa</span>
      <div class="cat-icon">🧠</div>
      <div class="cat-name">PLC — Líneas Cruzadas</div>
      <div class="cat-desc">Evaluación de atención selectiva. Canvas HTML5, 32 variables biométricas, latencia ≈16ms. Modelo MLP v3 (97% precisión).</div>
      <div class="cat-meta"><span>~12 min</span><span class="sep">·</span><span>8 perfiles DSS</span><span class="sep">·</span><span>Canvas HTML5</span></div>
      ${!isAdmin ? `<button class="btn-primary" style="align-self:flex-start;margin-top:auto;padding:8px 16px;font-size:.8125rem;" id="btn-start-plc">Iniciar Evaluación →</button>` : ''}
    </article>
    <article class="catalog-card locked">
      <span class="cat-badge badge-soon">🔒 Próximamente</span>
      <div class="cat-icon">🛤️</div>
      <div class="cat-name">TMT — Trail Making Test</div>
      <div class="cat-desc">Velocidad de procesamiento y función ejecutiva. Telemetría de trayectoria de alta precisión.</div>
      <div class="cat-meta"><span>~8 min</span><span class="sep">·</span><span>Partes A & B</span><span class="sep">·</span><span>Q3 2026</span></div>
    </article>
    <article class="catalog-card locked">
      <span class="cat-badge badge-soon">🔒 Próximamente</span>
      <div class="cat-icon">🔣</div>
      <div class="cat-name">SDMT — Symbol Digit</div>
      <div class="cat-desc">Velocidad de procesamiento e información y memoria de trabajo con cronometría de alta resolución.</div>
      <div class="cat-meta"><span>~5 min</span><span class="sep">·</span><span>Q4 2026</span></div>
    </article>
  </div>
  <div class="dss-note anim anim-3">ℹ️ Integridad Biométrica: precisión en milisegundos. Ningún instrumento genera diagnósticos — son DSS.</div>`;
}

/* ────────────────────────────────────────
   FACTURACIÓN (Admin exclusivo)
──────────────────────────────────────── */
function buildFacturacion() {
  const b = DB.billing || {
    capacidadUsada: 3400, capacidadTotal: 4000, mrr: 18400, renovacionFecha: '12 May, 2026',
    historial: [
      { mes: 'Mar 2026', monto: '$280.000', estado: 'Pagado', pdf: 'F-2026-03' },
      { mes: 'Feb 2026', monto: '$280.000', estado: 'Pagado', pdf: 'F-2026-02' }
    ]
  };
  const pct = Math.round((b.capacidadUsada / b.capacidadTotal) * 100);
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">💳 Facturación & Suscripciones</div>
      <div class="page-sub">Panel exclusivo Admin · MecaPsi Corp. — Enterprise</div>
    </div>
    <button class="btn-gold" id="btn-cambiar-plan">🔄 Actualizar Plan</button>
  </div>

  <div class="kpi-grid c4 anim anim-2">
    <article class="kpi-card c-gold"><div class="kpi-hdr"><span class="kpi-lbl">MRR Total</span><div class="kpi-icon i-gold">💰</div></div><div class="kpi-val sm">$${b.mrr.toLocaleString()}</div><div class="kpi-meta"><span class="kpi-trend up">▲ 12%</span></div></article>
    <article class="kpi-card c-green"><div class="kpi-hdr"><span class="kpi-lbl">Orgs. Activas</span><div class="kpi-icon i-green">🏛️</div></div><div class="kpi-val">3</div><div class="kpi-meta"><span class="kpi-meta-txt">Plan Enterprise</span></div></article>
    <article class="kpi-card c-red"><div class="kpi-hdr"><span class="kpi-lbl">Próx. Renovación</span><div class="kpi-icon i-blue">📅</div></div><div class="kpi-val">12<small style="font-size:1rem;font-weight:500"> días</small></div><div class="kpi-meta"><span class="kpi-trend down">⚠️ ${b.renovacionFecha}</span></div></article>
    <article class="kpi-card c-orange"><div class="kpi-hdr"><span class="kpi-lbl">Uso Capacidad</span><div class="kpi-icon i-orange">📊</div></div><div class="kpi-val">${pct}%</div><div class="kpi-meta"><span class="kpi-meta-txt">${b.capacidadUsada.toLocaleString()} / ${b.capacidadTotal.toLocaleString()} ev.</span></div></article>
  </div>

  <div class="content-row anim anim-3" style="grid-template-columns:1fr 320px;">
    <!-- Historial -->
    <article class="card">
      <div class="card-header">
        <div class="card-title">Historial de Facturación</div>
        <div class="card-sub">Últimas 5 facturas</div>
      </div>
      <table>
        <thead><tr><th>Período</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          ${b.historial.map(h => `
          <tr>
            <td>${h.mes}</td>
            <td style="font-weight:700;">${h.monto}</td>
            <td>${chipHtml(h.estado === 'Pagado' ? 'dss-p0' : 'dss-p2', h.estado)}</td>
            <td><button class="btn-mini dl btn-dl-factura" data-pdf="${h.pdf}">⬇ PDF</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </article>

    <!-- Subs card -->
    <div class="subs-card" style="align-self:start;">
      <div class="subs-plan">Plan Actual</div>
      <div class="subs-name">Plan <span>Enterprise</span></div>
      <div style="font-size:.6875rem;color:rgba(255,255,255,.5);margin-bottom:var(--sp-2);">3 Orgs · hasta 4,000 ev./mes</div>
      <div class="subs-bar-wrap">
        <div class="subs-bar-labels">
          <span style="color:rgba(255,255,255,.6)">Capacidad</span>
          <span style="color:var(--gold-vivid);font-weight:700;">${pct}%</span>
        </div>
        <div class="subs-bar-track"><div class="subs-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="subs-alert" style="margin-top:var(--sp-2);">
        ⚠️ Renueva antes del ${b.renovacionFecha}
      </div>
      <button class="btn-gold" style="margin-top:var(--sp-2);width:100%;justify-content:center;" id="btn-renovar">🔄 Renovar Enterprise</button>
    </div>
  </div>`;
}

/* ────────────────────────────────────────
   TENDENCIAS IA-DSS
──────────────────────────────────────── */
function buildTendencias(isAdmin) {
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">📈 Tendencias IA-DSS</div>
      <div class="page-sub">Rendimiento Modelo MLP v3 · 1,000 evaluaciones recientes</div>
    </div>
  </div>
  <div class="content-row anim anim-2">
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
      <div class="mlp-chart">
        <div class="card-title">🤖 Exactitud Modelo MLP</div>
        <div class="card-sub" style="margin-top:2px;font-size:.75rem;color:var(--text-muted);">14,000 muestras sintéticas · 97.5% Train · 97.0% Val · Convergencia &lt;10 épocas</div>
        <div class="mlp-accuracy-bar">
          <div class="mlp-pct-label" style="color:var(--text);">97.5%</div>
          <div class="mlp-bar-wrap">
            <div class="mlp-bar-track"><div class="mlp-bar-fill" style="width:97.5%"></div></div>
            <div class="mlp-bar-sub">Exactitud global — 2,800 muestras independientes</div>
          </div>
        </div>
        ${[
      { lbl: 'P0 — Base Normativa', pct: 98.8, color: '#16a34a' },
      { lbl: 'P1 — Latencia Sostenida', pct: 97.2, color: '#006591' },
      { lbl: 'P2 — Alta Reactividad', pct: 96.5, color: '#d97706' },
      { lbl: 'P3 — Varianza Bilateral', pct: 95.1, color: '#7c3aed' },
      { lbl: 'P6 — Alta Eficiencia', pct: 99.1, color: '#2563eb' },
      { lbl: 'P7 — Perfil Complejo', pct: 93.4, color: '#dc2626' },
    ].map(p => `
        <div style="display:flex;align-items:center;gap:var(--sp-1);margin-bottom:6px;">
          <div style="width:170px;font-size:.6875rem;font-weight:500;color:var(--text-secondary);flex-shrink:0;">${p.lbl}</div>
          <div style="flex:1;height:6px;background:var(--surface-high);border-radius:3px;overflow:hidden;">
            <div style="width:${p.pct}%;height:100%;background:${p.color};border-radius:3px;"></div>
          </div>
          <div style="font-size:.6875rem;font-weight:700;min-width:38px;text-align:right;font-variant-numeric:tabular-nums;">${p.pct}%</div>
        </div>`).join('')}
        <div class="mlp-metrics" style="margin-top:var(--sp-2);">
          <div class="mlp-metric"><div class="mlp-metric-val" style="color:var(--success);">97.5%</div><div class="mlp-metric-lbl">Train Acc.</div></div>
          <div class="mlp-metric"><div class="mlp-metric-val" style="color:var(--primary-vivid);">97.0%</div><div class="mlp-metric-lbl">Val. Acc.</div></div>
          <div class="mlp-metric"><div class="mlp-metric-val">&lt;10</div><div class="mlp-metric-lbl">Épocas conv.</div></div>
        </div>
      </div>
      <div class="dss-note">ℹ️ Regla de Oro: La IA expone biomarcadores. El psicólogo interpreta y decide.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <div class="donut-panel">
        <div class="card-title" style="margin-bottom:var(--sp-2);">Perfiles — 1,000 ev.</div>
        <svg viewBox="0 0 140 140" style="width:130px;height:130px;display:block;margin:0 auto;">
          <circle cx="70" cy="70" r="54" fill="none" stroke="#e6e8ea" stroke-width="20"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#16a34a" stroke-width="20" stroke-dasharray="148.5 211.4" stroke-dashoffset="0"    stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#d97706" stroke-width="20" stroke-dasharray="126.5 233.4" stroke-dashoffset="-148.5" stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#dc2626" stroke-width="20" stroke-dasharray="84.5 275.4"  stroke-dashoffset="-275"   stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <text x="70" y="66" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" font-weight="700" fill="#191c1e">1,000</text>
          <text x="70" y="79" text-anchor="middle" font-family="Inter,sans-serif" font-size="8"  fill="#4a4c5e">evaluaciones</text>
        </svg>
        <div class="donut-legend" style="margin-top:var(--sp-1);">
          <div class="donut-leg-item"><div class="leg-dot" style="background:#16a34a"></div><div class="leg-label">Normal</div><div class="leg-val">413</div><div class="leg-pct">41.3%</div></div>
          <div class="donut-leg-item"><div class="leg-dot" style="background:#d97706"></div><div class="leg-label">Seguimiento</div><div class="leg-val">352</div><div class="leg-pct">35.2%</div></div>
          <div class="donut-leg-item"><div class="leg-dot" style="background:#dc2626"></div><div class="leg-label">Prioritario</div><div class="leg-val">235</div><div class="leg-pct">23.5%</div></div>
        </div>
      </div>
      ${isAdmin ? `
      <div class="subs-card">
        <div class="subs-plan">Infraestructura & Latencia</div>
        <div class="subs-name">Stack <span>&lt;200ms</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:var(--sp-1);">
          ${[
        { lbl: 'Interacción Edge', val: '0–5ms' },
        { lbl: 'Inferencia IA', val: '<20ms' },
        { lbl: 'API FastAPI', val: '<200ms' },
        { lbl: 'Canvas 60fps', val: '~16ms' },
      ].map(m => `<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:.875rem;font-weight:800;color:#fff;">${m.val}</div>
            <div style="font-size:.5625rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.4);margin-top:2px;">${m.lbl}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </div>`;
}

/* ────────────────────────────────────────
   ESTADO VACÍO / COMING SOON
──────────────────────────────────────── */
function buildComingSoon(title, icon) {
  return `
  <div class="empty-state anim anim-1">
    <div class="empty-icon">${icon || '🚧'}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-sub">Módulo en desarrollo · Fase Beta RedCOLSI 2026</div>
  </div>`;
}

/* ────────────────────────────────────────
   SUSCRIPCIONES / GESTIÓN DE CLIENTES (Admin)
──────────────────────────────────────── */
function buildSuscripciones() {
  const total = DB.clientes.length;
  const alDia = DB.clientes.filter(c => c.estado === 'Al día').length;
  const porVencer = DB.clientes.filter(c => c.estado === 'Por vencer').length;
  const vencidos = DB.clientes.filter(c => c.estado === 'Vencido').length;
  const mrr = DB.clientes.reduce((s, c) => s + c.montoCOP, 0);
  const oros = DB.clientes.filter(c => c.plan === 'oro').length;
  const platas = DB.clientes.filter(c => c.plan === 'plata').length;
  const bronces = DB.clientes.filter(c => c.plan === 'bronce').length;

  function tierBadge(plan) {
    if (plan === 'oro') return `<span style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;letter-spacing:.5px;">🥇 ORO</span>`;
    if (plan === 'plata') return `<span style="display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;letter-spacing:.5px;">🥈 PLATA</span>`;
    if (plan === 'bronce') return `<span style="display:inline-flex;align-items:center;gap:5px;background:#fff7ed;color:#92400e;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;letter-spacing:.5px;">🥉 BRONCE</span>`;
    return '';
  }
  function statusBadge(c) {
    if (c.diasRestantes < 0) return chipHtml('dss-p7', 'Vencido');
    if (c.diasRestantes <= 7) return chipHtml('dss-p2', `Por vencer · ${c.diasRestantes}d`);
    return chipHtml('dss-p0', `Al día · ${c.diasRestantes}d`);
  }

  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">👑 Gestión de Suscripciones</div>
      <div class="page-sub">Control de Acceso Oro / Plata / Bronce · ${total} clientes activos</div>
    </div>
    <div class="hdr-actions">
      <button class="btn-secondary" id="btn-export-subs">📊 Exportar Reporte</button>
      <button class="btn-gold" id="btn-nuevo-cliente">+ Nuevo Cliente</button>
    </div>
  </div>

  <div class="kpi-grid c5 anim anim-2">
    <article class="kpi-card c-gold">
      <div class="kpi-hdr"><span class="kpi-lbl">MRR Total</span><div class="kpi-icon i-gold">💰</div></div>
      <div class="kpi-val sm" style="font-size:1.375rem;">$${(mrr / 1000).toFixed(0)}k</div>
      <div class="kpi-meta"><span class="kpi-trend up">▲ 12%</span><span class="kpi-meta-txt">vs. anterior</span></div>
    </article>
    <article class="kpi-card c-green">
      <div class="kpi-hdr"><span class="kpi-lbl">Al Día</span><div class="kpi-icon i-green">✅</div></div>
      <div class="kpi-val">${alDia}</div>
      <div class="kpi-meta"><span class="kpi-meta-txt">de ${total} clientes</span></div>
    </article>
    <article class="kpi-card c-orange">
      <div class="kpi-hdr"><span class="kpi-lbl">Por Vencer</span><div class="kpi-icon i-orange">⚠️</div></div>
      <div class="kpi-val">${porVencer}</div>
      <div class="kpi-meta"><span class="kpi-trend down">≤ 7 días</span></div>
    </article>
    <article class="kpi-card c-red">
      <div class="kpi-hdr"><span class="kpi-lbl">Vencidos</span><div class="kpi-icon i-blue">🔴</div></div>
      <div class="kpi-val">${vencidos}</div>
      <div class="kpi-meta"><span class="kpi-trend down">Acción requerida</span></div>
    </article>
    <article class="kpi-card c-blue">
      <div class="kpi-hdr"><span class="kpi-lbl">Dist. Tiers</span><div class="kpi-icon i-blue">📊</div></div>
      <div class="kpi-val" style="font-size:1rem;font-weight:700;line-height:1.8;">
        <span title="Oro">🥇${oros}</span>&nbsp;
        <span title="Plata">🥈${platas}</span>&nbsp;
        <span title="Bronce">🥉${bronces}</span>
      </div>
      <div class="kpi-meta"><span class="kpi-meta-txt">${total} total</span></div>
    </article>
  </div>

  <article class="card anim anim-3">
    <div class="card-header">
      <div>
        <div class="card-title">Directorio de Clientes — Niveles de Acceso</div>
        <div class="card-sub">🥇 Oro = Acceso Completo &nbsp;·&nbsp; 🥈 Plata = Estándar &nbsp;·&nbsp; 🥉 Bronce = Básico</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Cliente</th><th>Organización</th><th>Plan</th><th>Evaluaciones</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${DB.clientes.map(c => `
        <tr>
          <td><div class="td-name">${c.nombre}</div></td>
          <td><div style="font-size:.75rem;color:var(--text-muted);">${c.org}</div></td>
          <td>${tierBadge(c.plan)}</td>
          <td>
            <div style="font-size:.875rem;font-weight:700;">${c.evaluaciones}</div>
            <div style="font-size:.625rem;color:var(--text-muted);">Límite: ${c.limiteEval}</div>
          </td>
          <td>
            <div style="font-size:.8125rem;font-weight:600;">${c.vence}</div>
            <div style="font-size:.625rem;color:${c.diasRestantes < 0 ? 'var(--error)' : c.diasRestantes <= 7 ? 'var(--warning)' : 'var(--success)'};">
              ${c.diasRestantes < 0 ? 'Vencido hace ' + Math.abs(c.diasRestantes) + 'd' : c.diasRestantes + ' días restantes'}
            </div>
          </td>
          <td>${statusBadge(c)}</td>
          <td>
            <div class="td-actions">
              <button class="btn-mini view btn-cliente-detail" data-id="${c.id}">🔍 Ver</button>
              <button class="btn-mini dl" onclick="window.toast('📧 Recordatorio enviado','success')">📧 Notificar</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </article>

  <div class="catalog-grid anim anim-4" style="margin-top:var(--sp-3);">
    ${DB.planes.map(p => `
    <article class="catalog-card" style="border-top:3px solid ${p.color};">
      <span class="cat-badge" style="background:${p.bg};color:${p.dark};">${p.emoji} ${p.label}</span>
      <div class="cat-icon">${p.emoji}</div>
      <div class="cat-name">${p.precio}</div>
      <div class="cat-desc">${p.descripcion}</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:var(--sp-1);">
        ${p.features.map(f => `<div style="font-size:.75rem;color:var(--text-secondary);display:flex;gap:6px;"><span style="color:var(--success);">✓</span>${f}</div>`).join('')}
      </div>
      <div class="cat-meta" style="margin-top:auto;">
        <span>${DB.clientes.filter(c => c.plan === p.id).length} clientes activos</span>
      </div>
    </article>`).join('')}
  </div>

  <div class="dss-note anim anim-5">ℹ️ DSS — Los planes controlan el volumen de acceso, no la calidad del análisis clínico.</div>`;
}

/* ────────────────────────────────────────
   MI PLAN (Psicólogo)
──────────────────────────────────────── */
function buildMiPlan() {
  const u = DB.users.pepito;
  const plan = DB.planes.find(p => p.id === u.plan) || DB.planes[1];
  const cliente = DB.clientes.find(c => c.plan === u.plan);
  const evalUsadas = cliente ? cliente.evaluaciones : 92;
  const evalLimite = u.plan === 'oro' ? 9999 : u.plan === 'plata' ? 200 : 50;
  const pctUso = Math.min(Math.round((evalUsadas / evalLimite) * 100), 100);

  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">${plan.emoji} Mi Plan & Suscripción</div>
      <div class="page-sub">Dr. Pepito López · ${plan.label} · Vence ${u.planVence}</div>
    </div>
    <div class="hdr-actions">
      <button class="btn-gold" id="btn-upgrade-plan">⬆️ Mejorar Plan</button>
    </div>
  </div>

  <div class="content-row anim anim-2" style="grid-template-columns:1fr 320px;">
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <article class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${plan.emoji} ${plan.label}</div>
            <div class="card-sub">Suscripción activa · Renovación automática</div>
          </div>
          ${chipHtml('dss-p0', 'Activo')}
        </div>
        <div style="padding:var(--sp-2) 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:.75rem;font-weight:600;color:var(--text-secondary);">Evaluaciones usadas este mes</span>
            <span style="font-size:.75rem;font-weight:700;color:var(--primary);">${evalUsadas} / ${u.plan === 'oro' ? 'Ilimitadas' : evalLimite}</span>
          </div>
          ${u.plan !== 'oro' ? `
          <div style="background:var(--surface-high);border-radius:var(--r-pill);height:8px;overflow:hidden;">
            <div style="width:${pctUso}%;height:100%;background:${pctUso >= 90 ? 'var(--error)' : 'var(--primary-vivid)'};border-radius:var(--r-pill);"></div>
          </div>
          <div style="font-size:.625rem;color:var(--text-muted);margin-top:4px;">Quedan ${evalLimite - evalUsadas} evaluaciones</div>` : `
          <div style="font-size:.8125rem;color:var(--success);font-weight:600;">✓ Plan Oro — Evaluaciones ilimitadas</div>`}
        </div>
        <div style="border-top:1px solid var(--outline-var);padding-top:var(--sp-2);">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-muted);margin-bottom:var(--sp-1);">Incluido en tu plan</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            ${plan.features.map(f => `<div style="display:flex;gap:6px;align-items:flex-start;font-size:.8125rem;color:var(--text-secondary);"><span style="color:var(--success);">✓</span>${f}</div>`).join('')}
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <div class="card-title">Historial de Pagos</div>
          <div class="card-sub">Últimos 3 meses</div>
        </div>
        <table>
          <thead><tr><th>Período</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            ${DB.clientes[0].pagos.map(p => `
            <tr>
              <td>${p.mes}</td>
              <td style="font-weight:700;">${p.monto}</td>
              <td>${chipHtml(p.estado === 'Pagado' ? 'dss-p0' : 'dss-p2', p.estado)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </article>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <div class="subs-card">
        <div class="subs-plan">Mi Suscripción</div>
        <div class="subs-name">Plan <span>${plan.label.replace('Plan ', '')}</span></div>
        <div style="font-size:.6875rem;color:rgba(255,255,255,.55);margin-bottom:var(--sp-2);">${u.org} · ${u.cargo}</div>
        <div class="subs-bar-wrap">
          <div class="subs-bar-labels">
            <span style="color:rgba(255,255,255,.6);">Vence en</span>
            <span style="font-weight:700;color:var(--gold-vivid);">${u.planDias} días</span>
          </div>
          <div class="subs-bar-track"><div class="subs-bar-fill" style="width:${Math.round((u.planDias / 30) * 100)}%"></div></div>
        </div>
        <div class="subs-alert" style="margin-top:var(--sp-2);">📅 Próxima renovación: ${u.planVence}</div>
        <button class="btn-gold" style="margin-top:var(--sp-2);width:100%;justify-content:center;" id="btn-upgrade-plan">⬆️ Mejorar Plan</button>
      </div>
      ${DB.planes.filter(p => p.id !== u.plan).map(p => `
      <div style="background:var(--surface-card);border-radius:var(--r-sm);padding:var(--sp-2);border:1px solid var(--outline-var);border-top:3px solid ${p.color};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-1);">
          <span style="font-weight:700;">${p.emoji} ${p.label}</span>
          <span style="font-size:.8125rem;color:var(--primary);font-weight:700;">${p.precio}</span>
        </div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:var(--sp-1);">${p.descripcion}</div>
        <button onclick="toast('📧 Solicitud de upgrade a ${p.label} enviada.','success')" style="font-size:.75rem;padding:6px 12px;background:var(--surface-high);border:1px solid var(--outline-var);border-radius:var(--r-sm);cursor:pointer;color:var(--text-secondary);font-family:'Inter',sans-serif;">Ver detalles →</button>
      </div>`).join('')}
    </div>
  </div>

  <div class="dss-note anim anim-3">ℹ️ Los planes definen el volumen de pruebas disponibles, no la calidad del análisis DSS.</div>`;
}

/* ────────────────────────────────────────
   11. CONFIGURAICÓN & PERFIL (Todos los roles)
──────────────────────────────────────── */
function buildConfig(isAdmin) {
  const u = DB.state.currentUser;
  return `
  <div class="page-header anim anim-1">
    <div>
      <div class="page-title">⚙️ Configuración & Preferencias</div>
      <div class="page-sub">Ajustes personales para ${u.name} · ${u.cargo}</div>
    </div>
    <button class="btn-primary" id="btn-save-config">💾 Guardar Cambios</button>
  </div>
  
  <div class="content-row anim anim-2" style="grid-template-columns: 1fr 1fr;">
    <article class="card">
      <div class="card-header">
        <div class="card-title">Perfil de Especialista</div>
      </div>
      <div style="padding: 0 var(--sp-3) var(--sp-3);">
        <div class="field-row">
          <div class="field"><label>Nombres y Apellidos</label><input type="text" value="${u.name}" /></div>
          <div class="field"><label>Iniciales</label><input type="text" value="${u.initials}" /></div>
        </div>
        <div class="field">
          <label>Cargo / Rol</label>
          <input type="text" value="${u.cargo}" disabled style="background:var(--surface-low);color:var(--text-muted);" />
        </div>
        <div class="field">
          <label>Email de Acceso</label>
          <input type="email" value="${u.username}@mecapsi.com" disabled style="background:var(--surface-low);color:var(--text-muted);" />
        </div>
        <div class="field-row">
          <div class="field"><label>Nueva Contraseña</label><input type="password" placeholder="••••••••" /></div>
          <div class="field"><label>Confirmar</label><input type="password" placeholder="••••••••" /></div>
        </div>
      </div>
    </article>

    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      <article class="card" style="padding:var(--sp-3);">
        <div class="card-title" style="margin-bottom:var(--sp-2)">Apariencia y Sistema</div>
        
        <div class="field">
          <label>Tema del Entorno</label>
          <select id="inp-cfg-theme">
            <option value="auto">Automático (Sistema)</option>
            <option value="light">Modo Claro Clínico</option>
            <option value="dark">Modo Oscuro (Concentración)</option>
            <option value="neural" selected>Neural Prism (Moderno)</option>
          </select>
        </div>

        <div class="field">
          <label>Notificaciones</label>
          <div style="display:flex;gap:var(--sp-2);flex-direction:column;">
            <label style="display:flex;align-items:center;gap:6px;font-size:.875rem;cursor:pointer;"><input type="checkbox" id="inp-cfg-notif-cri" checked /> Alertas DSS Críticas</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.875rem;cursor:pointer;"><input type="checkbox" id="inp-cfg-notif-res" checked /> Resumen Semanal de Actividad</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.875rem;cursor:pointer;"><input type="checkbox" id="inp-cfg-notif-ren" /> Alertas de Renovación de Plan</label>
          </div>
        </div>
      </article>
      
      <div class="dss-note">
        ℹ️ <strong>Arquitectura Escalable</strong><br/>
        En futuras iteraciones del ecosistema, los ajustes de apariencia se sincronizarán mediante la base de datos distribuida en el backend, recordando las preferencias del usuario (modo oscuro, alertas) en toda la infraestructura de microservicios o contenedores.
      </div>
    </div>
  </div>`;
}
