// app.js — PLC Professional SPA
// Gestión de estado y renderizado de todas las pantallas

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'https://plc-backend.onrender.com';

const App = {
  /* ── Estado ──────────────────────────────────────────────────────────── */
  screen:      'login',
  supabase:    null,
  user:        null,
  modelOk:     false,
  participant: null,
  testLines:   [],   // cada línea: array de 47 estímulos
  linesData:   [],   // resultados por línea
  clickLog:    [],
  currentLine: 0,
  mlPred:      null,
  metrics:     null,
  evalId:      null,
  evalFilename:null,
  // Timer
  timerInterval: null,
  lineStartTime: null,
  timerRunning:  false,
  // Pre-test
  preButtons:  [],
  preOk:       0,
  preNeed:     2,
  // Test line state
  charBtns:    [],
  currentSels: new Set(),

  TOTAL_LINES:  14,
  TIME_PER_LINE:20,
  CHARS_PER_LINE:47,

  /* ── Init ──────────────────────────────────────────────────────────────── */
  async init() {
    // Configuración de Supabase
    const SUPABASE_URL = 'https://lfyaiwbtfgoiczyyzlwh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWFpd2J0ZmdvaWN6eXl6bHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjc1MTEsImV4cCI6MjA5MDY0MzUxMX0.ZfVceXuYWQKEZimgRLt9kGkSGpq8FO7kRgKbL-Ta-3M';
    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
      // Verificar sesión activa
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.user = session.user;
      }
    } catch(e) {}

    try {
      const r = await fetch(API_BASE + '/api/status');
      const d = await r.json();
      this.modelOk = d.model_available;
    } catch(e) { this.modelOk = false; }
    
    // Si hay usuario logueado -> menú, si no -> login
    this.nav(this.user ? 'menu' : 'login');
  },

  nav(screen) {
    if (!this.user && screen !== 'login') {
      this.screen = 'login';
    } else {
      this.screen = screen;
    }
    this.render();
  },

  render() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.className = 'fade-in';
    switch(this.screen) {
      case 'login':   this.renderLogin(app);   break;
      case 'menu':    this.renderMenu(app);    break;
      case 'form':    this.renderForm(app);    break;
      case 'pretest': this.renderPreTest(app); break;
      case 'test':    this.renderTest(app);    break;
      case 'results': this.renderResults(app); break;
      case 'history': this.renderHistory(app); break;
    }
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 0: LOGIN
  ══════════════════════════════════════════════════════════════════════ */
  renderLogin(app) {
    app.innerHTML = `
      <div id="test-screen" style="background:linear-gradient(135deg,#1A237E 0%,#283593 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="background:#fff;padding:40px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);width:100%;max-width:400px;">
          <h2 style="margin-bottom:8px;text-align:center;">PLC Professional <span style="font-size:0.5em;vertical-align:top;color:#546E7A;">Cloud</span></h2>
          <p style="color:#546E7A;text-align:center;font-size:0.9rem;margin-bottom:24px;">
            Acceso exclusivo para evaluadores
          </p>

          <div class="form-group">
            <label>Correo Electrónico</label>
            <input type="text" id="login-email" placeholder="usuario@clinica.com" />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label>Contraseña</label>
            <input type="password" id="login-pwd" placeholder="•••••••••" style="width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Inter', sans-serif; font-size: .95rem; background: var(--a-light);" />
          </div>

          <div id="login-error" style="color:#B71C1C;font-size:0.85rem;margin-bottom:16px;text-align:center;min-height:16px;"></div>

          <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;" onclick="App.doLogin(this)">
            Iniciar Sesión
          </button>
        </div>
      </div>
    `;
  },

  async doLogin(btn) {
    const email = document.getElementById('login-email').value.trim();
    const pwd   = document.getElementById('login-pwd').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    if (!email || !pwd) {
      errEl.textContent = 'Ingrese correo y contraseña.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email,
      password: pwd
    });

    btn.disabled = false;
    btn.textContent = 'Iniciar Sesión';

    if (error) {
      console.warn("Login failed:", error.message);
      // Ocultar mensaje genérico de supabase
      errEl.textContent = 'Credenciales inválidas. Compruebe o contáctenos.';
    } else {
      this.user = data.user;
      this.nav('menu');
    }
  },

  async doLogout() {
    await this.supabase.auth.signOut();
    this.user = null;
    this.nav('login');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 1: MENÚ
  ══════════════════════════════════════════════════════════════════════ */
  renderMenu(app) {
    app.innerHTML = `
      <div id="test-screen" style="background:linear-gradient(135deg,#1A237E 0%,#283593 100%);min-height:100vh;display:flex;flex-direction:column;">
        <!-- Hero Header -->
        <div style="padding:40px 60px 30px;color:#fff;flex-shrink:0;">
          <div style="font-family:'Playfair Display',serif;font-size:3rem;font-weight:700;letter-spacing:-1px;line-height:1.1;">
            PLC Professional
          </div>
          <div style="font-size:1.1rem;color:#C5CAE9;margin-top:8px;font-weight:300;">
            Prueba de Líneas Cruzadas — Evaluación Cognitiva
          </div>
          <div style="margin-top:20px;padding:10px 20px;background:rgba(255,255,255,0.1);border-radius:8px;display:inline-block;font-size:0.95rem;">
            👋 Bienvenido/a, <strong style="color:#FFF;">${this.user ? this.user.email : 'Evaluador'}</strong>
          </div>
        </div>

        <!-- Content -->
        <div style="flex:1;padding:0 60px 40px;display:flex;flex-direction:column;gap:24px;">

          <!-- Model badge -->
          <div class="model-badge ${this.modelOk ? 'ok' : 'off'}" style="width:fit-content;">
            <span class="dot"></span>
            ${this.modelOk
              ? '● Módulo de perfil cognitivo activo'
              : '○ Modelo IA no disponible — solo métricas objetivas'}
          </div>

          <!-- Info card -->
          <div style="background:rgba(255,255,255,.09);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:32px 40px;max-width:860px;">
            <div style="font-family:'Playfair Display',serif;font-size:1.3rem;color:#fff;margin-bottom:14px;font-weight:600;">
              Acerca de la prueba
            </div>
            <p style="color:#C5CAE9;font-size:.95rem;line-height:1.7;">
              Prueba de atención selectiva basada en identificación de estímulos objetivo
              en un campo de distractores similares.<br>
              <strong style="color:#fff;">14 líneas &nbsp;·&nbsp; 20 s por línea &nbsp;·&nbsp; 47 estímulos/línea</strong><br><br>
              Incluye fase de pre-prueba para verificar comprensión de instrucciones.
              Los resultados incluyen métricas cuantitativas, perfil cognitivo IA,
              gráficas de rendimiento y exportación a Excel profesional con informe completo.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-4 items-center" style="flex-wrap:wrap;">
            <button class="btn btn-primary btn-lg" onclick="App.nav('form')" style="font-size:1.1rem;padding:16px 48px;">
              ▶ &nbsp; Nueva Evaluación
            </button>
            <button class="btn btn-ghost btn-lg" onclick="App.nav('history')">
              📋 &nbsp; Historial
            </button>
            <button class="btn btn-danger btn-lg" onclick="App.doLogout()">
              Cerrar Sesión
            </button>
          </div>

          <!-- Footer -->
          <div style="color:#7986CB;font-size:.8rem;margin-top:auto;">
            PLC Professional v3.0 &nbsp;·&nbsp; Uso exclusivo para profesionales
          </div>
        </div>
      </div>`;
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 2: FORMULARIO
  ══════════════════════════════════════════════════════════════════════ */
  renderForm(app) {
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Datos del Evaluado</h1><div class="sub">Complete la información antes de iniciar</div></div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')">← Menú</button>
      </div>
      <div class="page fade-in" style="max-width:860px;">
        <div class="card">
          <h2 style="margin-bottom:24px;">Información del Participante</h2>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div class="form-group">
              <label>ID del Participante *</label>
              <input type="text" id="f-id" placeholder="Ej: P001" />
            </div>
            <div class="form-group">
              <label>Nombre Completo *</label>
              <input type="text" id="f-name" placeholder="Nombre y apellido" />
            </div>
            <div class="form-group">
              <label>Edad * (años)</label>
              <input type="number" id="f-age" min="5" max="100" value="25" />
            </div>
            <div class="form-group">
              <label>Ocupación / Cargo</label>
              <input type="text" id="f-occ" placeholder="Opcional" />
            </div>
          </div>

          <hr class="form-divider"/>

          <div class="form-group">
            <label>Género</label>
            <div class="radio-group" id="rg-gender">
              ${['Masculino','Femenino','Otro','No especificado'].map(o =>
                `<label><input type="radio" name="gender" value="${o}" ${o==='Masculino'?'checked':''}/> ${o}</label>`
              ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Nivel Educativo</label>
            <div class="radio-group" id="rg-edu">
              ${['Primaria','Secundaria','Universitario','Posgrado'].map(o =>
                `<label><input type="radio" name="education" value="${o}" ${o==='Universitario'?'checked':''}/> ${o}</label>`
              ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Lateralidad</label>
            <div class="radio-group" id="rg-hand">
              ${['Derecha','Izquierda','Ambidiestro'].map(o =>
                `<label><input type="radio" name="hand" value="${o}" ${o==='Derecha'?'checked':''}/> ${o}</label>`
              ).join('')}
            </div>
          </div>

          <div class="flex flex-end gap-2 mt-8">
            <button class="btn btn-primary btn-lg" onclick="App.validateForm()">
              Continuar a pre-prueba &nbsp;→
            </button>
          </div>
        </div>
      </div>`;
  },

  validateForm() {
    const id   = document.getElementById('f-id').value.trim();
    const name = document.getElementById('f-name').value.trim();
    const age  = parseInt(document.getElementById('f-age').value);
    if (!id || !name) { alert('ID y Nombre son obligatorios.'); return; }
    if (!age || age < 5 || age > 100) { alert('Ingrese una edad entre 5 y 100 años.'); return; }
    const gender     = document.querySelector('input[name="gender"]:checked')?.value    || 'No especificado';
    const education  = document.querySelector('input[name="education"]:checked')?.value || 'Universitario';
    const hand       = document.querySelector('input[name="hand"]:checked')?.value      || 'Derecha';
    const occupation = document.getElementById('f-occ').value.trim();
    this.participant = { id, name, age, gender, education, hand, occupation };
    this.nav('pretest');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 3: PRE-PRUEBA
  ══════════════════════════════════════════════════════════════════════ */
  renderPreTest(app) {
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Pre-Prueba — Ejemplo</h1>
          <div class="sub">Identifique el estímulo objetivo antes de comenzar la prueba real</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('form')">← Volver</button>
      </div>

      <div class="page fade-in">

        <!-- Demo: Target + Distractores -->
        <div class="card mb-4">
          <div class="demo-row">
            <!-- TARGET -->
            <div class="demo-target-box">
              <div style="font-weight:700;color:#2E7D32;font-size:.9rem;text-transform:uppercase;letter-spacing:.5px;">
                ✓ Estímulo Objetivo (TARGET)
              </div>
              <canvas id="demo-target" class="stim" width="${SW+20}" height="${SH+20}"></canvas>
              <div style="font-size:.78rem;color:#546E7A;">■—+—■ &nbsp; Cuadrado en AMBOS extremos</div>
            </div>

            <div style="font-size:2rem;color:#C5CAE9;">→</div>

            <!-- DISTRACTORES -->
            <div style="flex:1;">
              <div style="font-weight:700;color:#B71C1C;font-size:.9rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
                ✗ Distractores (NO MARCAR)
              </div>
              <div class="flex gap-4">
                ${['D1','D2','D3'].map((k,i) => `
                  <div style="text-align:center;">
                    <div style="font-weight:700;color:#546E7A;margin-bottom:4px;">${i+1})</div>
                    <canvas id="demo-dist-${i}" width="${SW+20}" height="${SH+20}" style="border:1px solid #FFCDD2;border-radius:4px;background:#FFEBEE;display:block;"></canvas>
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Instrucción -->
        <div class="card mb-4" style="background:#E8EAF6;border-left:4px solid #3949AB;">
          <div style="font-weight:700;color:#1A237E;margin-bottom:6px;">INSTRUCCIÓN AL EVALUADO</div>
          <p style="font-size:.92rem;">
            Marque todos los estímulos que sean <strong>IGUALES al objetivo (TARGET)</strong>:
            una cruz con un cuadrado negro a <strong>CADA LADO</strong> del brazo horizontal.<br>
            No marque los distractores aunque tengan forma similar.
          </p>
        </div>

        <!-- Práctica -->
        <div class="card">
          <div style="font-weight:700;color:#283593;font-size:1rem;margin-bottom:14px;">
            Práctica: marque los estímulos correctos en la fila de abajo
          </div>
          <div id="pre-row" class="stim-row" style="gap:6px;flex-wrap:wrap;margin-bottom:16px;"></div>

          <div id="pre-feedback" style="min-height:22px;font-size:.88rem;font-weight:600;margin-bottom:10px;"></div>

          <!-- Progress -->
          <div class="prog-bar-wrap mb-4">
            <span style="font-size:.82rem;color:#546E7A;">Marcados correctos:</span>
            <div class="prog-bar" style="max-width:220px;">
              <div class="prog-bar-fill" id="pre-prog" style="width:0%;"></div>
            </div>
            <span id="pre-cnt" style="font-size:.9rem;font-weight:700;color:#1A237E;">0 / ${this.preNeed}</span>
          </div>

          <div class="flex flex-between items-center">
            <button class="btn btn-warn" onclick="App.resetPractice()">🔄 Repetir práctica</button>
            <button class="btn btn-primary btn-lg" id="start-btn" disabled onclick="App.startTest()">
              Iniciar Prueba &nbsp;→
            </button>
          </div>
        </div>
      </div>`;

    // Draw demo stimuli
    const tgtCtx = document.getElementById('demo-target').getContext('2d');
    drawPLCStimulus(tgtCtx, STIM_TYPES['T'], SW+20, SH+20, '#2E7D32', '#E8F5E9', 2.5);
    ['D1','D2','D3'].forEach((k,i) => {
      const c = document.getElementById(`demo-dist-${i}`).getContext('2d');
      drawPLCStimulus(c, STIM_TYPES[k], SW+20, SH+20, '#B71C1C', '#FFEBEE', 2);
    });

    this.resetPractice();
  },

  resetPractice() {
    this.preOk = 0;
    this.preButtons = [];
    const prow = document.getElementById('pre-row');
    if (!prow) return;
    prow.innerHTML = '';
    document.getElementById('pre-feedback').textContent = '';
    document.getElementById('pre-prog').style.width = '0%';
    document.getElementById('pre-cnt').textContent = `0 / ${this.preNeed}`;
    const btn = document.getElementById('start-btn');
    if (btn) { btn.disabled = true; }

    const line = generatePracticeLine(10);
    line.forEach((sinfo, idx) => {
      const canvas = document.createElement('canvas');
      canvas.width  = SW + 10;
      canvas.height = SH + 10;
      canvas.className = 'stim';
      canvas.style.cursor = 'pointer';
      const ctx = canvas.getContext('2d');
      drawPLCStimulus(ctx, sinfo, SW+10, SH+10, '#1A1A2E', '#FFFFFF', 1.8);
      canvas.addEventListener('click', () => this.preToggle(idx, canvas, sinfo, ctx));
      prow.appendChild(canvas);
      this.preButtons.push({ canvas, sinfo, sel: false, ctx });
    });
  },

  preToggle(idx, canvas, sinfo, ctx) {
    const btn = this.preButtons[idx];
    const isT = sinfo.is_target;
    if (btn.sel) {
      btn.sel = false;
      canvas.className = 'stim';
      drawPLCStimulus(ctx, sinfo, SW+10, SH+10, '#1A1A2E', '#FFFFFF', 1.8);
      if (isT) this.preOk = Math.max(0, this.preOk - 1);
    } else {
      btn.sel = true;
      if (isT) {
        canvas.className = 'stim sel-ok';
        drawPLCStimulus(ctx, sinfo, SW+10, SH+10, '#2E7D32', '#E8F5E9', 2);
        this.preOk++;
        document.getElementById('pre-feedback').innerHTML =
          '<span class="text-success">✓ Correcto — ese es el estímulo objetivo.</span>';
      } else {
        canvas.className = 'stim sel-wrong';
        drawPLCStimulus(ctx, sinfo, SW+10, SH+10, '#B71C1C', '#FFEBEE', 2);
        document.getElementById('pre-feedback').innerHTML =
          '<span class="text-err">✗ Ese no es el objetivo. Observe bien el cuadrado en AMBOS lados.</span>';
      }
    }
    const pct = Math.min(this.preOk, this.preNeed) / this.preNeed * 100;
    document.getElementById('pre-prog').style.width = pct + '%';
    document.getElementById('pre-cnt').textContent = `${this.preOk} / ${this.preNeed}`;
    const btn2 = document.getElementById('start-btn');
    if (btn2) {
      if (this.preOk >= this.preNeed) {
        btn2.disabled = false;
        document.getElementById('pre-feedback').innerHTML =
          '<span class="text-success fw-bold">✓ ¡Perfecto! Ya puede iniciar la prueba.</span>';
      } else {
        btn2.disabled = true;
      }
    }
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 4: TEST (14 líneas × 47 estímulos)
  ══════════════════════════════════════════════════════════════════════ */
  startTest() {
    this.currentLine = 0;
    this.linesData   = [];
    this.clickLog    = [];
    this.testLines   = Array.from({length: this.TOTAL_LINES}, () => generateTestLine(this.CHARS_PER_LINE));
    this.nav('test');
  },

  renderTest(app) {
    if (this.currentLine >= this.TOTAL_LINES) { this.finishTest(); return; }

    const ld   = this.testLines[this.currentLine];
    const split = 24;
    const row1  = ld.slice(0, split);
    const row2  = ld.slice(split);

    app.innerHTML = `
      <div id="test-screen">
        <!-- Header -->
        <div class="test-header">
          <span class="line-label">LÍNEA ${this.currentLine+1} / ${this.TOTAL_LINES}</span>
          <span class="count-lbl" id="count-lbl">Marcados: 0</span>
          <span class="timer-lbl" id="timer-lbl">${this.TIME_PER_LINE}.0 s</span>
        </div>

        <!-- Timer bar -->
        <div class="timer-bar-row">
          <div class="timer-bar-fill" id="timer-bar" style="width:100%;"></div>
        </div>

        <!-- Hint -->
        <div class="test-hint">
          Marque las cruces con cuadrado negro en AMBOS extremos del brazo horizontal &nbsp;■—+—■
        </div>

        <!-- Stimuli area -->
        <div class="stim-area" id="stim-area">
          <div class="stim-row" id="row-0"></div>
          <div class="stim-row" id="row-1"></div>
        </div>

        <!-- Footer -->
        <div class="test-footer">
          <div class="progress-dots" id="prog-dots"></div>
          <button class="btn btn-ghost btn-sm" onclick="App.nextLine()">Siguiente →</button>
        </div>
      </div>`;

    // Progress dots
    const dots = document.getElementById('prog-dots');
    for (let i = 0; i < this.TOTAL_LINES; i++) {
      const s = document.createElement('span');
      s.className = i < this.currentLine ? 'done' : i === this.currentLine ? 'curr' : '';
      dots.appendChild(s);
    }

    // Draw stimuli
    this.charBtns    = [];
    this.currentSels = new Set();

    const drawRow = (rowEl, items, startIdx) => {
      items.forEach((sinfo, relIdx) => {
        const absIdx = startIdx + relIdx;
        const cell   = document.createElement('div');
        cell.className = 'stim-cell';
        const canvas = document.createElement('canvas');
        canvas.width  = SW;
        canvas.height = SH;
        canvas.className = 'stim';
        const ctx = canvas.getContext('2d');
        drawPLCStimulus(ctx, sinfo, SW, SH, '#1A1A2E', '#FFFFFF', 1.6);
        canvas.addEventListener('click', () => this.toggleStim(absIdx, canvas, sinfo, ctx));
        cell.appendChild(canvas);
        rowEl.appendChild(cell);
        this.charBtns.push({ canvas, sinfo, sel: false, ctx });
      });
    };

    drawRow(document.getElementById('row-0'), row1, 0);
    drawRow(document.getElementById('row-1'), row2, split);

    // Start timer
    this.lineStartTime = performance.now();
    this.timerRunning  = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tickTimer(), 100);
  },

  toggleStim(idx, canvas, sinfo, ctx) {
    const btn = this.charBtns[idx];
    const now = performance.now();
    this.clickLog.push({
      line:       this.currentLine + 1,
      stim_idx:   idx,
      is_target:  sinfo.is_target,
      stim_key:   sinfo.key,
      action:     btn.sel ? 'desel' : 'sel',
      elapsed_ms: Math.round(now - this.lineStartTime)
    });
    if (btn.sel) {
      btn.sel = false;
      this.currentSels.delete(idx);
      canvas.className = 'stim';
      drawPLCStimulus(ctx, sinfo, SW, SH, '#1A1A2E', '#FFFFFF', 1.6);
    } else {
      btn.sel = true;
      this.currentSels.add(idx);
      canvas.className = 'stim sel-test';
      drawPLCStimulus(ctx, sinfo, SW, SH, '#1A1A2E', '#FFFFFF', 1.6);
    }
    const lbl = document.getElementById('count-lbl');
    if (lbl) lbl.textContent = `Marcados: ${this.currentSels.size}`;
  },

  tickTimer() {
    if (!this.timerRunning) return;
    const elapsed   = (performance.now() - this.lineStartTime) / 1000;
    const remaining = Math.max(0, this.TIME_PER_LINE - elapsed);
    const pct       = (remaining / this.TIME_PER_LINE) * 100;

    const timerLbl = document.getElementById('timer-lbl');
    const timerBar = document.getElementById('timer-bar');
    if (!timerLbl || !timerBar) { clearInterval(this.timerInterval); return; }

    timerLbl.textContent = remaining.toFixed(1) + ' s';
    timerBar.style.width = pct + '%';

    if (remaining > 10) {
      timerLbl.style.color = '#fff';
      timerBar.className   = 'timer-bar-fill';
    } else if (remaining > 5) {
      timerLbl.style.color = '#FFD54F';
      timerBar.className   = 'timer-bar-fill warn';
    } else {
      timerLbl.style.color = '#EF9A9A';
      timerBar.className   = 'timer-bar-fill crit';
    }

    if (remaining <= 0) {
      clearInterval(this.timerInterval);
      this.timerRunning = false;
      document.body.style.background = '#fff';
      setTimeout(() => { document.body.style.background = ''; this.nextLine(); }, 400);
    }
  },

  nextLine() {
    clearInterval(this.timerInterval);
    this.timerRunning = false;
    const elapsed = (performance.now() - this.lineStartTime) / 1000;

    let hits=0, oms=0, coms=0, targets=0;
    this.charBtns.forEach(b => {
      if (b.sinfo.is_target) { targets++; b.sel ? hits++ : oms++; }
      else if (b.sel) coms++;
    });

    this.linesData.push({
      linea: this.currentLine + 1,
      targets_total: targets,
      aciertos:   hits,
      omisiones:  oms,
      comisiones: coms,
      tiempo_s:   +elapsed.toFixed(3),
      tiempo_pct: +(Math.min(elapsed, this.TIME_PER_LINE) / this.TIME_PER_LINE * 100).toFixed(1)
    });

    this.currentLine++;
    this.nav('test');
  },

  /* ══════════════════════════════════════════════════════════════════════
     FIN DEL TEST — cálculo + predicción + guardado
  ══════════════════════════════════════════════════════════════════════ */
  async finishTest() {
    this.nav('results');  // show loading state first
    this.metrics = calcMetrics(this.linesData, this.clickLog, this.participant.age);
    this.metrics._age = this.participant.age;

    // ML prediction via API
    try {
      const resp = await fetch(API_BASE + '/api/predict', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          age: this.participant.age, education: this.participant.education,
          hand: this.participant.hand,
          TN: this.metrics.TN, TA: this.metrics.TA,
          O: this.metrics.O, C: this.metrics.COM,
          total_time: this.metrics.totalTime, cv_time: this.metrics.cvTime,
          fatigue_hits: this.metrics.TRM, consistency: this.metrics.consistency,
          block_hits: this.metrics.blockHits
        })
      });
      this.mlPred = await resp.json();
    } catch(e) { this.mlPred = { model_used: false, error: 'Error de conexión' }; }

    // Save + generate Excel
    try {
      const narrative = generateNarrative(this.metrics);
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';

      const saveResp  = await fetch(API_BASE + '/api/save', {
        method:'POST', headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({
          participant:   this.participant,
          lines_data:    this.linesData,
          click_log:     this.clickLog,
          metrics: {
            TA:this.metrics.TA, O:this.metrics.O, COM:this.metrics.COM,
            TN:this.metrics.TN, TOT:this.metrics.TOT, CON:this.metrics.CON,
            CP:this.metrics.CP, totalTime:this.metrics.totalTime,
            meanTpl:this.metrics.meanTpl, stdTpl:this.metrics.stdTpl,
            cvTime:this.metrics.cvTime, procSpeed:this.metrics.procSpeed,
            efficiency:this.metrics.efficiency, FA:this.metrics.FA,
            GQ:this.metrics.GQ, VAR:this.metrics.VAR,
            estabilidad:this.metrics.estabilidad, consistency:this.metrics.consistency,
            TRM:this.metrics.TRM, IVR:this.metrics.IVR,
            blockHits:this.metrics.blockHits, errorPat:this.metrics.errorPat,
            adjScore:this.metrics.adjScore, meanRt:this.metrics.meanRt,
            medRt:this.metrics.medRt, attnStyle:this.metrics.attnStyle,
            attnDesc:this.metrics.attnDesc
          },
          ml_prediction: this.mlPred,
          narrative
        })
      });
      const sd = await saveResp.json();
      this.evalId       = sd.id;
      this.evalFilename = sd.excel_filename;
    } catch(e) { console.warn('Save error:', e); }

    this.nav('results');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 5: RESULTADOS
  ══════════════════════════════════════════════════════════════════════ */
  renderResults(app) {
    const m  = this.metrics;
    const ml = this.mlPred;

    if (!m) {
      app.innerHTML = `<div class="plc-header"><h1>Procesando...</h1></div>
        <div class="page"><div class="card" style="text-align:center;padding:60px;">
          <div style="font-size:2rem;margin-bottom:16px;">⏳</div>
          <p style="color:#546E7A;">Calculando métricas y perfil cognitivo...</p>
        </div></div>`;
      return;
    }

    const narrative = generateNarrative(m);
    const now = new Date().toLocaleString('es', {dateStyle:'short', timeStyle:'short'});

    app.innerHTML = `
      <div class="plc-header">
        <div>
          <h1>PLC Professional — Resultados</h1>
          <div class="sub">${this.participant.name} &nbsp;·&nbsp; ID: ${this.participant.id} &nbsp;·&nbsp; ${now}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')">🏠 Menú</button>
          <button class="btn btn-ghost btn-sm" onclick="App.validateForm ? App.nav('form') : App.nav('form')">🔄 Nueva eval.</button>
          ${this.evalId ? `<button class="btn btn-success btn-sm" onclick="App.downloadExcel()">📊 Descargar Excel</button>` : ''}
        </div>
      </div>

      <div style="overflow-y:auto;flex:1;padding:24px 40px;max-width:1360px;margin:0 auto;width:100%;" class="fade-in">

        <!-- A) Métricas principales -->
        <div class="card mb-4">
          <div class="section-title">Métricas Objetivas</div>
          <div class="metric-cards">
            ${[
              ['TA  Aciertos',        m.TA,               '#E8F5E9','#2E7D32'],
              ['O  Omisiones',        m.O,                '#FFF3E0','#E65100'],
              ['C  Comisiones',       m.COM,              '#FFEBEE','#B71C1C'],
              ['CP %  Concentración', m.CP.toFixed(1),    '#E8EAF6','#1A237E'],
              ['CON  Neto',           m.CON,              '#E8EAF6','#283593'],
            ].map(([lbl,val,bg,fg]) => `
              <div class="metric-card" style="background:${bg};">
                <div class="val" style="color:${fg};">${val}</div>
                <div class="lbl">${lbl}</div>
              </div>`).join('')}
          </div>

          <hr class="form-divider"/>

          <div class="ext-metrics">
            ${[
              ['Velocidad',         `${Math.round(m.procSpeed)} estím/min`],
              ['Estabilidad',       `${Math.round(m.estabilidad)} %`],
              ['TRM Monotonía',     `${m.TRM >= 0 ? '+' : ''}${m.TRM.toFixed(1)} %`],
              ['IVR Vel–Exactitud', m.IVR.toFixed(2)],
              ['TR medio',          `${Math.round(m.meanRt)} ms`],
              ['Estilo Atencional', m.attnStyle],
            ].map(([lbl,val]) => `
              <div class="ext-card">
                <div class="eval">${val}</div>
                <div class="elbl">${lbl}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- B) Gráficas -->
        <div class="card mb-4">
          <div class="section-title">Gráficas de Rendimiento</div>
          <div class="charts-grid">
            <div class="chart-box"><canvas id="chart-behavior"></canvas></div>
            <div class="chart-box"><canvas id="chart-metrics"></canvas></div>
            <div class="chart-box"><canvas id="chart-errors"></canvas></div>
            <div class="chart-box"><canvas id="chart-normal"></canvas></div>
          </div>
        </div>

        <!-- C) Perfil cognitivo MLP -->
        <div class="card mb-4">
          <div class="section-title">Perfil Cognitivo — Indicadores</div>
          ${ml && ml.model_used ? `
            <div class="profile-badge">
              <span class="pname">${ml.profile_info.nombre}</span>
              <span class="pconf">Confianza estadística: ${ml.confidence_percent}</span>
            </div>
            <div style="background:#E8EAF6;border-radius:8px;padding:14px 18px;margin-bottom:12px;">
              <div style="font-weight:600;color:#1A237E;margin-bottom:4px;">Descripción del indicador:</div>
              <p style="font-size:.9rem;">${ml.profile_info.desc}</p>
            </div>
            <div style="margin-bottom:12px;">
              <div style="font-weight:600;color:#1A237E;margin-bottom:6px;">Rasgos observados:</div>
              ${ml.profile_info.rasgos.map(r => `<div style="font-size:.9rem;padding:2px 0;">• ${r}</div>`).join('')}
            </div>
            <div style="font-size:.82rem;color:#546E7A;margin-bottom:8px;font-weight:600;">
              Distribución de indicadores (modelo):
            </div>
            <div class="prob-bars">
              ${Object.entries(ml.all_probs).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v]) => `
                <div class="prob-bar-item ${k===ml.predicted_profile?'is-pred':''}">
                  <div class="pn">${k.replace(/_/g,' ')}</div>
                  <div class="pv">${(v*100).toFixed(1)} %</div>
                </div>`).join('')}
            </div>
          ` : `
            <p class="text-muted">
              ${ml && ml.error ? ml.error : 'Modelo IA no disponible.'}
              Las métricas objetivas son válidas para el análisis.
            </p>`}
        </div>

        <!-- D) Narrativa técnica -->
        <div class="card mb-4">
          <div class="section-title">Descripción del Rendimiento Cognitivo</div>
          <div class="narrative-box">${narrative}</div>
        </div>

        <!-- Botones finales -->
        <div class="flex gap-2 flex-end mb-8">
          <button class="btn btn-secondary" onclick="App.nav('menu')">🏠 Menú</button>
          <button class="btn btn-ghost" onclick="App.nav('form')">🔄 Nueva evaluación</button>
          ${this.evalId ? `<button class="btn btn-success btn-lg" onclick="App.downloadExcel()">📊 Descargar Excel completo</button>` : ''}
        </div>
      </div>`;

    // Render charts after DOM is ready
    requestAnimationFrame(() => {
      renderResultCharts(this.linesData, this.metrics, this.mlPred);
    });
  },

  downloadExcel() {
    if (!this.evalId) return;
    this.downloadById(this.evalId);
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 6: HISTORIAL
  ══════════════════════════════════════════════════════════════════════ */
  async renderHistory(app) {
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Historial de Evaluaciones</h1></div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')">← Menú</button>
      </div>
      <div class="page fade-in">
        <div class="card" id="history-card">
          <div style="text-align:center;padding:20px;color:#546E7A;">Cargando...</div>
        </div>
      </div>`;

    let rows = [];
    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(API_BASE + '/api/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      rows = await r.json();
    } catch(e) {}

    const card = document.getElementById('history-card');
    if (!rows.length) {
      card.innerHTML = '<p class="text-muted" style="text-align:center;padding:40px;">No hay evaluaciones guardadas.</p>';
      return;
    }

    card.innerHTML = `
      <div class="flex flex-between items-center mb-4">
        <div class="section-title" style="border:none;margin:0;padding:0;">
          ${rows.length} evaluacion${rows.length > 1 ? 'es' : ''} guardada${rows.length > 1 ? 's' : ''}
        </div>
      </div>
      <table class="history-table">
        <thead>
          <tr><th>#</th><th>Fecha</th><th>ID</th><th>Nombre</th><th>Edad</th><th>CP %</th><th>TA</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.id}</td>
              <td>${new Date(r.created_at).toLocaleString('es',{dateStyle:'short',timeStyle:'short'})}</td>
              <td>${r.participant_id}</td>
              <td>${r.participant_name}</td>
              <td>${r.age}</td>
              <td><span style="font-weight:700;color:${r.CP>=75?'#2E7D32':r.CP>=50?'#E65100':'#B71C1C'}">${r.CP}</span></td>
              <td>${r.TA}</td>
              <td class="flex gap-2">
                <button class="btn btn-primary btn-sm" onclick="App.downloadById(${r.id})">📥 Excel</button>
                <button class="btn btn-danger btn-sm" onclick="App.deleteEval(${r.id}, this)">🗑</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  },

  async downloadById(id) {
    try {
      const btn = event.target;
      btn.textContent = "Cargando...";
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(`${API_BASE}/api/export/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      btn.textContent = "📥 Excel";
      if (d.url) {
        window.open(d.url, '_blank');
      } else {
        alert(d.detail || "URL no disponible");
      }
    } catch(e) { alert("Error al contactar con la nube"); }
  },

  async deleteEval(id, btn) {
    if (!confirm('¿Eliminar definitivamente esta evaluación (BD y Storage)?')) return;
    try {
      btn.textContent = "...";
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      await fetch(`${API_BASE}/api/history/${id}`, { 
        method:'DELETE',
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      btn.closest('tr').remove();
    } catch(e) { alert('Error al eliminar.'); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
