/* MecaPsi v3.3 — plc-engine.js (Motor Real PLC)
   Fase 2: + Selector de paciente, Fullscreen, Pantalla de bloqueo, Excel
   Requiere: stimuli.js, metrics.js cargados antes */

const PLCEngine = (() => {

  const TOTAL_LINES = 14, TIME_PER_LINE = 20, CHARS = 47;
  const SPLIT = 24; // row1=0..23, row2=24..46

  let S = { // estado interno
    screen: 'pretest', // pretest | practice | test | done
    participant: null,
    testLines: [], linesData: [], clickLog: [],
    currentLine: 0,
    charBtns: [], currentSels: new Set(),
    lineStartTime: null, timerInterval: null,
    preButtons: [], preOk: 0,
    onComplete: null, containerId: null
  };

  /* ── Colores Neural Prism ─────── */
  const FG = '#1A1A2E', BG = '#FFFFFF';
  const FG_BRIGHT = '#0f172a';
  const BG_BRIGHT = '#fdf4ff';

  function isBright() { return document.body.classList.contains('bright-minds'); }
  function fg() { return isBright() ? FG_BRIGHT : FG; }
  function bg() { return isBright() ? BG_BRIGHT : BG; }

  /* ── Render en contenedor ─────── */
  function render(html) {
    const el = document.getElementById(S.containerId);
    if (el) el.innerHTML = html;
  }

  /* ══════════════════════════════════════════
     PANTALLA 1 — PRE-PRUEBA (instrucciones)
  ══════════════════════════════════════════ */
  function showPreTest() {
    S.screen = 'pretest';
    render(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;padding:8px 0;">

        <!-- Panel izquierdo: TARGET -->
        <div style="background:var(--surface-low);border:2px solid var(--primary-vivid);border-radius:16px;padding:28px;text-align:center;">
          <div style="font-weight:800;color:var(--primary);font-size:1.0625rem;margin-bottom:20px;">🎯 Símbolo Objetivo</div>
          <div style="background:var(--surface-white);border-radius:12px;padding:24px;display:inline-block;box-shadow:var(--shadow-card);">
            <canvas id="plc-target-canvas" width="120" height="160"></canvas>
          </div>
          <p style="font-size:.875rem;color:var(--primary);font-weight:600;margin-top:16px;line-height:1.5;">
            Este es el <strong>único</strong> símbolo que deberás marcar.<br>Memorízalo bien.
          </p>
          <div style="margin-top:12px;background:var(--primary-fixed);border-radius:8px;padding:10px 14px;font-size:.75rem;color:var(--text-muted);text-align:left;border-left:3px solid var(--primary-vivid);">
            <strong>Referencia:</strong> Cruz con cuadrado negro <u>solo</u> en los extremos <strong>izquierdo y derecho</strong>. La línea horizontal exactamente al centro.
          </div>
        </div>

        <!-- Panel derecho: instrucciones -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="font-weight:800;color:var(--text);font-size:1.0625rem;border-bottom:2px solid var(--surface-high);padding-bottom:12px;">📋 Reglas de Ejecución</div>

          ${[
            ['1','Metodología','La prueba se resuelve por líneas, de <strong>izquierda a derecha</strong>. Al terminar una línea, comienza la siguiente desde el extremo izquierdo.'],
            ['2','Tiempo','Cuentas con <strong>20 segundos</strong> por cada línea. El sistema cambiará de línea automáticamente.'],
            ['3','Acción','Haz clic <strong>solo en los símbolos idénticos al objetivo</strong>. Si te equivocas, vuelve a hacer clic para desmarcarlo.']
          ].map(([n,t,d]) => `
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <div style="background:var(--primary-vivid);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8125rem;font-weight:800;flex-shrink:0;">${n}</div>
              <div><div style="font-weight:700;color:var(--text);margin-bottom:3px;">${t}</div><p style="font-size:.8125rem;color:var(--text-muted);margin:0;line-height:1.6;">${d}</p></div>
            </div>`).join('')}

          <div style="background:rgba(22,163,74,.08);border-left:4px solid var(--success);border-radius:0 8px 8px 0;padding:14px 16px;">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
              <input type="checkbox" id="plc-chk" style="width:20px;height:20px;accent-color:var(--success);cursor:pointer;" onchange="document.getElementById('plc-btn-practica').disabled=!this.checked">
              <span style="font-weight:700;color:#14532d;font-size:.9375rem;">He comprendido las instrucciones</span>
            </label>
          </div>

          <button disabled id="plc-btn-practica" class="btn-primary"
            style="width:100%;padding:14px;font-size:1rem;justify-content:center;"
            onclick="PLCEngine._startPractice()">
            Entendido, ir a la práctica →
          </button>
        </div>
      </div>
    `);

    // Dibujar TARGET grande
    requestAnimationFrame(() => {
      const c = document.getElementById('plc-target-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      drawPLCStimulus(ctx, STIM_TYPES['T'], SW, SH, fg(), bg(), 1.8);
    });
  }

  /* ══════════════════════════════════════════
     PANTALLA 2 — PRÁCTICA
  ══════════════════════════════════════════ */
  function showPractice() {
    S.screen = 'practice';
    S.preOk = 0; S.preButtons = [];
    const need = 4;

    render(`
      <div style="text-align:center;padding:8px 0;">
        <div style="font-weight:800;font-size:1.0625rem;color:var(--text);margin-bottom:4px;">Mini-Prueba de Práctica</div>
        <div style="font-size:.8125rem;color:var(--text-muted);margin-bottom:24px;">Tiempo ilimitado. Encuentra y marca los ${need} objetivos (■—+—■).</div>

        <div style="display:flex;flex-direction:column;gap:24px;align-items:center;margin-bottom:24px;" id="plc-prac-rows">
          <div class="stim-row-plc" id="p-row-0" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"></div>
          <div class="stim-row-plc" id="p-row-1" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"></div>
        </div>

        <div id="plc-pre-feedback" style="min-height:26px;font-size:.9375rem;font-weight:700;margin-bottom:16px;"></div>

        <div style="display:flex;align-items:center;gap:12px;justify-content:center;max-width:380px;margin:0 auto 20px;">
          <span style="font-size:.8125rem;color:var(--text-muted);font-weight:600;">Objetivos:</span>
          <div style="flex:1;height:10px;background:var(--surface-high);border-radius:99px;overflow:hidden;">
            <div id="plc-pre-prog" style="height:100%;width:0%;background:var(--success);border-radius:99px;transition:width .3s;"></div>
          </div>
          <span id="plc-pre-cnt" style="font-size:1rem;font-weight:800;color:var(--primary);">0 / ${need}</span>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn-secondary" style="padding:10px 20px;" onclick="PLCEngine._resetPractice()">🔄 Repetir</button>
          <button class="btn-primary" id="plc-start-btn" disabled style="padding:12px 32px;font-size:1rem;"
            onclick="PLCEngine._startRealTest()">Iniciar Prueba Real →</button>
        </div>
      </div>
    `);

    _resetPractice();
  }

  function _resetPractice() {
    S.preOk = 0; S.preButtons = [];
    const need = 4;
    const r0 = document.getElementById('p-row-0');
    const r1 = document.getElementById('p-row-1');
    if (!r0 || !r1) return;
    r0.innerHTML = ''; r1.innerHTML = '';
    const fb = document.getElementById('plc-pre-feedback');
    const pg = document.getElementById('plc-pre-prog');
    const cn = document.getElementById('plc-pre-cnt');
    const sb = document.getElementById('plc-start-btn');
    if (fb) fb.textContent = '';
    if (pg) pg.style.width = '0%';
    if (cn) cn.textContent = `0 / ${need}`;
    if (sb) sb.disabled = true;

    const lines = [
      generatePracticeLine(8, ['D13']),
      generatePracticeLine(8, ['D14'])
    ];

    let gi = 0;
    lines.forEach((line, ri) => {
      const rowEl = ri === 0 ? r0 : r1;
      line.forEach(sinfo => {
        const idx = gi++;
        const canvas = document.createElement('canvas');
        canvas.width = SW + 10; canvas.height = SH + 10;
        canvas.style.cssText = 'cursor:pointer;border-radius:8px;border:2px solid transparent;transition:border-color .15s;';
        const ctx = canvas.getContext('2d');
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, fg(), bg(), 1.8);
        canvas.addEventListener('click', () => _preToggle(idx, canvas, sinfo, ctx, need));
        rowEl.appendChild(canvas);
        S.preButtons.push({ canvas, sinfo, sel: false, ctx });
      });
    });
  }

  function _preToggle(idx, canvas, sinfo, ctx, need) {
    const btn = S.preButtons[idx];
    const isT = sinfo.is_target;
    if (btn.sel) {
      btn.sel = false;
      canvas.style.borderColor = 'transparent';
      drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, fg(), bg(), 1.8);
      if (isT) S.preOk = Math.max(0, S.preOk - 1);
    } else {
      btn.sel = true;
      if (isT) {
        canvas.style.borderColor = '#16a34a';
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#16a34a', '#f0fdf4', 2.2);
        S.preOk++;
        const fb = document.getElementById('plc-pre-feedback');
        if (fb) fb.innerHTML = '<span style="color:#16a34a">✓ ¡Correcto!</span>';
      } else {
        canvas.style.borderColor = '#dc2626';
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#dc2626', '#fef2f2', 2.2);
        const fb = document.getElementById('plc-pre-feedback');
        if (fb) fb.innerHTML = '<span style="color:#dc2626">✗ Ese no es el objetivo. Busca el cuadrado en AMBOS extremos.</span>';
      }
    }
    const pct = Math.min(S.preOk, need) / need * 100;
    const pg = document.getElementById('plc-pre-prog');
    const cn = document.getElementById('plc-pre-cnt');
    const sb = document.getElementById('plc-start-btn');
    if (pg) pg.style.width = pct + '%';
    if (cn) cn.textContent = `${S.preOk} / ${need}`;
    if (sb) {
      sb.disabled = S.preOk < need;
      if (S.preOk >= need) {
        const fb = document.getElementById('plc-pre-feedback');
        if (fb) fb.innerHTML = '<span style="color:#16a34a;font-size:1.05rem;">✓ ¡Práctica completada! Ya puedes iniciar.</span>';
      }
    }
  }

  /* ══════════════════════════════════════════
     PANTALLA 3 — TEST REAL (14 líneas)
  ══════════════════════════════════════════ */
  function _startRealTest() {
    S.currentLine = 0;
    S.linesData = [];
    S.clickLog = [];
    S.testLines = Array.from({ length: TOTAL_LINES }, () => generateTestLine(CHARS));
    // App.enterPLCMode() ya fue llamado desde navigate — no re-solicitar fullscreen
    _renderTestLine();
  }

  function _renderTestLine() {
    S.screen = 'test';
    if (S.currentLine >= TOTAL_LINES) { _finishTest(); return; }

    const ld = S.testLines[S.currentLine];
    const row1 = ld.slice(0, SPLIT);
    const row2 = ld.slice(SPLIT);

    // Tamaño de cada estímulo ajustado para llenar más el ancho (fiel a la original)
    const CW = 48, CH = 68;

    render(`
      <div style="display:flex;flex-direction:column;height:100vh;background:#eef0f5;font-family:inherit;overflow:hidden;width:100vw;">

        <!-- ─── HEADER BAR (azul oscuro sólido e inmersivo) ─── -->
        <div style="background:#0f172a;color:#fff;display:flex;align-items:center;padding:0 32px;height:70px;flex-shrink:0;box-shadow:0 2px 15px rgba(0,0,0,0.25);z-index:100;">
          <div style="display:flex;flex-direction:column;">
            <span style="font-size:1.25rem;font-weight:900;letter-spacing:1px;text-transform:uppercase;">LÍNEA ${S.currentLine + 1} / ${TOTAL_LINES}</span>
            <span style="font-size:.6875rem;font-weight:700;color:#94a3b8;margin-top:2px;letter-spacing:0.5px;">PRUEBA DE LÍNEAS CRUZADAS</span>
          </div>
          
          <div style="margin-left:48px;padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <span style="font-size:.75rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Marcados:</span>
            <span id="plc-count-lbl" style="font-weight:900;color:#38bdf8;font-size:1.125rem;margin-left:8px;">0</span>
          </div>
          
          <div style="flex:1;"></div>
          
          <div id="plc-timer-lbl" style="
            font-size:2rem;font-weight:900;min-width:140px;text-align:center;
            padding:8px 24px;border-radius:12px;
            border:2px solid #38bdf8;
            background:rgba(56,189,248,0.1);
            color:#38bdf8;
            box-shadow: 0 0 15px rgba(56,189,248,0.2);
          ">${TIME_PER_LINE}.0 s</div>
        </div>

        <!-- ─── TIMER BAR ─── -->
        <div style="height:8px;background:rgba(0,0,0,0.2);flex-shrink:0;z-index:99;">
          <div id="plc-timer-bar" style="height:100%;width:100%;background:#38bdf8;transition:width .1s linear;box-shadow: 0 0 10px rgba(56,189,248,0.5);"></div>
        </div>

        <!-- ─── HINT ─── -->
        <div style="text-align:center;padding:16px 0 10px;font-size:.9375rem;color:#1e293b;flex-shrink:0;background:#f8fafc;font-weight:600;border-bottom:1px solid #e2e8f0;">
          Marque las cruces con cuadrado negro en AMBOS extremos del brazo horizontal &nbsp;<strong style="color:#0f172a;font-size:1.2rem;margin-left:10px;">■—+—■</strong>
        </div>

        <!-- ─── STIMULI AREA (FULL WIDTH, NO MARGINS) ─── -->
        <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;background:#eef0f5;">
          <div style="width:100%;display:flex;flex-direction:column;align-items:center;padding:0;">
            <div id="plc-row-0" style="display:flex;gap:4px;flex-wrap:nowrap;margin-bottom:32px;width:max-content;padding:0 20px;"></div>
            <div id="plc-row-1" style="display:flex;gap:4px;flex-wrap:nowrap;width:max-content;padding:0 20px;"></div>
          </div>
        </div>

        <!-- ─── BOTTOM BAR ─── -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;flex-shrink:0;">
          <div id="plc-dots" style="display:flex;gap:10px;align-items:center;"></div>
          <button onclick="PLCEngine._nextLine()"
            style="padding:12px 36px;background:#0f172a;border:none;border-radius:12px;font-family:inherit;font-size:1.125rem;font-weight:800;cursor:pointer;color:white;transition:all .2s;box-shadow:0 4px 6px rgba(0,0,0,0.1);display:flex;align-items:center;gap:10px;">
            Siguiente Línea
            <span style="font-size:1.2rem;">→</span>
          </button>
        </div>
      </div>
    `);

    // Dots
    const dotsEl = document.getElementById('plc-dots');
    for (let i = 0; i < TOTAL_LINES; i++) {
      const d = document.createElement('div');
      d.style.cssText = `width:10px;height:10px;border-radius:50%;background:${i < S.currentLine ? '#16a34a' : i === S.currentLine ? '#2563eb' : '#d1d5db'};`;
      dotsEl.appendChild(d);
    }

    // Draw stimuli (no wrapping — fixed size CW x CH)
    S.charBtns = [];
    S.currentSels = new Set();

    function drawRow(rowEl, items, startIdx) {
      items.forEach((sinfo, ri) => {
        const absIdx = startIdx + ri;
        const canvas = document.createElement('canvas');
        canvas.width = CW; canvas.height = CH;
        canvas.style.cssText = `cursor:pointer;border-radius:4px;border:2px solid transparent;display:block;transition:border-color .1s;flex-shrink:0;`;
        const ctx = canvas.getContext('2d');
        drawPLCStimulus(ctx, sinfo, CW, CH, '#1a1a2e', '#ffffff', 1.4);
        canvas.addEventListener('click', () => _toggleStim(absIdx, canvas, sinfo, ctx, CW, CH));
        rowEl.appendChild(canvas);
        S.charBtns.push({ canvas, sinfo, sel: false, ctx, CW, CH });
      });
    }

    drawRow(document.getElementById('plc-row-0'), row1, 0);
    drawRow(document.getElementById('plc-row-1'), row2, SPLIT);

    // Start timer
    S.lineStartTime = performance.now();
    if (S.timerInterval) clearInterval(S.timerInterval);
    S.timerInterval = setInterval(_tickTimer, 100);
  }

  function _toggleStim(idx, canvas, sinfo, ctx, CW, CH) {
    const btn = S.charBtns[idx];
    const now = performance.now();
    S.clickLog.push({
      line: S.currentLine + 1, stim_idx: idx, is_target: sinfo.is_target,
      stim_key: sinfo.key, action: btn.sel ? 'desel' : 'sel',
      elapsed_ms: Math.round(now - S.lineStartTime)
    });
    if (btn.sel) {
      btn.sel = false; S.currentSels.delete(idx);
      canvas.style.borderColor = 'transparent';
      drawPLCStimulus(ctx, sinfo, CW, CH, '#1a1a2e', '#ffffff', 1.4);
    } else {
      btn.sel = true; S.currentSels.add(idx);
      canvas.style.borderColor = '#2563eb';
      drawPLCStimulus(ctx, sinfo, CW, CH, '#1d4ed8', '#eff6ff', 1.6);
    }
    const lbl = document.getElementById('plc-count-lbl');
    if (lbl) lbl.textContent = S.currentSels.size;
  }

  function _tickTimer() {
    const elapsed   = (performance.now() - S.lineStartTime) / 1000;
    const remaining = Math.max(0, TIME_PER_LINE - elapsed);
    const pct = (remaining / TIME_PER_LINE) * 100;
    const timerLbl = document.getElementById('plc-timer-lbl');
    const timerBar = document.getElementById('plc-timer-bar');
    if (!timerLbl || !timerBar) { clearInterval(S.timerInterval); return; }
    timerLbl.textContent = remaining.toFixed(1) + ' s';
    timerBar.style.width = pct + '%';
    if (remaining > 10)      { timerBar.style.background = '#3b82f6'; }
    else if (remaining > 5)  { timerBar.style.background = '#f59e0b'; }
    else                     { timerBar.style.background = '#ef4444'; }
    if (remaining <= 0) {
      clearInterval(S.timerInterval);
      const cont = document.getElementById(S.containerId);
      if (cont) { cont.style.opacity='.4'; setTimeout(() => { cont.style.opacity='1'; _nextLine(); }, 250); }
      else _nextLine();
    }
  }

  function _nextLine() {
    clearInterval(S.timerInterval);
    const elapsed = (performance.now() - S.lineStartTime) / 1000;

    let hits = 0, oms = 0, coms = 0, targets = 0;
    S.charBtns.forEach(b => {
      if (b.sinfo.is_target) { targets++; b.sel ? hits++ : oms++; }
      else if (b.sel) coms++;
    });

    S.linesData.push({
      linea: S.currentLine + 1,
      targets_total: targets,
      aciertos: hits,
      omisiones: oms,
      comisiones: coms,
      tiempo_s: +elapsed.toFixed(3),
      tiempo_pct: +(Math.min(elapsed, TIME_PER_LINE) / TIME_PER_LINE * 100).toFixed(1)
    });

    S.currentLine++;
    _renderTestLine();
  }

  /* ══════════════════════════════════════════
     FIN — calcular métricas y callback
  ══════════════════════════════════════════ */
  function _finishTest() {
    S.screen = 'done';
    clearInterval(S.timerInterval);
    render(`<div style="text-align:center;padding:60px 20px;">
      <div style="font-size:3rem;margin-bottom:16px;">⏳</div>
      <div style="font-size:1.125rem;font-weight:700;color:var(--text);">Calculando métricas...</div>
      <div style="font-size:.875rem;color:var(--text-muted);margin-top:8px;">Por favor espera.</div>
    </div>`);

    setTimeout(() => {
      const age = S.participant?.age || 25;
      const metrics = calcMetrics(S.linesData, S.clickLog, age);
      metrics._age = age;
      const narrative = generateNarrative(metrics);

      let chip, chipLabel;
      if (metrics.CP >= 95 && metrics.TOT <= 5) { chip = 'dss-p6'; chipLabel = 'Alta Eficiencia'; }
      else if (metrics.CP >= 80)                { chip = 'dss-p0'; chipLabel = 'Base Normativa'; }
      else if (metrics.COM > metrics.O * 2)     { chip = 'dss-p2'; chipLabel = 'Alta Reactividad'; }
      else if (metrics.O > metrics.COM * 2)     { chip = 'dss-p1'; chipLabel = 'Latencia Sostenida'; }
      else if (metrics.TRM < -25)               { chip = 'dss-p4'; chipLabel = 'Desempeño Decrescente'; }
      else if (metrics.VAR > 40)                { chip = 'dss-p3'; chipLabel = 'Varianza Bilateral'; }
      else                                      { chip = 'dss-p7'; chipLabel = 'Perfil Complejo'; }

      const resultData = {
        metrics, narrative, linesData: S.linesData, clickLog: S.clickLog,
        participant: S.participant, chip, chipLabel
      };
      // Mostrar pantalla de bloqueo — el callback solo ocurre tras la contraseña
      _showLockScreen(resultData);
    }, 500);
  }

  /* ══════════════════════════════════════════
     PANTALLA 0 — FORMULARIO DEL PARTICIPANTE (fiel a la original)
  ══════════════════════════════════════════ */
  function showPatientPicker() {
    let pacientes = [];
    try { if (typeof DB !== 'undefined' && DB.pacientes) pacientes = DB.pacientes; } catch(e) {}
    const pre = S.participant || {};
    const inp = (id,lbl,val,ph,type='text') => `
      <div><label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">${lbl}</label>
      <input id="${id}" type="${type}" value="${val}" placeholder="${ph}" ${type==='number'?'min="4" max="120"':''}
        style="width:100%;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-family:inherit;font-size:.9375rem;color:#111827;box-sizing:border-box;"></div>`;
    const radio = (name,opts,def) => `
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${opts.map(o => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.9375rem;color:#374151;">
          <input type="radio" name="${name}" value="${o}" ${(def||opts[0])===o?'checked':''} style="accent-color:#1e3a8a;">${o}</label>`).join('')}
      </div>`;

    render(`
      <div style="min-height:100vh;background:#eef0f5;display:flex;align-items:center;justify-content:center;padding:24px;">
        <div style="background:white;border-radius:14px;padding:40px 48px;width:100%;max-width:620px;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          <h2 style="font-size:1.5rem;font-weight:800;color:#1e3a8a;margin-bottom:6px;">Información del Participante</h2>
          <div style="height:3px;width:60px;background:#1e3a8a;border-radius:2px;margin-bottom:28px;"></div>

          ${pacientes.length ? `
            <div style="margin-bottom:20px;">
              <label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">SELECCIONAR DE LA BASE DE DATOS</label>
              <select id="plc-pac-sel" onchange="PLCEngine._onPacChange(this.value)"
                style="width:100%;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-family:inherit;font-size:.9375rem;color:#111827;background:white;">
                <option value="">— Paciente registrado —</option>
                ${pacientes.map(p=>`<option value="${p.id}" ${p.id===(pre.id||'')?'selected':''}>${p.name} — ${p.id}</option>`).join('')}
              </select>
            </div>
            <div style="text-align:center;color:#9ca3af;font-size:.8125rem;margin-bottom:20px;">— O INGRESA MANUALMENTE —</div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            ${inp('plc-f-id','ID DEL PARTICIPANTE *',pre.id||'','ej: PAC-0001')}
            ${inp('plc-f-name','NOMBRE COMPLETO *',pre.name||'','Apellido, Nombre')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            ${inp('plc-f-age','EDAD * (AÑOS)',pre.age||25,'','number')}
            ${inp('plc-f-occ','OCUPACIÓN / CARGO',pre.occupation||'','Ej: Estudiante')}
          </div>

          <div style="margin-bottom:16px;">
            <label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:10px;">GÉNERO</label>
            ${radio('plc-genero',['Masculino','Femenino','Otro','No especificado'],pre.gender||'Masculino')}
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:10px;">NIVEL EDUCATIVO</label>
            ${radio('plc-edu',['Primaria','Secundaria','Universitario','Posgrado'],pre.education||'Universitario')}
          </div>
          <div style="margin-bottom:28px;">
            <label style="font-size:.6875rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:10px;">LATERALIDAD</label>
            ${radio('plc-lat',['Derecha','Izquierda','Ambidiestro'],pre.hand||'Derecha')}
          </div>

          <div id="plc-form-err" style="color:#dc2626;font-size:.8125rem;min-height:18px;margin-bottom:10px;"></div>
          <button onclick="PLCEngine._confirmPatient()"
            style="width:100%;padding:16px;background:#1e3a8a;color:white;border:none;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:700;cursor:pointer;">
            Continuar a pre-prueba →
          </button>
        </div>
      </div>
    `);
    if (pre.id) _onPacChange(pre.id);
  }

  function _onPacChange(val) {
    let pacientes = [];
    try { if (typeof DB !== 'undefined' && DB.pacientes) pacientes = DB.pacientes; } catch(e) {}
    if (!val) return;
    const pac = pacientes.find(p => p.id === val);
    if (!pac) return;
    S._selectedPac = pac;
    const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
    set('plc-f-id', pac.id);
    set('plc-f-name', pac.name);
    set('plc-f-age', pac.edad||25);
    set('plc-f-occ', pac.cargo||'');
  }

  function _confirmPatient() {
    const id   = document.getElementById('plc-f-id')?.value.trim();
    const name = document.getElementById('plc-f-name')?.value.trim();
    const age  = parseInt(document.getElementById('plc-f-age')?.value)||25;
    const occ  = document.getElementById('plc-f-occ')?.value.trim()||'';
    const gender    = document.querySelector('input[name="plc-genero"]:checked')?.value||'No especificado';
    const education = document.querySelector('input[name="plc-edu"]:checked')?.value||'Universitario';
    const hand      = document.querySelector('input[name="plc-lat"]:checked')?.value||'Derecha';
    if (!id || !name) {
      const err = document.getElementById('plc-form-err');
      if (err) err.textContent = '⚠️ ID y Nombre completo son obligatorios.';
      return;
    }
    S.participant = { id, name, age, occupation: occ, gender, education, hand };
    showPreTest();
  }


  /* ══════════════════════════════════════════
     FULLSCREEN helpers
  ══════════════════════════════════════════ */
  function _enterFullscreen() {
    const el = document.getElementById('app') || document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
  function _exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen && document.exitFullscreen();
    }
  }

  /* ══════════════════════════════════════════
     PANTALLA DE BLOQUEO (post-prueba)
  ══════════════════════════════════════════ */
  function _showLockScreen(resultData) {
    _exitFullscreen();
    render(`
      <div style="max-width:480px;margin:0 auto;text-align:center;padding:32px 0;">
        <div style="font-size:3.5rem;margin-bottom:12px;">✅</div>
        <div style="font-weight:900;font-size:1.375rem;color:var(--text);margin-bottom:6px;">¡Evaluación Finalizada!</div>
        <div style="font-size:.9375rem;color:var(--text-muted);margin-bottom:32px;">
          Gracias ${resultData.participant?.name || ''}.<br>Puedes dejar el equipo al especialista.
        </div>

        <div style="background:var(--surface-low);border-radius:16px;padding:28px;border:2px solid var(--outline-var);">
          <div style="font-size:1.25rem;margin-bottom:8px;">🔒</div>
          <div style="font-weight:700;color:var(--text);margin-bottom:4px;">Resultados Protegidos</div>
          <div style="font-size:.8125rem;color:var(--text-muted);margin-bottom:20px;">Ingresa la contraseña del especialista para ver el informe.</div>

          <input id="plc-lock-pass" type="password" placeholder="Contraseña del psicólogo"
            style="width:100%;padding:12px 14px;border:2px solid var(--outline-var);border-radius:10px;
                   font-family:inherit;font-size:1rem;background:var(--surface-white);color:var(--text);
                   box-sizing:border-box;margin-bottom:12px;"
            onkeydown="if(event.key==='Enter') PLCEngine._tryUnlock()"
          />
          <div id="plc-lock-err" style="color:#dc2626;font-size:.8125rem;min-height:20px;margin-bottom:12px;"></div>
          <button class="btn-primary" style="width:100%;padding:12px;font-size:1rem;justify-content:center;"
            onclick="PLCEngine._tryUnlock()">
            🔓 Ver Resultados
          </button>
        </div>
      </div>
    `);
    S._pendingResult = resultData;
  }

  function _tryUnlock() {
    const entered = document.getElementById('plc-lock-pass').value;
    const currentUser = window.DB?.state?.currentUser?.username || '';
    const storedPass = window.DB?.users?.[currentUser]?.pass;
    const ok = storedPass ? (entered === storedPass) : (entered === '123');
    if (ok) {
      // Restaurar UI y salir de fullscreen ANTES de mostrar resultados
      if (window.App && App.exitPLCMode) App.exitPLCMode();
      if (S.onComplete && S._pendingResult) S.onComplete(S._pendingResult);
    } else {
      const err = document.getElementById('plc-lock-err');
      if (err) err.textContent = '⚠️ Contraseña incorrecta. Intenta de nuevo.';
      const inp = document.getElementById('plc-lock-pass');
      if (inp) { inp.value=''; inp.style.borderColor='#dc2626'; setTimeout(()=>inp.style.borderColor='',1500); }
    }
  }

  /* ── API Pública ─────────────────────── */
  function start(containerId, participant, onComplete) {
    S.containerId  = containerId;
    S.participant  = participant || null;
    S.onComplete   = onComplete || null;
    S._selectedPac = null;
    S._pendingResult = null;
    // Si ya viene un paciente registrado con todos sus datos → ir directo a instrucciones
    if (participant && participant.id && participant.name) {
      showPreTest();
    } else {
      // Sin paciente pre-seleccionado → mostrar selector/formulario
      showPatientPicker();
    }
  }

  function _toggleFullscreen() {
    if (!document.fullscreenElement) _enterFullscreen();
    else _exitFullscreen();
  }

  // Exponer internos para botones inline
  return {
    start,
    _confirmPatient,
    _onPacChange,
    _startPractice: showPractice,
    _resetPractice,
    _startRealTest,
    _nextLine,
    _tryUnlock,
    _toggleFullscreen
  };
})();

window.PLCEngine = PLCEngine;
