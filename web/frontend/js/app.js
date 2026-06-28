// app.js — PLC Professional SPA
// Gestión de estado y renderizado de todas las pantallas

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://dalamus2405-plc-backend.hf.space';

const App = {
  /* ── Estado ──────────────────────────────────────────────────────────── */
  screen: 'login',
  supabase: null,
  user: null,
  modelOk: false,
  modelWakingUp: false,
  participant: null,
  historyRows: [],
  testLines: [],   // cada línea: array de 47 estímulos
  linesData: [],   // resultados por línea
  clickLog: [],
  currentLine: 0,
  mlPred: null,
  metrics: null,
  evalId: null,
  evalFilename: null,
  // Timer
  timerInterval: null,
  lineStartTime: null,
  timerRunning: false,
  // Pre-test
  preButtons: [],
  preOk: 0,
  preNeed: 2,
  // Test line state
  charBtns: [],
  currentSels: new Set(),

  TOTAL_LINES: 14,
  TIME_PER_LINE: 20,
  CHARS_PER_LINE: 47,

  /* ── Init ──────────────────────────────────────────────────────────────── */
  async init() {
    // Configuración de Supabase
    const SUPABASE_URL = 'https://lfyaiwbtfgoiczyyzlwh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWFpd2J0ZmdvaWN6eXl6bHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjc1MTEsImV4cCI6MjA5MDY0MzUxMX0.ZfVceXuYWQKEZimgRLt9kGkSGpq8FO7kRgKbL-Ta-3M';
    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.user = session.user;
      }
    } catch (e) { }

    // Si hay usuario logueado -> menú, si no -> login
    if (this.user) {
      this.warmUpModel();
      this.nav('menu');
    } else {
      this.nav('login');
    }
  },

  async warmUpModel() {
    this.modelWakingUp = true;
    if (this.screen === 'menu') this.render();
    try {
      const timeoutObj = new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 30000));
      const fetchObj = fetch(API_BASE + '/api/status');
      const r = await Promise.race([fetchObj, timeoutObj]);
      const d = await r.json();
      this.modelOk = d.model_available;
    } catch (e) {
      this.modelOk = false;
    }
    this.modelWakingUp = false;
    if (this.screen === 'menu') this.render();
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
    switch (this.screen) {
      case 'login': this.renderLogin(app); break;
      case 'menu': this.renderMenu(app); break;
      case 'form': this.renderForm(app); break;
      case 'pretest': this.renderPreTest(app); break;
      case 'practice': this.renderPractice(app); break;
      case 'test': this.renderTest(app); break;
      case 'completion': this.renderCompletionScreen(app); break;
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
    const pwd = document.getElementById('login-pwd').value;
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
          <div class="model-badge ${this.modelWakingUp ? 'off' : this.modelOk ? 'ok' : 'off'}" style="width:fit-content;transition: 0.3s all;">
            <span class="dot"></span>
            ${this.modelWakingUp
        ? '⏳ I.A. Despertando (Hugging Face puede tardar ~1min)'
        : this.modelOk
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
              ${['Masculino', 'Femenino', 'Otro', 'No especificado'].map(o =>
      `<label><input type="radio" name="gender" value="${o}" ${o === 'Masculino' ? 'checked' : ''}/> ${o}</label>`
    ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Nivel Educativo</label>
            <div class="radio-group" id="rg-edu">
              ${['Primaria', 'Secundaria', 'Universitario', 'Posgrado'].map(o =>
      `<label><input type="radio" name="education" value="${o}" ${o === 'Universitario' ? 'checked' : ''}/> ${o}</label>`
    ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Lateralidad</label>
            <div class="radio-group" id="rg-hand">
              ${['Derecha', 'Izquierda', 'Ambidiestro'].map(o =>
      `<label><input type="radio" name="hand" value="${o}" ${o === 'Derecha' ? 'checked' : ''}/> ${o}</label>`
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
    const id = document.getElementById('f-id').value.trim();
    const name = document.getElementById('f-name').value.trim();
    const age = parseInt(document.getElementById('f-age').value);
    if (!id) { Math.random(); alert('El ID del participante es obligatorio.'); return; }
    if (!name || name.length < 3) { alert('El Nombre debe tener al menos 3 caracteres.'); return; }
    if (!age || age < 5 || age > 100) { alert('Ingrese una edad válida entre 5 y 100 años.'); return; }
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'No especificado';
    const education = document.querySelector('input[name="education"]:checked')?.value || 'Universitario';
    const hand = document.querySelector('input[name="hand"]:checked')?.value || 'Derecha';
    const occupation = document.getElementById('f-occ').value.trim();
    this.participant = { id, name, age, gender, education, hand, occupation };
    this.nav('pretest');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 3: PRE-PRUEBA (Instrucciones)
  ══════════════════════════════════════════════════════════════════════ */
  renderPreTest(app) {
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Instrucciones de la Prueba</h1>
          <div class="sub">Por favor lea cuidadosamente antes de continuar</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('form')">← Volver al Formulario</button>
      </div>

      <div class="page fade-in" style="max-width: 960px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start;">
          
          <!-- Panel Izquierdo: Target -->
          <div class="card" style="text-align: center; border: 2px solid #3949AB; background: #E8EAF6;">
            <div style="font-weight: 700; color: #1A237E; font-size: 1.3rem; margin-bottom: 24px;">
              Símbolo Objetivo
            </div>
            
            <div style="background: #fff; border-radius: 12px; padding: 40px; display: inline-block; box-shadow: 0 8px 24px rgba(0,0,0,0.06); margin-bottom: 24px;">
              <canvas id="target-huge" width="120" height="160"></canvas>
            </div>
            
            <p style="font-size: 1.1rem; color: #3949AB; font-weight: 500; padding: 0 16px; line-height: 1.5;">
              Este es el <strong>único</strong> símbolo que deberás marcar.<br/>Memorízalo bien.
            </p>
            <div style="font-size: 0.9rem; color: #546E7A; margin-top: 15px; line-height: 1.5; background: #f8f9fa; padding: 10px; border-radius: 8px; border-left: 4px solid #1A1A2E;">
              <strong>Referencia visual:</strong> Cruz con un cuadrado negro <u>solo</u> en los extremos <strong>izquierdo y derecho</strong>. La línea horizontal debe estar <strong>exactamente en el centro</strong> de la figura.
            </div>
          </div>

          <!-- Panel Derecho: Instrucciones -->
          <div class="card" style="display: flex; flex-direction: column; gap: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="font-weight: 700; color: #283593; font-size: 1.3rem; border-bottom: 2px solid #E8EAF6; padding-bottom: 12px;">
              Reglas de Ejecución
            </div>
            
            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin-bottom: 6px;">
                <span style="background: #3949AB; color: white; width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.85rem;">1</span> 
                Metodología
              </strong>
              <p style="color: #546E7A; line-height: 1.6; margin: 0; padding-left: 32px;">
                La prueba se resuelve por líneas, siempre de <strong>izquierda a derecha</strong>. Al terminar una línea, comienza la siguiente desde el extremo izquierdo de la fila de abajo.
              </p>
            </div>

            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin-bottom: 6px;">
                <span style="background: #3949AB; color: white; width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.85rem;">2</span> 
                Tiempo
              </strong>
              <p style="color: #546E7A; line-height: 1.6; margin: 0; padding-left: 32px;">
                Cuentas con <strong>20 segundos</strong> por cada línea de estímulos. El sistema cambiará de línea automáticamente al agotarse el tiempo.
              </p>
            </div>

            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin-bottom: 6px;">
                <span style="background: #3949AB; color: white; width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.85rem;">3</span> 
                Acción
              </strong>
              <p style="color: #546E7A; line-height: 1.6; margin: 0; padding-left: 32px;">
                Haz clic o toca <strong>solo los símbolos que sean idénticos al objetivo</strong> mostrado a la izquierda. Si te equivocas, vuelve a hacer clic para desmarcarlo.
              </p>
            </div>

            <hr class="form-divider" style="margin: 8px 0;" />

            <div style="background: rgba(46, 125, 50, 0.08); border-left: 4px solid #2E7D32; padding: 16px 20px; border-radius: 0 8px 8px 0;">
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin: 0; user-select: none;">
                <input type="checkbox" id="chk-entendido" style="width: 22px; height: 22px; accent-color: #2E7D32; cursor: pointer;" onchange="document.getElementById('btn-practica').disabled = !this.checked">
                <span style="font-weight: 600; color: #1B5E20; font-size: 1.05rem;">He comprendido las instrucciones</span>
              </label>
            </div>

            <button disabled id="btn-practica" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; padding: 16px; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(40, 53, 147, 0.2);" onclick="App.nav('practice')">
              Entendido, ir a la práctica &nbsp;→
            </button>
          </div>

        </div>
      </div>
    `;

    // Draw HUGE target
    const tgtCtx = document.getElementById('target-huge').getContext('2d');
    tgtCtx.scale(2, 2);
    drawPLCStimulus(tgtCtx, STIM_TYPES['T'], SW, SH, '#1A1A2E', '#FFFFFF', 1.8);
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 3.5: PRÁCTICA
  ══════════════════════════════════════════════════════════════════════ */
  renderPractice(app) {
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Mini-Prueba de Práctica</h1>
          <div class="sub">Familiarícese con la tarea. El tiempo es ilimitado.</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('pretest')">← Volver a Instrucciones</button>
      </div>

      <div class="page fade-in" style="max-width: 900px;">
        <div class="card" style="text-align: center; padding-top: 32px; padding-bottom: 40px;">
          <div style="font-weight: 700; color: #1A237E; font-size: 1.2rem; margin-bottom: 32px;">
            Encuentre y marque aquí los estímulos idénticos al objetivo (TARGET):
          </div>

          <!-- GRID de práctica (2 líneas x 8 estímulos) -->
          <div style="display: flex; flex-direction: column; gap: 32px; align-items: center; margin-bottom: 40px;" id="practice-container">
             <div class="stim-row" id="p-row-0" style="gap: 20px; display: flex; justify-content: center;"></div>
             <div class="stim-row" id="p-row-1" style="gap: 20px; display: flex; justify-content: center;"></div>
          </div>

          <div id="pre-feedback" style="min-height: 28px; font-size: 1.05rem; font-weight: 600; margin-bottom: 24px;"></div>

          <!-- Progress -->
          <div class="prog-bar-wrap mb-4" style="justify-content: center; max-width: 400px; margin: 0 auto 32px auto;">
            <span style="font-size: .95rem; color: #546E7A; font-weight: 500;">Objetivos encontrados:</span>
            <div class="prog-bar" style="width: 100%; height: 14px; border-radius: 8px;">
              <div class="prog-bar-fill" id="pre-prog" style="width:0%; transition: width 0.3s ease; border-radius: 8px;"></div>
            </div>
            <span id="pre-cnt" style="font-size: 1.2rem; font-weight: 800; color: #1A237E;">0 / 4</span>
          </div>

          <div class="flex flex-between items-center" style="max-width: 600px; margin: 0 auto; gap: 16px;">
            <button class="btn btn-warn" style="padding: 12px 24px;" onclick="App.resetPractice()">🔄 Repetir práctica</button>
            <button class="btn btn-primary btn-lg" id="start-btn" disabled style="padding: 14px 40px; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(40, 53, 147, 0.2);" onclick="App.startTest()">
              Iniciar Prueba Real &nbsp;→
            </button>
          </div>
        </div>
      </div>
    `;
    this.resetPractice();
  },

  resetPractice() {
    this.preOk = 0;
    this.preNeed = 4; // 2 lines * 2 targets each
    this.preButtons = [];

    const prow0 = document.getElementById('p-row-0');
    const prow1 = document.getElementById('p-row-1');
    if (!prow0 || !prow1) return;
    prow0.innerHTML = '';
    prow1.innerHTML = '';

    document.getElementById('pre-feedback').textContent = '';
    document.getElementById('pre-prog').style.width = '0%';
    document.getElementById('pre-cnt').textContent = `${0} / ${this.preNeed}`;

    const btn = document.getElementById('start-btn');
    if (btn) { btn.disabled = true; }

    // Generar 2 líneas de 8 estímulos cada una
    // Forzamos D13 (Alto) y D14 (Bajo) para que el paciente los aprenda como distractores
    const lines = [
      generatePracticeLine(8, ['D13']),
      generatePracticeLine(8, ['D14'])
    ];

    let globalIdx = 0;
    lines.forEach((line, rowIdx) => {
      const rowEl = rowIdx === 0 ? prow0 : prow1;
      line.forEach((sinfo) => {
        const currentIdx = globalIdx++;
        const canvas = document.createElement('canvas');
        canvas.width = SW + 10;
        canvas.height = SH + 10;
        canvas.className = 'stim';
        canvas.style.cursor = 'pointer';
        canvas.style.borderRadius = '8px'; // Smooth UI requested
        const ctx = canvas.getContext('2d');
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#1A1A2E', '#FFFFFF', 1.8);
        canvas.addEventListener('click', () => this.preToggle(currentIdx, canvas, sinfo, ctx));
        rowEl.appendChild(canvas);
        this.preButtons.push({ canvas, sinfo, sel: false, ctx });
      });
    });
  },

  preToggle(idx, canvas, sinfo, ctx) {
    const btn = this.preButtons[idx];
    const isT = sinfo.is_target;
    if (btn.sel) {
      btn.sel = false;
      canvas.className = 'stim';
      drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#1A1A2E', '#FFFFFF', 1.8);
      if (isT) this.preOk = Math.max(0, this.preOk - 1);
    } else {
      btn.sel = true;
      if (isT) {
        canvas.className = 'stim sel-ok';
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#2E7D32', '#E8F5E9', 2.2);
        this.preOk++;
        document.getElementById('pre-feedback').innerHTML =
          '<span style="color: #2E7D32;">✓ ¡Correcto!</span>';
      } else {
        canvas.className = 'stim sel-wrong';
        drawPLCStimulus(ctx, sinfo, SW + 10, SH + 10, '#B71C1C', '#FFEBEE', 2.2);
        document.getElementById('pre-feedback').innerHTML =
          '<span style="color: #B71C1C;">✗ Ese no es el objetivo. Revisa el cuadrado negro en AMBOS extremos.</span>';
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
          '<span style="color: #2E7D32; font-weight: 800; font-size: 1.15rem;">✓ ¡Práctica completada con éxito! Ya puedes iniciar la prueba.</span>';
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
    this.linesData = [];
    this.clickLog = [];
    this.testLines = Array.from({ length: this.TOTAL_LINES }, () => generateTestLine(this.CHARS_PER_LINE));
    this.nav('test');
  },

  renderTest(app) {
    if (this.currentLine >= this.TOTAL_LINES) { this.finishTest(); return; }

    const ld = this.testLines[this.currentLine];
    const split = 24;
    const row1 = ld.slice(0, split);
    const row2 = ld.slice(split);

    app.innerHTML = `
      <div id="test-screen">
        <!-- Header -->
        <div class="test-header">
          <span class="line-label">LÍNEA ${this.currentLine + 1} / ${this.TOTAL_LINES}</span>
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
    this.charBtns = [];
    this.currentSels = new Set();

    const drawRow = (rowEl, items, startIdx) => {
      items.forEach((sinfo, relIdx) => {
        const absIdx = startIdx + relIdx;
        const cell = document.createElement('div');
        cell.className = 'stim-cell';
        const canvas = document.createElement('canvas');
        canvas.width = SW;
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
    this.timerRunning = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tickTimer(), 100);
  },

  toggleStim(idx, canvas, sinfo, ctx) {
    const btn = this.charBtns[idx];
    const now = performance.now();
    this.clickLog.push({
      line: this.currentLine + 1,
      stim_idx: idx,
      is_target: sinfo.is_target,
      stim_key: sinfo.key,
      action: btn.sel ? 'desel' : 'sel',
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
    const elapsed = (performance.now() - this.lineStartTime) / 1000;
    const remaining = Math.max(0, this.TIME_PER_LINE - elapsed);
    const pct = (remaining / this.TIME_PER_LINE) * 100;

    const timerLbl = document.getElementById('timer-lbl');
    const timerBar = document.getElementById('timer-bar');
    if (!timerLbl || !timerBar) { clearInterval(this.timerInterval); return; }

    timerLbl.textContent = remaining.toFixed(1) + ' s';
    timerBar.style.width = pct + '%';

    if (remaining > 10) {
      timerLbl.style.color = '#fff';
      timerBar.className = 'timer-bar-fill';
    } else if (remaining > 5) {
      timerLbl.style.color = '#FFD54F';
      timerBar.className = 'timer-bar-fill warn';
    } else {
      timerLbl.style.color = '#EF9A9A';
      timerBar.className = 'timer-bar-fill crit';
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

    let hits = 0, oms = 0, coms = 0, targets = 0;
    
    // 1. Encontrar el último estímulo clickeado
    let maxIdx = -1;
    this.charBtns.forEach((b, idx) => {
      if (b.sel) maxIdx = idx;
    });

    // 2. Calificar solo hasta donde llegó la persona
    let evaluados = maxIdx >= 0 ? maxIdx + 1 : 0;
    
    for (let i = 0; i < evaluados; i++) {
      const b = this.charBtns[i];
      if (b.sinfo.is_target) { targets++; b.sel ? hits++ : oms++; }
      else if (b.sel) coms++;
    }

    // 3. Click-Tracker: Comportamiento errático (saltos de derecha a izquierda)
    let jumps = 0;
    let lastIdx = -1;
    let lineClicks = this.clickLog.filter(c => c.line === this.currentLine + 1 && c.action === 'sel');
    for (let c of lineClicks) {
       if (lastIdx !== -1 && c.stim_idx < lastIdx) {
          jumps++; // Rompió la regla de izquierda a derecha (retroceso visual)
       }
       lastIdx = c.stim_idx;
    }

    this.linesData.push({
      linea: this.currentLine + 1,
      targets_total: targets,
      aciertos: hits,
      omisiones: oms,
      comisiones: coms,
      evaluados: evaluados,
      saltos_erraticos: jumps,
      tiempo_s: +elapsed.toFixed(3),
      tiempo_pct: +(Math.min(elapsed, this.TIME_PER_LINE) / this.TIME_PER_LINE * 100).toFixed(1)
    });

    this.currentLine++;
    this.nav('test');
  },

  /* ══════════════════════════════════════════════════════════════════════
     FIN DEL TEST — cálculo + predicción + guardado
  ══════════════════════════════════════════════════════════════════════ */
  async finishTest() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.nav('completion'); // show completion/loading state immediately
    this.metrics = calcMetrics(this.linesData, this.clickLog, this.participant.age);
    this.metrics._age = this.participant.age;
    this.metrics._linesDataRef = this.linesData;

    // ML prediction via API
    try {
      const resp = await fetch(API_BASE + '/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } catch (e) { this.mlPred = { model_used: false, error: 'Error de conexión' }; }

    // Save + generate Excel
    try {
      const narrative = generateNarrative(this.metrics);
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';

      const saveResp = await fetch(API_BASE + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          participant: this.participant,
          lines_data: this.linesData,
          click_log: this.clickLog,
          metrics: {
            TA: this.metrics.TA, O: this.metrics.O, COM: this.metrics.COM,
            TN: this.metrics.TN, TOT: this.metrics.TOT, CON: this.metrics.CON,
            CP: this.metrics.CP, totalTime: this.metrics.totalTime,
            meanTpl: this.metrics.meanTpl, stdTpl: this.metrics.stdTpl,
            cvTime: this.metrics.cvTime, procSpeed: this.metrics.procSpeed,
            efficiency: this.metrics.efficiency, FA: this.metrics.FA,
            GQ: this.metrics.GQ, VAR: this.metrics.VAR,
            estabilidad: this.metrics.estabilidad, consistency: this.metrics.consistency,
            TRM: this.metrics.TRM, IVR: this.metrics.IVR,
            blockHits: this.metrics.blockHits, errorPat: this.metrics.errorPat,
            adjScore: this.metrics.adjScore, meanRt: this.metrics.meanRt,
            medRt: this.metrics.medRt, attnStyle: this.metrics.attnStyle,
            attnDesc: this.metrics.attnDesc
          },
          ml_prediction: this.mlPred,
          narrative
        })
      });
      const sd = await saveResp.json();
      this.evalId = sd.id;
      this.evalStatus = sd.status;
    } catch (e) { console.warn('Save error:', e); }

    this.isSaving = false;
    this.nav('completion');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 4.5: FINALIZACIÓN (Bloqueo de privacidad)
  ══════════════════════════════════════════════════════════════════════ */
  renderCompletionScreen(app) {
    if (this.isSaving) {
      app.innerHTML = `
        <div id="test-screen" style="background: linear-gradient(135deg, #1A237E 0%, #283593 100%); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div class="card" style="text-align:center; padding:60px; max-width:400px;">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <h2 style="color:#1A237E;">Procesando Datos...</h2>
            <p style="color:#546E7A;">Calculando métricas y guardando de forma segura.</p>
          </div>
        </div>`;
      return;
    }

    app.innerHTML = `
      <div id="test-screen" style="background: linear-gradient(135deg, #1A237E 0%, #283593 100%); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
        <div class="card fade-in" style="max-width: 500px; width: 100%; text-align: center; padding: 40px; box-shadow: 0 15px 35px rgba(0,0,0,0.2);">
          
          <div style="font-size: 4rem; margin-bottom: 20px;">🎯</div>
          <h1 style="color: #1A237E; margin-bottom: 10px;">¡Evaluación Finalizada!</h1>
          <p style="color: #546E7A; font-size: 1.1rem; margin-bottom: 30px; line-height: 1.5;">
            La prueba ha concluido satisfactoriamente.<br/>Los datos han sido guardados de forma segura en la nube.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px;">
            <button class="btn btn-secondary" style="justify-content: center; width: 100%;" onclick="App.nav('menu')">
              🏠 Regresar al Menú Principal
            </button>
          </div>

          <hr style="border: 0; border-top: 1px solid #ECEFF1; margin: 20px 0;"/>

          <div id="unlock-section" style="background: #f8f9fa; padding: 20px; border-radius: 12px; border: 1px solid #ECEFF1;">
            <div style="font-weight: 600; color: #1A237E; margin-bottom: 12px; font-size: 0.95rem;">
              Panel de Resultados (Solo Profesional)
            </div>
            <div style="position: relative; margin-bottom: 12px;">
              <input type="password" id="unlock-pwd" placeholder="Ingrese su contraseña..." 
                style="width: 100%; padding: 12px 15px; border: 1.5px solid #CFD8DC; border-radius: 8px; font-family: 'Inter', sans-serif;" 
                onkeypress="if(event.key==='Enter') App.unlockResults()"/>
            </div>
            <div id="unlock-error" style="color: #B71C1C; font-size: 0.85rem; margin-bottom: 12px; min-height: 1.2em;"></div>
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="App.unlockResults(this)">
              🔓 Desbloquear Informe
            </button>
          </div>

        </div>
      </div>
    `;
  },

  async unlockResults(btn) {
    const pwd = document.getElementById('unlock-pwd').value;
    const errEl = document.getElementById('unlock-error');
    if (!pwd) {
      errEl.textContent = 'Ingrese la contraseña para continuar.';
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando...';
    }
    errEl.textContent = '';

    try {
      // Re-autenticamos para verificar la contraseña del profesional actual
      const { error } = await this.supabase.auth.signInWithPassword({
        email: this.user.email,
        password: pwd
      });

      if (error) {
        errEl.textContent = 'Contraseña incorrecta. Intente de nuevo.';
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔓 Desbloquear Informe';
        }
      } else {
        // Éxito: Mostrar resultados
        this.nav('results');
      }
    } catch (e) {
      errEl.textContent = 'Error de conexión. Reintente.';
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔓 Desbloquear Informe';
      }
    }
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 5: RESULTADOS
  ══════════════════════════════════════════════════════════════════════ */
  renderResults(app) {
    const m = this.metrics;
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
    const now = new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });

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
        ['TA  Aciertos', m.TA, '#E8F5E9', '#2E7D32'],
        ['O  Omisiones', m.O, '#FFF3E0', '#E65100'],
        ['C  Comisiones', m.COM, '#FFEBEE', '#B71C1C'],
        ['CP %  Concentración', m.CP.toFixed(1), '#E8EAF6', '#1A237E'],
        ['CON  Neto', m.CON, '#E8EAF6', '#283593'],
      ].map(([lbl, val, bg, fg]) => `
              <div class="metric-card" style="background:${bg};">
                <div class="val" style="color:${fg};">${val}</div>
                <div class="lbl">${lbl}</div>
              </div>`).join('')}
          </div>

          <hr class="form-divider"/>

          <div class="ext-metrics">
            ${[
        ['Velocidad', `${Math.round(m.procSpeed)} estím/min`],
        ['Estabilidad', `${Math.round(m.estabilidad)} %`],
        ['TRM Monotonía', `${m.TRM >= 0 ? '+' : ''}${m.TRM.toFixed(1)} %`],
        ['IVR Vel–Exactitud', m.IVR.toFixed(2)],
        ['TR medio', `${Math.round(m.meanRt)} ms`],
        ['Patrón Dominante', m.attnStyle],
        ['Redes Cognitivas', m.focusType],
      ].map(([lbl, val]) => `
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

        <!-- B.2) Notas de Comportamiento Visual -->
        <div class="card mb-4" style="border-left: 4px solid #F57F17;">
          <div class="section-title">Rastreo de Atención y Distracción</div>
          <p style="font-size:0.9rem; color:#546E7A; margin-bottom: 16px;">Registro de pérdida de barrido visual (saltos erráticos o retrocesos de derecha a izquierda).</p>
          <div class="charts-grid" style="grid-template-columns: 1fr;">
             <div class="chart-box" style="height: 220px; min-height: 220px;"><canvas id="chart-jumps"></canvas></div>
          </div>
          <div id="jumps-notes" style="margin-top: 20px; font-size: 0.95rem; background: #FFFDE7; padding: 15px; border-radius: 8px;">
            ${(function(){
              const linesWithJumps = m._linesDataRef ? m._linesDataRef.filter(l => l.saltos_erraticos > 0) : [];
              if (linesWithJumps.length === 0) {
                return '<div style="color:#2E7D32; font-weight:600;">✓ El paciente mantuvo un barrido visual disciplinado en todas las líneas.</div>';
              } else {
                return '<ul style="color:#BF360C; line-height: 1.6; margin: 0; padding-left: 20px;">' + 
                  linesWithJumps.map(l => \`<li><strong>Línea \${l.linea}:</strong> Se detectó comportamiento errático (\${l.saltos_erraticos} saltos/retrocesos). Posible pérdida de atención.</li>\`).join('') +
                  '</ul>';
              }
            })()}
          </div>
        </div>

        <!-- C) Perfil cognitivo MLP -->
        <div class="card mb-4">
          <div class="section-title">Clasificación Algorítmica Descriptiva</div>
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
              Similitud con Patrones Paramétricos Base (Bayes):
            </div>
            <div class="prob-bars">
              ${Object.entries(ml.all_probs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `
                <div class="prob-bar-item ${k === ml.predicted_profile ? 'is-pred' : ''}">
                  <div class="pn">${k.replace(/_/g, ' ')}</div>
                  <div class="pv">${(v * 100).toFixed(1)} %</div>
                </div>`).join('')}
            </div>
          ` : `
            <p class="text-muted">
              ${ml && ml.error ? ml.error : 'Báscula algorítmica no disponible o en reposo.'}
              <br>Las métricas biométricas crudas expuestas arriba son estadísticamente válidas.
            </p>
          `}
        </div>

        <div class="card mb-4" style="background-color: #FFF9C4; border: 1px solid #FBC02D;">
          <div style="font-weight:700; color:#BF360C; font-size:0.95rem; margin-bottom:6px;">NOTA METODOLÓGICA CLINÍCA</div>
          <div style="font-size:0.85rem; color:#BF360C; line-height:1.5;">
            Los datos representados en este informe (tablas, gráficas y textos automáticos) describen parámetros puramente observacionales capturados por el sistema. <b>El software NO diagnostica ni califica cognitivamente al usuario.</b> La ponderación e interpretación psicométrica recae estrictamente sobre el criterio y entrenamiento clínico del profesional evaluador basándose en estas volumetrías biológicas.
          </div>
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

      <!-- Modal Clínico (Inyectado) -->
      <div id="clinical-modal" class="modal-overlay">
        <div class="modal-clinical">
          <button class="modal-close" onclick="document.getElementById('clinical-modal').classList.remove('active'); destroyCharts();">×</button>
          <div class="section-title">Dashboard Clínico del Paciente</div>
          
          <div id="modal-patient-info" style="margin-bottom: 20px; font-weight: 600; color: var(--primary);"></div>
          
          <div class="semaforo-container" id="modal-semaforo">
            <!-- Renderizado dinámico -->
          </div>

          <div class="charts-grid">
            <div class="chart-box"><canvas id="chart-behavior"></canvas></div>
            <div class="chart-box"><canvas id="chart-metrics"></canvas></div>
            <div class="chart-box"><canvas id="chart-errors"></canvas></div>
            <div class="chart-box"><canvas id="chart-normal"></canvas></div>
          </div>
        </div>
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
      this.historyRows = rows;
    } catch (e) { }

    const card = document.getElementById('history-card');
    if (!rows || !rows.length) {
      card.innerHTML = '<p class="text-muted" style="text-align:center;padding:40px;">No hay evaluaciones guardadas.</p>';
      return;
    }

    card.innerHTML = `
      <div class="flex flex-between items-center mb-4" style="flex-wrap: wrap; gap: 10px;">
        <div class="section-title" style="border:none;margin:0;padding:0;">
          ${rows.length} evaluacion${rows.length > 1 ? 'es' : ''} guardada${rows.length > 1 ? 's' : ''}
        </div>
        <div>
          <input type="text" id="history-search" placeholder="🔍 Buscar por ID o Nombre..." style="padding: 8px 14px; border-radius: 8px; border: 1px solid #CFD8DC; font-family: 'Inter', sans-serif; min-width: 250px;" oninput="App.filterHistory(this.value)" />
        </div>
      </div>
      <table class="history-table">
        <thead>
          <tr><th>#</th><th>Fecha</th><th>ID</th><th>Nombre</th><th>Edad</th><th>CP %</th><th>TA</th><th>Acciones</th></tr>
        </thead>
        <tbody id="history-tbody">
          ${this.generateHistoryRowsHTML(rows)}
        </tbody>
      </table>`;
  },

  generateHistoryRowsHTML(rows) {
    if (!rows.length) return `<tr><td colspan="8" style="text-align:center;color:#789;">No se encontraron resultados</td></tr>`;
    return rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${new Date(r.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${escapeHTML(r.participant_id)}</td>
        <td><strong>${escapeHTML(r.participant_name)}</strong></td>
        <td>${r.age}</td>
        <td><span style="font-weight:700;color:${r.CP >= 75 ? '#2E7D32' : r.CP >= 50 ? '#E65100' : '#B71C1C'}">${r.CP}</span></td>
        <td>${r.TA}</td>
        <td class="flex gap-2">
          <button class="btn btn-ghost btn-sm" style="background:#E8EAF6;color:#1A237E;" onclick="App.openWebReport(${r.id}, this)">👁️ Ver Web</button>
          ${r.status === 'processing' || r.status === 'pending' ?
        `<button class="btn btn-secondary btn-sm" disabled>⏳ Generando</button>` :
        r.status === 'error' ?
          `<button class="btn btn-danger btn-sm" disabled>❌ Error</button>` :
          `<button class="btn btn-primary btn-sm" onclick="App.downloadById(${r.id}, this)">📥 Excel</button>`
      }
          <button class="btn btn-danger btn-sm" onclick="App.deleteEval(${r.id}, this)">🗑</button>
        </td>
      </tr>`).join('');
  },

  filterHistory(query) {
    const q = (query || '').toLowerCase().trim();
    let filtered = this.historyRows;
    if (q) {
      filtered = this.historyRows.filter(r =>
        (r.participant_name || '').toLowerCase().includes(q) ||
        String(r.participant_id || '').toLowerCase().includes(q)
      );
    }
    const tbody = document.getElementById('history-tbody');
    if (tbody) tbody.innerHTML = this.generateHistoryRowsHTML(filtered);
  },

  async downloadById(id, btn) {
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "Cargando...";
    }
    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(`${API_BASE}/api/export/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      if (btn) {
        btn.textContent = "📥 Excel";
        btn.disabled = false;
      }
      if (d.url) {
        window.open(d.url, '_blank');
      } else {
        alert(d.detail || "URL no disponible");
      }
    } catch (e) {
      alert("Error al contactar con la nube");
      if (btn) {
        btn.textContent = "📥 Excel";
        btn.disabled = false;
      }
    }
  },

  async openWebReport(id, btn) {
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "⌛ Cargando...";
    }

    try {
      // Pedimos todo el JSON de forma segura por RLS
      const { data, error } = await this.supabase
        .from('evaluations')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert("Error al recuperar los datos del paciente.");
        if (btn) { btn.textContent = "👁️ Ver Web"; btn.disabled = false; }
        return;
      }

      const metrics = data.metrics_json;
      const lines = data.lines_json;
      const ml = data.ml_json;

      // 1. Mostrar Modal
      document.getElementById('clinical-modal').classList.add('active');
      document.getElementById('modal-patient-info').innerHTML = `
        Paciente: <span style="color:var(--text);font-weight:400;">${data.participant_name}</span> 
        | ID: <span style="color:var(--text);font-weight:400;">${data.participant_id}</span> 
        | Prueba: <span style="color:var(--text);font-weight:400;">${new Date(data.created_at).toLocaleString()}</span>
      `;

      // 2. Semáforo Normativo basado en el Perfil de Eficiencia (CP)
      const cp = metrics.CP || 0;
      let sColor = 'yellow', sTitle = 'Atípico - Monitorear', sDesc = 'Variabilidad atencional límite.';
      if (cp >= 75) {
        sColor = 'green'; sTitle = 'Rango Normativo'; sDesc = 'Rendimiento esperado p/ edad.';
      } else if (cp < 25) {
        sColor = 'red'; sTitle = 'Alerta Clínica'; sDesc = 'Desempeño fuera de rango poblacional.';
      }

      document.getElementById('modal-semaforo').innerHTML = `
        <div class="semaforo-box semaforo-${sColor}">
          <div class="semaforo-indicator"></div>
          <div class="semaforo-text">
            <div class="st-title">${sTitle}</div>
            <div class="st-desc" style="font-size:0.8rem;">CP: ${cp.toFixed(1)}% | ${sDesc}</div>
          </div>
        </div>
        <div class="semaforo-box semaforo-blue" style="background:var(--a-light);border:1px solid var(--border);">
          <div class="semaforo-indicator" style="background:var(--accent);"></div>
          <div class="semaforo-text">
            <div class="st-title">Confiabilidad Bayesiana</div>
            <div class="st-desc" style="font-size:0.8rem;">${(ml.confidence_percent || "0%")} (Calidad del ML)</div>
          </div>
        </div>
      `;

      // 3. Renderizar Gráficas (Destruye previas auto por función)
      renderResultCharts(lines, metrics, ml);

    } catch (e) {
      alert("Error al cargar la visualización");
    }

    if (btn) {
      btn.textContent = "👁️ Ver Web";
      btn.disabled = false;
    }
  },

  async deleteEval(id, btn) {
    if (!confirm('¿Eliminar definitivamente esta evaluación (BD y Storage)?')) return;
    try {
      btn.textContent = "...";
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      btn.closest('tr').remove();
    } catch (e) { alert('Error al eliminar.'); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
