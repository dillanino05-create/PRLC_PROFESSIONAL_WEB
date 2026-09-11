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

  // ── Biomarcadores de Cinématica del Cursor (Tremor/Jitter) ────────────────────
  mouseTrackPerLine: [],      // [[{x,y,t}, …], …] una subarray por línea
  _mouseMoveThrottleTs: 0,    // timestamp del último evento registrado
  _mouseMoveHandler: null,    // ref a la función listener para poder removerla

  // ── Biomarcadores Oculomotores (MediaPipe Face Mesh) ─────────────────────────
  faceMeshInstance: null,
  faceMeshRunning: false,
  earSamples: [],             // [{ ear, t, line }]
  gazeEvents: [],             // [{ start_t, duration_ms, line }]
  ferSamples: [],             // [{ tension, expr, is_frustration_peak, t, line }]
  _gazeDivertedStartTime: null,
  _lastFaceMeshTs: 0,
  _faceMeshBusy: false,
  _faceMeshTimer: null,

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

    // Registrador de ondas de clic (Ripples) para la grabación visomotriz
    document.addEventListener('click', (e) => {
      if (this.screen !== 'test' && this.screen !== 'practice') return;
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.pageX}px`;
      ripple.style.top = `${e.pageY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });

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
      case 'superadmin': this.renderSuperAdmin(app); break;
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
            ${this.user?.user_metadata?.role === 'superadmin' ? `
            <button class="btn btn-ghost btn-lg" style="background:rgba(255,215,0,.18);color:#FFD700;border:1.5px solid rgba(255,215,0,.5);" onclick="App.nav('superadmin')">
              🛡️ &nbsp; Panel Admin
            </button>` : ''}
            <button class="btn btn-danger btn-lg" onclick="App.doLogout()">
              Cerrar Sesión
            </button>
          </div>

          <!-- Footer -->
          <div style="font-size:0.8rem; color:var(--text-light); text-align:center; padding:10px;">
            PLC Professional v3.3 &nbsp;&middot;&nbsp; Uso exclusivo para profesionales
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
                La prueba se resuelve por páginas, siempre de <strong>izquierda a derecha</strong>. Al terminar una página, comienza la siguiente automáticamente.
              </p>
            </div>

            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin-bottom: 6px;">
                <span style="background: #3949AB; color: white; width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.85rem;">2</span> 
                Tiempo
              </strong>
              <p style="color: #546E7A; line-height: 1.6; margin: 0; padding-left: 32px;">
                Cuentas con <strong>20 segundos</strong> por cada página de estímulos. El sistema cambiará de página automáticamente al agotarse el tiempo.
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

            <button disabled id="btn-practica" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; padding: 16px; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(40, 53, 147, 0.2);" onclick="App.requestPermissionsAndGoToPractice()">
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
  async requestPermissionsAndGoToPractice() {
    // 1. Preguntar explícitamente si el usuario desea activar la cámara antes de solicitar cualquier permiso
    const existingCamModal = document.getElementById('camera-choice-modal');
    if (existingCamModal) existingCamModal.remove();

    const modalHtml = `
      <div id="camera-choice-modal" class="modal-overlay active" style="z-index: 100000;">
        <div class="modal-clinical" style="max-width: 480px; text-align: center; padding: 30px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">📷</div>
          <div class="section-title" style="margin-bottom: 14px;">Activación de Cámara Web</div>
          <p style="color: var(--text-light); line-height: 1.6; margin-bottom: 24px; font-size: 0.95rem;">
            ¿Deseas activar la cámara web para esta evaluación?<br/><br/>
            Si la activas, se registrará <b>en segundo plano</b> para el análisis de atención visual del participante.
          </p>
          <div style="display: flex; gap: 14px; justify-content: center;">
            <button class="btn btn-secondary" onclick="App.handleCameraChoice(false)" style="padding: 12px 20px;">
              🚫 No usar cámara
            </button>
            <button class="btn btn-primary btn-accent" onclick="App.handleCameraChoice(true)" style="padding: 12px 24px;">
              📷 Sí, activar cámara
            </button>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
  },

  async handleCameraChoice(wantCamera) {
    const camModal = document.getElementById('camera-choice-modal');
    if (camModal) camModal.remove();

    let cameraStream = null;
    let cameraStatus = 'declined';
    let cameraError = '';

    if (wantCamera) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStatus = 'ok';
        // Pre-compilación en background de MediaPipe FaceMesh para eliminar el congelamiento de 3s
        this.warmupFaceMesh();
      } catch (e) {
        console.warn("Cámara denegada o no disponible:", e);
        cameraStatus = 'error';
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          cameraError = "Permiso bloqueado en el navegador. Revisa el icono de cámara o candado en la barra de direcciones.";
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          cameraError = "No se detectó ninguna cámara física conectada.";
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          cameraError = "La cámara está siendo usada por otra aplicación (Zoom, Teams, etc.).";
        } else {
          cameraError = e.message || e.name;
        }
        cameraStream = null;
      }
    }

    this._pendingCameraStream = cameraStream;
    this.showMandatoryScreenModal(cameraStatus, cameraError);
  },

  showMandatoryScreenModal(cameraStatus, cameraError) {
    const existingScreenModal = document.getElementById('mandatory-screen-modal');
    if (existingScreenModal) existingScreenModal.remove();

    let cameraBadge = '';
    if (cameraStatus === 'ok') {
      cameraBadge = `<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:10px;padding:12px;margin-bottom:16px;color:#2E7D32;font-weight:600;font-size:0.9rem;">✅ Cámara web activada en segundo plano</div>`;
    } else if (cameraStatus === 'error') {
      cameraBadge = `
        <div style="background:#FFF3E0;border:1px solid #FFCC80;border-radius:10px;padding:12px;margin-bottom:16px;color:#E65100;font-weight:600;font-size:0.85rem;text-align:left;line-height:1.4;">
          ⚠️ Cámara no disponible — ${escapeHTML(cameraError)}
        </div>`;
    } else {
      cameraBadge = `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;margin-bottom:16px;color:#90A4AE;font-size:0.85rem;">ℹ️ Cámara desactivada a petición del usuario</div>`;
    }

    const modalHtml = `
      <div id="mandatory-screen-modal" class="modal-overlay active" style="z-index: 100000;">
        <div class="modal-clinical" style="max-width: 500px; text-align: center; padding: 30px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🖥️</div>
          <div class="section-title" style="margin-bottom: 14px;">Compartir Pantalla Obligatorio</div>
          
          ${cameraBadge}

          <div id="screen-share-alert" style="display:none;background:#FFEBEE;border:1.5px solid #EF5350;border-radius:10px;padding:14px;margin-bottom:16px;color:#C62828;font-size:0.9rem;text-align:left;line-height:1.4;">
            ⚠️ <b>Compartir pantalla es un requisito obligatorio ("sí o sí"):</b><br/>
            Para registrar el barrido visual y validar la autenticidad psicométrica del test, debes seleccionar tu pantalla o pestaña y presionar <b>Compartir</b>.
          </div>

          <p style="color: var(--text-light); line-height: 1.6; margin-bottom: 24px; font-size: 0.95rem;">
            Por protocolo clínico, la prueba <b>debe registrar la pantalla</b> durante toda la evaluación. Haz clic en el botón y selecciona tu pantalla en la ventana del navegador.
          </p>

          <button id="btn-mandatory-screen" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; padding: 16px; font-size: 1.05rem; box-shadow: 0 4px 12px rgba(40, 53, 147, 0.25);" onclick="App.executeMandatoryScreenShare()">
            🖥️ Compartir Pantalla y Continuar &nbsp;→
          </button>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
  },

  async executeMandatoryScreenShare() {
    const alertEl = document.getElementById('screen-share-alert');
    const btnShare = document.getElementById('btn-mandatory-screen');
    if (alertEl) alertEl.style.display = 'none';
    if (btnShare) {
      btnShare.disabled = true;
      btnShare.innerHTML = '⏳ Esperando selección en el navegador...';
    }

    let screenStream = null;
    try {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 15 }
          },
          audio: false,
          preferCurrentTab: true
        });
      } catch (advancedError) {
        console.warn("Fallback a getDisplayMedia básico (Safari/Opera/Firefox):", advancedError);
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      }
    } catch (e) {
      console.warn("Permiso de pantalla denegado/cancelado:", e);
      if (alertEl) alertEl.style.display = 'block';
      if (btnShare) {
        btnShare.disabled = false;
        btnShare.innerHTML = '🔄 Reintentar Compartir Pantalla (Obligatorio)';
      }
      return; // OBLIGATORIO: no avanza a la práctica sin compartir pantalla
    }

    // Éxito: cerrar modal y enlazar streams
    const modal = document.getElementById('mandatory-screen-modal');
    if (modal) modal.remove();

    this.screenStream = screenStream;
    this.cameraStream = this._pendingCameraStream || null;
    this._pendingCameraStream = null;

    if (screenStream && screenStream.getVideoTracks().length > 0) {
      screenStream.getVideoTracks()[0].onended = () => {
        console.warn("El usuario detuvo la compartición de pantalla.");
      };
    }

    this.startRecording();
    this.nav('practice');
  },

  startTest() {
    this.currentLine = 0;
    this.linesData = [];
    this.clickLog = [];
    this.testLines = Array.from({ length: this.TOTAL_LINES }, () => generateTestLine(this.CHARS_PER_LINE));
    this.nav('test');
  },

  startRecording() {
    this.recordedChunks = [];
    
    // Si NO hay stream de cámara, grabamos el stream de pantalla directamente para máximo rendimiento y latencia cero (0% CPU)
    if (!this.cameraStream) {
      const stream = this.screenStream;
      let options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      try {
        this.mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(stream);
      }
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(1000);
      return;
    }

    // Mezcla de pantalla + webcam con Canvas optimizado a 15 FPS
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const screenVideo = document.createElement('video');
    screenVideo.srcObject = this.screenStream;
    screenVideo.autoplay = true;
    screenVideo.playsInline = true;
    screenVideo.muted = true;
    screenVideo.style.position = 'fixed';
    screenVideo.style.left = '-9999px';
    screenVideo.style.top = '-9999px';
    screenVideo.style.width = '1px';
    screenVideo.style.height = '1px';
    screenVideo.style.opacity = '0';
    screenVideo.style.pointerEvents = 'none';
    document.body.appendChild(screenVideo);
    screenVideo.play().catch(e => console.warn(e));

    const cameraVideo = document.createElement('video');
    cameraVideo.srcObject = this.cameraStream;
    cameraVideo.autoplay = true;
    cameraVideo.playsInline = true;
    cameraVideo.muted = true;
    cameraVideo.style.position = 'fixed';
    cameraVideo.style.left = '-9999px';
    cameraVideo.style.top = '-9999px';
    cameraVideo.style.width = '1px';
    cameraVideo.style.height = '1px';
    cameraVideo.style.opacity = '0';
    cameraVideo.style.pointerEvents = 'none';
    document.body.appendChild(cameraVideo);
    cameraVideo.play().catch(e => console.warn(e));

    this.screenVideoElement = screenVideo;
    this.cameraVideoElement = cameraVideo;

    this.recordingActive = true;

    // Inicializar MediaPipe Face Mesh para análisis de parpadeo (EAR), desvío de mirada y emociones (FER)
    this.initFaceMeshTracking(cameraVideo);

    // Loop desacoplado asíncrono a ~1.5 FPS con mutex de no-bloqueo (cero lag, 60fps constantes en UI)
    this._faceMeshBusy = false;
    if (this._faceMeshTimer) clearTimeout(this._faceMeshTimer);

    const runFaceMeshInference = async () => {
      if (!this.recordingActive || !this.faceMeshRunning || !this.faceMeshInstance) return;
      if (!this._faceMeshBusy && cameraVideo && cameraVideo.readyState >= 2) {
        this._faceMeshBusy = true;
        try {
          await this.faceMeshInstance.send({ image: cameraVideo });
        } catch (err) {
          console.warn("FaceMesh send:", err);
        } finally {
          this._faceMeshBusy = false;
        }
      }
      if (this.recordingActive && this.faceMeshRunning) {
        this._faceMeshTimer = setTimeout(runFaceMeshInference, 650);
      }
    };
    setTimeout(runFaceMeshInference, 800);

    // Control estricto de FPS para evitar sobrecargar CPU en pantallas de alta tasa de refresco (ej. 144Hz)
    const fps = 15;
    const fpsInterval = 1000 / fps;
    let lastDrawTime = performance.now();

    const drawFrame = (timestamp) => {
      if (!this.recordingActive) return;
      requestAnimationFrame(drawFrame);

      const elapsed = timestamp - lastDrawTime;
      if (elapsed < fpsInterval) return;

      lastDrawTime = timestamp - (elapsed % fpsInterval);

      // drawFrame únicamente procesa el renderizado de pantalla y webcam a 15 fps fluidos

      // Dibujar captura de pantalla
      if (screenVideo.readyState >= 2 && screenVideo.videoWidth > 0) {
        ctx.drawImage(screenVideo, 0, 0, 1280, 720);
      } else {
        ctx.fillStyle = '#F5F7FA';
        ctx.fillRect(0, 0, 1280, 720);
      }

      // Dibujar webcam (overlay estilo streamer en la esquina superior derecha)
      if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
        const w = 240;
        const h = 180;
        const x = 1280 - w - 20;
        const y = 20;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 10);
        } else {
          ctx.rect(x - 2, y - 2, w + 4, h + 4);
        }
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, 8);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();
        ctx.drawImage(cameraVideo, x, y, w, h);
        ctx.restore();
      }
    };

    requestAnimationFrame(drawFrame);

    // Capturar stream del canvas a 15 fps estables
    const stream = canvas.captureStream(15);
    
    let options = { mimeType: 'video/webm;codecs=vp8' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000);
  },

  stopRecording() {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          this.recordingActive = false;
          
          // Apagar cámara y compartición de pantalla
          if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
          }
          if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
          }

          // Remover elementos de video del DOM
          if (this.screenVideoElement) {
            this.screenVideoElement.remove();
            this.screenVideoElement = null;
          }
          if (this.cameraVideoElement) {
            this.cameraVideoElement.remove();
            this.cameraVideoElement = null;
          }

          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          this.recordedVideoBlob = blob;

          // Detener y liberar MediaPipe Face Mesh
          this.faceMeshRunning = false;
          if (this._faceMeshTimer) {
            clearTimeout(this._faceMeshTimer);
            this._faceMeshTimer = null;
          }
          if (this.faceMeshInstance) {
            try { this.faceMeshInstance.close(); } catch (e) {}
            this.faceMeshInstance = null;
          }

          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        this.faceMeshRunning = false;
        resolve(null);
      }
    });
  },

  /* ── Pre-calentamiento silencioso en GPU (Elimina congelamiento inicial) ─ */
  warmupFaceMesh() {
    if (!window.FaceMesh || this.faceMeshInstance) return;
    try {
      this.faceMeshInstance = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
      this.faceMeshInstance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      // Warmup asíncrono con canvas diminuto de 16x16
      const dummy = document.createElement('canvas');
      dummy.width = 16;
      dummy.height = 16;
      this.faceMeshInstance.send({ image: dummy }).catch(() => {});
    } catch (e) {
      console.warn("FaceMesh warmup:", e);
    }
  },

  /* ── Inferencia MediaPipe Face Mesh (Edge-AI Oculometría) ─────────────── */
  initFaceMeshTracking(videoElement) {
    if (!window.FaceMesh) {
      console.warn("MediaPipe FaceMesh no cargado en window.");
      return;
    }
    try {
      this.earSamples = [];
      this.gazeEvents = [];
      this._gazeDivertedStartTime = null;
      this._lastFaceMeshTs = 0;

      if (!this.faceMeshInstance) {
        this.faceMeshInstance = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMeshInstance.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      }

      this.faceMeshInstance.onResults((results) => {
        if (!this.recordingActive) return;
        const now = performance.now();

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          if (!this._gazeDivertedStartTime) {
            this._gazeDivertedStartTime = now;
          }
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];

        // Cálculo de EAR (Eye Aspect Ratio)
        // Ojo Izquierdo: top 159, bot 145, left 33, right 133
        const distL_v = Math.hypot(landmarks[159].x - landmarks[145].x, landmarks[159].y - landmarks[145].y);
        const distL_h = Math.hypot(landmarks[33].x - landmarks[133].x, landmarks[33].y - landmarks[133].y);
        const earL = distL_h > 0 ? (distL_v / distL_h) : 0.28;

        // Ojo Derecho: top 386, bot 374, left 362, right 263
        const distR_v = Math.hypot(landmarks[386].x - landmarks[374].x, landmarks[386].y - landmarks[374].y);
        const distR_h = Math.hypot(landmarks[362].x - landmarks[263].x, landmarks[362].y - landmarks[263].y);
        const earR = distR_h > 0 ? (distR_v / distR_h) : 0.28;

        const earAvg = (earL + earR) / 2.0;
        this.earSamples.push({
          ear: parseFloat(earAvg.toFixed(3)),
          t: now,
          line: this.currentLine + 1
        });

        // Detección de Desvío de Mirada / Postura Cefálica (Yaw / Pitch)
        const faceWidth = Math.hypot(landmarks[234].x - landmarks[454].x, landmarks[234].y - landmarks[454].y);
        const noseX = landmarks[1].x;
        const midFaceX = (landmarks[234].x + landmarks[454].x) / 2;
        const yawOffset = faceWidth > 0 ? (noseX - midFaceX) / faceWidth : 0;

        // Umbral de desvío: giro de cabeza o mirada fuera del canvas
        const isDiverted = Math.abs(yawOffset) > 0.16;

        if (isDiverted) {
          if (!this._gazeDivertedStartTime) {
            this._gazeDivertedStartTime = now;
          }
        } else {
          if (this._gazeDivertedStartTime) {
            const duration = now - this._gazeDivertedStartTime;
            if (duration >= 350) { // Desvío continuo de más de 350 ms
              this.gazeEvents.push({
                start_t: this._gazeDivertedStartTime,
                duration_ms: duration,
                line: this.currentLine + 1
              });
            }
            this._gazeDivertedStartTime = null;
          }
        }

        // 3. FER (Facial Emotion Recognition): Action Units AU4 (ceño fruncido) y AU24 (tensión labial)
        // Referencia anatómica constante: Distancia interocular externa (33 a 263)
        const eyeDist = Math.hypot(landmarks[33].x - landmarks[263].x, landmarks[33].y - landmarks[263].y);
        const safeEyeDist = eyeDist > 0 ? eyeDist : 0.25;

        // AU4 - Acercamiento medial de cejas (107 y 336)
        const browDist = Math.hypot(landmarks[107].x - landmarks[336].x, landmarks[107].y - landmarks[336].y);
        const browRatio = browDist / safeEyeDist; // Normal: ~0.46 - 0.55. Fruncido: < 0.40.

        // AU4 - Descenso vertical de cejas hacia los párpados
        const browLeftToEye = Math.hypot(landmarks[107].x - landmarks[159].x, landmarks[107].y - landmarks[159].y);
        const browRightToEye = Math.hypot(landmarks[336].x - landmarks[386].x, landmarks[336].y - landmarks[386].y);
        const browDrop = ((browLeftToEye + browRightToEye) / 2.0) / safeEyeDist; // Normal: ~0.19 - 0.25. Deprimido: < 0.16.

        // AU24 - Compresión labial (13 y 14 vs 61 y 291)
        const lipHeight = Math.hypot(landmarks[13].x - landmarks[14].x, landmarks[13].y - landmarks[14].y);
        const lipWidth = Math.hypot(landmarks[61].x - landmarks[291].x, landmarks[61].y - landmarks[291].y);
        const lipRatio = lipWidth > 0 ? (lipHeight / lipWidth) : 0.20;

        let tension = 0;
        let isFrustrationPeak = false;
        let expr = 'Concentración';

        // Clasificación calibrada de tensión facial y frustración
        if (browRatio < 0.39 || browDrop < 0.15) {
          tension += 65;
          isFrustrationPeak = true;
          expr = 'Frustración / Tensión';
        } else if (browRatio < 0.44 || browDrop < 0.18) {
          tension += 35;
          expr = 'Sobreesfuerzo';
        }

        if (lipRatio < 0.10) {
          tension += 25;
          if (tension > 50) expr = 'Tensión Psicomotora';
        }

        if (earAvg < 0.19) {
          expr = 'Fatiga Visual';
        }

        tension = Math.min(100, Math.max(0, tension));
        if (tension < 20 && expr === 'Concentración') {
          expr = 'Foco Sereno';
        }

        this.ferSamples.push({
          tension: tension,
          expr: expr,
          is_frustration_peak: isFrustrationPeak,
          t: now,
          line: this.currentLine + 1
        });
      });

      this.faceMeshRunning = true;
    } catch (err) {
      console.warn("No se pudo iniciar FaceMesh:", err);
      this.faceMeshRunning = false;
    }
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
          <span class="line-label">PÁGINA ${this.currentLine + 1} / ${this.TOTAL_LINES}</span>
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

    // ── Biomarcadores Motor: inicializar tracking del cursor para esta línea ───────
    this.mouseTrackPerLine[this.currentLine] = [];
    this._mouseMoveThrottleTs = 0;
    if (this._mouseMoveHandler) {
      window.removeEventListener('mousemove', this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }
    this._mouseMoveHandler = (e) => {
      const _now = performance.now();
      if (_now - this._mouseMoveThrottleTs < 16) return; // Throttle a ~60fps
      this._mouseMoveThrottleTs = _now;
      if (!this.mouseTrackPerLine[this.currentLine]) {
        this.mouseTrackPerLine[this.currentLine] = [];
      }
      this.mouseTrackPerLine[this.currentLine].push({
        x: e.clientX,
        y: e.clientY,
        t: _now
      });
    };
    window.addEventListener('mousemove', this._mouseMoveHandler, { passive: true });

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

    // 4. Biomarcadores Motor: limpiar listener y calcular tremor y barrido del cursor
    if (this._mouseMoveHandler) {
      window.removeEventListener('mousemove', this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }
    const currentSamples = this.mouseTrackPerLine[this.currentLine] || [];
    const tremorResult = computeTremorScore(currentSamples);
    const sweepResult = computeSweepMetrics(currentSamples);

    // Oculometría de la línea actual
    const lineEarSamples = (this.earSamples || []).filter(s => s.line === this.currentLine + 1);
    const lineEarAvg = lineEarSamples.length > 0
      ? parseFloat((lineEarSamples.reduce((a, b) => a + (b.ear || 0), 0) / lineEarSamples.length).toFixed(3))
      : null;
    let lineBlinks = 0;
    let inBlink = false;
    for (let s of lineEarSamples) {
      if ((s.ear || 0) < 0.20 && !inBlink) { lineBlinks++; inBlink = true; }
      else if ((s.ear || 0) >= 0.20) { inBlink = false; }
    }
    const lineGazeDiverted = (this.gazeEvents || []).some(ev => ev.line === this.currentLine + 1);

    this.linesData.push({
      linea: this.currentLine + 1,
      targets_total: targets,
      aciertos: hits,
      omisiones: oms,
      comisiones: coms,
      evaluados: evaluados,
      saltos_erraticos: jumps,
      tremor_score: Number(tremorResult.score || 0.0),
      tremor_flag: Boolean(tremorResult.flag),
      microtremor_score: (tremorResult.microtremor !== undefined && tremorResult.microtremor !== null) ? Number(tremorResult.microtremor) : Number(tremorResult.score || 0.0),
      sweep_regularity: (sweepResult.sweep_regularity !== undefined && sweepResult.sweep_regularity !== null) ? Number(sweepResult.sweep_regularity) : 100.0,
      retrocesos_mouse: Number(sweepResult.retrocesos || 0),
      ear_avg: lineEarAvg,
      blinks_count: lineEarSamples.length > 0 ? lineBlinks : null,
      gaze_diverted: lineGazeDiverted,
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
    
    // 1. Detener la grabación de video y obtener el Blob
    const videoBlob = await this.stopRecording();
    
    this.metrics = calcMetrics(this.linesData, this.clickLog, this.participant.age);
    this.metrics._age = this.participant.age;
    this.metrics._linesDataRef = this.linesData;

    // Detener tracking de MediaPipe si estaba activo y cerrar eventos pendientes
    this.faceMeshRunning = false;
    if (this._gazeDivertedStartTime) {
      const dur = performance.now() - this._gazeDivertedStartTime;
      if (dur >= 350) {
        this.gazeEvents.push({ start_t: this._gazeDivertedStartTime, duration_ms: dur, line: this.currentLine + 1 });
      }
      this._gazeDivertedStartTime = null;
    }

    const hasCameraStream = Boolean(
      this.cameraStream && 
      (this.cameraStream.active !== false) &&
      (this.cameraStream.getVideoTracks && this.cameraStream.getVideoTracks().length > 0)
    );
    const oculoMetrics = computeOculomotorMetrics(this.earSamples, this.gazeEvents, this.metrics.totalTime, hasCameraStream);
    const ferMetrics = computeFERMetrics(this.ferSamples, hasCameraStream);

    // Promedios motores globales
    const validTremors = this.linesData.map(l => (l.microtremor_score !== undefined && l.microtremor_score !== null) ? Number(l.microtremor_score) : 0);
    const microtremor_avg = validTremors.length > 0
      ? parseFloat((validTremors.reduce((a, b) => a + b, 0) / validTremors.length).toFixed(2))
      : 0.0;
    const validSweeps = this.linesData.map(l => (l.sweep_regularity !== undefined && l.sweep_regularity !== null) ? Number(l.sweep_regularity) : 100.0);
    const sweep_regularity_avg = validSweeps.length > 0
      ? parseFloat((validSweeps.reduce((a, b) => a + b, 0) / validSweeps.length).toFixed(1))
      : 100.0;

    // Consolidar en this.metrics
    this.metrics.camera_active = Boolean(oculoMetrics.camera_active);
    this.metrics.ear_mean = (oculoMetrics.ear_mean !== null && oculoMetrics.ear_mean !== undefined) ? Number(oculoMetrics.ear_mean) : null;
    this.metrics.blink_count = Number(oculoMetrics.blink_count || 0);
    this.metrics.blink_rate_min = Number(oculoMetrics.blink_rate_min || 0);
    this.metrics.gaze_diverted_count = Number(oculoMetrics.gaze_diverted_count || 0);
    this.metrics.gaze_diverted_ms = Number(oculoMetrics.gaze_diverted_ms || 0);
    this.metrics.microtremor_avg = microtremor_avg;
    this.metrics.sweep_regularity_avg = sweep_regularity_avg;
    this.metrics.fer_dominant = ferMetrics.fer_dominant;
    this.metrics.fer_tension_score = ferMetrics.fer_tension_score;
    this.metrics.fer_frustration_events = ferMetrics.fer_frustration_events;

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
          block_hits: this.metrics.blockHits,
          // Nuevos biomarcadores conductuales y oculomotores
          camera_active: this.metrics.camera_active,
          ear_mean: this.metrics.ear_mean,
          blink_count: this.metrics.blink_count,
          blink_rate_min: this.metrics.blink_rate_min,
          gaze_diverted_count: this.metrics.gaze_diverted_count,
          gaze_diverted_ms: this.metrics.gaze_diverted_ms,
          microtremor_avg: this.metrics.microtremor_avg,
          sweep_regularity_avg: this.metrics.sweep_regularity_avg,
          fer_dominant: this.metrics.fer_dominant,
          fer_tension_score: this.metrics.fer_tension_score,
          fer_frustration_events: this.metrics.fer_frustration_events
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
            attnDesc: this.metrics.attnDesc, focusType: this.metrics.focusType,
            isIncomplete: this.metrics.isIncomplete, lastLine: this.metrics.lastLine,
            lastChar: this.metrics.lastChar,
            tremor_lines: this.linesData.filter(l => l.tremor_flag).map(l => l.linea),
            // Nuevos biomarcadores en metrics
            camera_active: this.metrics.camera_active,
            ear_mean: this.metrics.ear_mean,
            blink_count: this.metrics.blink_count,
            blink_rate_min: this.metrics.blink_rate_min,
            gaze_diverted_count: this.metrics.gaze_diverted_count,
            gaze_diverted_ms: this.metrics.gaze_diverted_ms,
            microtremor_avg: this.metrics.microtremor_avg,
            sweep_regularity_avg: this.metrics.sweep_regularity_avg,
            fer_dominant: this.metrics.fer_dominant,
            fer_tension_score: this.metrics.fer_tension_score,
            fer_frustration_events: this.metrics.fer_frustration_events
          },
          ml_prediction: this.mlPred,
          narrative
        })
      });
      const sd = await saveResp.json();
      this.evalId = sd.id;
      this.evalStatus = sd.status;


      // 2. Si se grabó video, subirlo al bucket exports y actualizar el registro en base de datos
      if (videoBlob && this.evalId) {
        const videoName = `recording_${this.evalId}.webm`;
        const { data, error } = await this.supabase.storage
          .from('exports')
          .upload(videoName, videoBlob, {
            contentType: 'video/webm',
            cacheControl: '3600',
            upsert: true
          });

        if (!error) {
          const updatedMetrics = {
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
            attnDesc: this.metrics.attnDesc, focusType: this.metrics.focusType,
            isIncomplete: this.metrics.isIncomplete, lastLine: this.metrics.lastLine,
            lastChar: this.metrics.lastChar,
            tremor_lines: this.linesData.filter(l => l.tremor_flag).map(l => l.linea),
            camera_active: this.metrics.camera_active,
            ear_mean: this.metrics.ear_mean,
            blink_count: this.metrics.blink_count,
            blink_rate_min: this.metrics.blink_rate_min,
            gaze_diverted_count: this.metrics.gaze_diverted_count,
            gaze_diverted_ms: this.metrics.gaze_diverted_ms,
            microtremor_avg: this.metrics.microtremor_avg,
            sweep_regularity_avg: this.metrics.sweep_regularity_avg,
            video_path: videoName
          };
          
          await this.supabase
            .from('evaluations')
            .update({ metrics_json: updatedMetrics })
            .eq('id', this.evalId);
            
          this.metrics = updatedMetrics;
          this.metrics._linesDataRef = this.linesData;
        } else {
          console.error("Error al guardar video en Supabase Storage:", error);
        }
      }
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
          <h1 style="display:flex;align-items:center;gap:10px;">
            PLC Professional — Resultados
            ${m.isIncomplete ? `<span class="badge" style="background:#C62828;color:#fff;font-size:0.75rem;padding:4px 8px;border-radius:12px;vertical-align:middle;">⚠️ INCOMPLETA</span>` : ''}
          </h1>
          <div class="sub">
            ${this.participant.name} &nbsp;·&nbsp; ID: ${this.participant.id} &nbsp;·&nbsp; ${now}
            ${m.isIncomplete ? ` &nbsp;·&nbsp; <span style="color:#C62828;font-weight:700;">Detención en Pág. ${m.lastLine}, Estímulo ${m.lastChar}</span>` : ''}
          </div>
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
                  linesWithJumps.map(l => '<li><strong>Línea ' + l.linea + ':</strong> Se detectó comportamiento errático (' + l.saltos_erraticos + ' saltos/retrocesos). Posible pérdida de atención.</li>').join('') +
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



        <!-- C.2) Datos Extras de IA: Biomarcadores Oculomotores, Emociones Facial (FER) y Cinemáticos -->
        <div class="card mb-4" style="border-left: 4px solid #00BCD4;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div class="section-title" style="margin-bottom:0;color:#00838F;">Datos Extras de IA — Telemetría Oculomotora, Facial (FER) y Cinemática</div>
            <span class="badge" style="background:#E0F7FA;color:#006064;font-size:0.75rem;padding:4px 8px;border-radius:6px;font-weight:700;">APOYO AL CRITERIO CLÍNICO</span>
          </div>
          <p style="font-size:0.88rem;color:#546E7A;margin-bottom:16px;line-height:1.45;">
            Biomarcadores objetivos capturados en Edge-AI en el navegador del paciente. Operan como exámenes paraclínicos complementarios para que el profesional corrobore el patrón atencional, el nivel de tensión gestual y el microtemblor motriz. El sistema asiste y expone los datos crudos; el psicólogo conserva la exclusiva potestad diagnóstica.
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:16px;">
            
            <!-- Columna 1: Oculometría (MediaPipe Face Mesh) -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">👁️ Oculometría & Foco Visual</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;${m.camera_active ? 'background:#E8F5E9;color:#2E7D32;' : 'background:#ECEFF1;color:#607D8B;'}">
                  ${m.camera_active ? 'CÁMARA ACTIVA' : 'CÁMARA INACTIVA'}
                </span>
              </div>

              ${m.camera_active ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#00838F;">${m.ear_mean !== null && m.ear_mean !== undefined ? m.ear_mean.toFixed(2) : 'N/A'}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">EAR Promedio</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#1565C0;">${m.blink_count || 0}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Parpadeos (${m.blink_rate_min || 0}/m)</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.gaze_diverted_count || 0) > 2 ? '#C62828' : '#2E7D32'};">${m.gaze_diverted_count || 0}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Desvíos Mirada</div>
                  </div>
                </div>

                <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #00ACC1;color:#334155;">
                  ${(function(){
                    let notes = [];
                    if ((m.gaze_diverted_count || 0) > 2) {
                      notes.push(`<strong>Pérdida de fijación:</strong> Se detectaron ${m.gaze_diverted_count} desvíos de la mirada fuera del área del test (${((m.gaze_diverted_ms || 0)/1000).toFixed(1)}s en total). Posible distracción externa o fatiga.`);
                    }
                    if ((m.blink_rate_min || 0) > 26) {
                      notes.push(`<strong>Sobreesfuerzo:</strong> Frecuencia de parpadeo elevada (${m.blink_rate_min}/min), común ante tensión visual o carga cognitiva.`);
                    }
                    if (notes.length === 0) {
                      return '<span style="color:#2E7D32;">✓ Fijación ocular continua y parpadeo dentro de parámetros fisiológicos estándar.</span>';
                    }
                    return notes.join('<br/>');
                  })()}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ La persona decidió no activar la cámara web. Los biomarcadores de parpadeo (EAR) y desvío de mirada no aplican para esta sesión.
                </div>
              `}
            </div>

            <!-- Columna 2: Emociones Faciales & Tensión (FER Edge-AI) -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">🎭 Emociones Faciales & Tensión (FER)</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;${m.camera_active ? 'background:#F3E5F5;color:#7B1FA2;' : 'background:#ECEFF1;color:#607D8B;'}">
                  ${m.camera_active ? 'EDGE-AI ACTIVO' : 'SIN CÁMARA'}
                </span>
              </div>

              ${m.camera_active ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:0.95rem;font-weight:700;color:#6A1B9A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(m.fer_dominant || 'Concentración')}">${escapeHTML(m.fer_dominant || 'Concentración')}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Expresión Dominante</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.fer_tension_score || 0) > 40 ? '#D84315' : '#2E7D32'};">${m.fer_tension_score !== undefined && m.fer_tension_score !== null ? m.fer_tension_score : '0.0'}%</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Tensión Facial</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.fer_frustration_events || 0) > 0 ? '#C62828' : '#2E7D32'};">${m.fer_frustration_events || 0}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Picos Frustración</div>
                  </div>
                </div>

                <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #AB47BC;color:#334155;">
                  ${(function(){
                    let notes = [];
                    if ((m.fer_frustration_events || 0) > 0) {
                      notes.push(`<strong>Picos de frustración:</strong> Se detectaron ${m.fer_frustration_events} contracciones intensas del corrugador superciliar (AU4) correlacionadas con estímulos complejos.`);
                    }
                    if ((m.fer_tension_score || 0) > 35) {
                      notes.push(`<strong>Tensión sostenida:</strong> Índice de tensión facial elevado (${m.fer_tension_score}%). Mayor esfuerzo gestual.`);
                    }
                    if (notes.length === 0) {
                      return '<span style="color:#2E7D32;">✓ Patrón gestual sereno, compatible con autorregulación emocional y foco atencional disciplinado.</span>';
                    }
                    return notes.join('<br/>');
                  })()}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ La cámara no estuvo habilitada. El análisis facial de emociones y tensión (FER) requiere captura de video frontal.
                </div>
              `}
            </div>

            <!-- Columna 3: Cinemática del Mouse & Microtemblores -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">🖱️ Cinemática Motora & Microtemblor</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;background:#EDE7F6;color:#512DA8;">
                  60 FPS MUESTREO
                </span>
              </div>

              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:${(m.microtremor_avg || 0) > 85 ? '#D84315' : '#1565C0'};">${m.microtremor_avg !== undefined && m.microtremor_avg !== null ? Number(m.microtremor_avg).toFixed(2) : '0.00'}</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Jitter Promedio</div>
                </div>
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:${(m.sweep_regularity_avg || 100) < 80 ? '#C62828' : '#2E7D32'};">${m.sweep_regularity_avg !== undefined ? m.sweep_regularity_avg : 100}%</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Regularidad Barrido</div>
                </div>
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:${(m.tremor_lines && m.tremor_lines.length > 0) ? '#C62828' : '#2E7D32'};">${m.tremor_lines ? m.tremor_lines.length : 0}</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Págs con Tremor</div>
                </div>
              </div>

              <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #7E57C2;color:#334155;">
                ${(function(){
                  let notes = [];
                  if ((m.sweep_regularity_avg || 100) < 80) {
                    notes.push(`<strong>Barrido no lineal:</strong> Retrocesos frecuentes del cursor detectados. El evaluado rectificó su avance horizontal repetidamente.`);
                  }
                  if (m.tremor_lines && m.tremor_lines.length > 0) {
                    notes.push(`<strong>Tensión motora:</strong> Alerta de microtemblor superó el umbral clínico en páginas: <strong>${m.tremor_lines.join(', ')}</strong>.`);
                  }
                  if (notes.length === 0) {
                    return '<span style="color:#2E7D32;">✓ Desplazamiento motor estable y barrido horizontal de izquierda a derecha altamente disciplinado.</span>';
                  }
                  return notes.join('<br/>');
                })()}
              </div>
            </div>

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

          <!-- Bloque de Telemetría Oculomotora y Cinemática (Biomarcadores IA) -->
          <div id="modal-biomarkers-extra" style="margin-bottom: 20px;"></div>

          <div class="charts-grid">
            <div class="chart-box"><canvas id="chart-behavior"></canvas></div>
            <div class="chart-box"><canvas id="chart-metrics"></canvas></div>
            <div class="chart-box"><canvas id="chart-errors"></canvas></div>
            <div class="chart-box"><canvas id="chart-normal"></canvas></div>
          </div>
          <!-- Rastreo de Saltos Erráticos (Distracción) en el modal -->
          <div class="charts-grid" style="grid-template-columns: 1fr; margin-top: 15px;">
            <div class="chart-box" style="height: 220px; min-height: 220px;"><canvas id="chart-jumps"></canvas></div>
          </div>
          <div id="modal-jumps-notes" style="margin-top: 15px; font-size: 0.95rem; background: #FFFDE7; padding: 15px; border-radius: 8px;"></div>
        </div>
      </div>

      <!-- Modal de Video (Inyectado con Descarga Directa) -->
      <div id="video-modal" class="modal-overlay">
        <div class="modal-video" style="max-width:850px;width:95%;padding:28px 24px;">
          <button class="modal-close" onclick="App.closeVideoModal()">×</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div class="section-title" id="video-modal-title" style="margin:0;font-size:1.25rem;">🎥 Grabación de la Sesión</div>
            <button id="modal-btn-download-video" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;padding:7px 16px;background:#1565C0;color:#FFF;border-radius:8px;box-shadow:0 2px 8px rgba(21,101,192,0.3);cursor:pointer;" onclick="App.downloadCurrentVideo(this)">
              ⬇️ Descargar Video (.webm)
            </button>
          </div>
          <div class="video-container" style="background:#000;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.25);">
            <video id="player-video" controls style="width:100%;max-height:65vh;display:block;outline:none;"></video>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:0.8rem;color:#64748B;flex-wrap:wrap;gap:8px;">
            <span>💡 Grabación de pantalla y oculometría sincronizada en formato WebM</span>
            <span id="modal-video-status-info" style="font-weight:600;color:#1E293B;"></span>
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
    return rows.map(r => {
      const createdDate = new Date(r.created_at);
      const now = new Date();
      const diffMs = now - createdDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const dayCurrent = Math.min(30, Math.max(1, diffDays + 1)); // Día 1 empieza en su fecha de creación
      
      let daysLeft = 30 - diffDays;
      if (r.video_days_left !== undefined && r.video_days_left !== null) {
        daysLeft = r.video_days_left;
      }
      if (daysLeft < 0) daysLeft = 0;

      const isExpired = Boolean(r.video_expired || daysLeft <= 0);

      let videoBadgeHtml = '';
      if (r.video_path && !isExpired) {
        const badgeStyle = daysLeft <= 3 
          ? 'background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;' 
          : daysLeft <= 10 
            ? 'background:#FFF3E0;color:#E65100;border:1px solid #FFE0B2;' 
            : 'background:#E3F2FD;color:#1565C0;border:1px solid #BBDEFB;';
        videoBadgeHtml = `
          <div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;">
            <div style="display:flex;gap:4px;">
              <button class="btn btn-ghost btn-sm" style="background:#FFE8E8;color:#C62828;padding:2px 7px;font-size:0.75rem;font-weight:600;" onclick="App.playVideo(${r.id}, this)" title="Reproducir video de la sesión">🎥 Ver</button>
              <button class="btn btn-ghost btn-sm" style="background:#E0F2FE;color:#0284C7;padding:2px 7px;font-size:0.75rem;font-weight:600;" onclick="App.downloadVideo(${r.id}, this)" title="Descargar archivo de video (.webm) a tu equipo">⬇️ Bajar</button>
            </div>
            <span style="font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:4px;${badgeStyle}" title="Día ${dayCurrent} de 30 de retención clínica">⏳ Quedan ${daysLeft}d (${dayCurrent}/30)</span>
          </div>
        `;
      } else if (isExpired && (r.video_path || r.video_expired || diffDays >= 30)) {
        videoBadgeHtml = `<span style="font-size:0.7rem;color:#64748B;padding:3px 6px;background:#F1F5F9;border-radius:6px;border:1px solid #CBD5E1;font-weight:600;" title="El video cumplió el período reglamentario de 30 días y fue purgado de la nube.">🗑️ Expirado (+30d)</span>`;
      }

      return `
      <tr>
        <td>${r.id}</td>
        <td>${new Date(r.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${escapeHTML(r.participant_id)}</td>
        <td><strong>${escapeHTML(r.participant_name)}</strong></td>
        <td>${r.age}</td>
        <td><span style="font-weight:700;color:${r.CP >= 75 ? '#2E7D32' : r.CP >= 50 ? '#E65100' : '#B71C1C'}">${r.CP}</span></td>
        <td>${r.TA}</td>
        <td class="flex gap-2" style="align-items:center;">
          <button class="btn btn-ghost btn-sm" style="background:#E8EAF6;color:#1A237E;" onclick="App.openWebReport(${r.id}, this)">👁️ Ver Web</button>
          ${videoBadgeHtml}
          ${r.status === 'processing' || r.status === 'pending' ?
            `<button class="btn btn-secondary btn-sm" disabled>⏳ Generando</button>` :
            `<button class="btn btn-primary btn-sm" onclick="App.downloadById(${r.id}, this)" title="Descargar Excel clínico completo">📥 Excel</button>`
          }
          <button class="btn btn-danger btn-sm" onclick="App.deleteEval(${r.id}, this)">🗑</button>
        </td>
      </tr>`;
    }).join('');
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
      
      const cType = r.headers.get('content-type') || '';
      if (cType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || cType.includes('application/octet-stream')) {
        // Compilación On-the-fly streaming directa
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disp = r.headers.get('content-disposition') || '';
        let fname = `PLC_Evaluacion_${id}.xlsx`;
        const match = disp.match(/filename="?([^";]+)"?/);
        if (match && match[1]) fname = match[1];
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const d = await r.json();
        if (d.url) {
          window.open(d.url, '_blank');
        } else {
          alert(d.detail || "URL no disponible");
        }
      }
    } catch (e) {
      console.error("Error al descargar Excel:", e);
      alert("Error de conexión al generar el archivo Excel.");
    } finally {
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

      const lastAttemptedIndex = lines ? lines.map(l => l.evaluados || 0).reduce((maxIdx, val, idx) => val > 0 ? idx : maxIdx, -1) : -1;
      const isIncomplete = lastAttemptedIndex >= 0 && (lastAttemptedIndex + 1) < lines.length;
      const lastLine = lastAttemptedIndex >= 0 ? lines[lastAttemptedIndex].linea : 0;
      const lastChar = lastAttemptedIndex >= 0 ? lines[lastAttemptedIndex].evaluados : 0;

      // 1. Mostrar Modal
      document.getElementById('clinical-modal').classList.add('active');
      document.getElementById('modal-patient-info').innerHTML = `
        Paciente: <span style="color:var(--text);font-weight:400;">${data.participant_name}</span> 
        | ID: <span style="color:var(--text);font-weight:400;">${data.participant_id}</span> 
        | Prueba: <span style="color:var(--text);font-weight:400;">${new Date(data.created_at).toLocaleString()}</span>
        ${isIncomplete ? `<br/><span style="color:#C62828;font-weight:700;">⚠️ APLICACIÓN INCOMPLETA (Detención anticipada en Página ${lastLine}, Estímulo ${lastChar})</span>` : ''}
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
            <div class="st-desc" style="font-size:0.8rem;">${(ml && ml.confidence_percent ? ml.confidence_percent : "0%")} (Calidad del ML)</div>
          </div>
        </div>
      `;

      // 2.2. Bloque de Telemetría Oculomotora y Cinemática (Biomarcadores IA) en el modal
      const extraEl = document.getElementById('modal-biomarkers-extra');
      if (extraEl) {
        const camActive = Boolean(metrics.camera_active);
        const earMean = metrics.ear_mean !== undefined && metrics.ear_mean !== null ? Number(metrics.ear_mean) : null;
        const blinksCount = Number(metrics.blink_count || 0);
        const blinkRate = Number(metrics.blink_rate_min || 0);
        const gazeCount = Number(metrics.gaze_diverted_count || 0);

        let microAvg = metrics.microtremor_avg;
        if (microAvg === undefined || microAvg === null) {
          const lTremors = lines ? lines.map(l => (l.microtremor_score !== undefined && l.microtremor_score !== null) ? l.microtremor_score : (l.tremor_score || 0)) : [];
          microAvg = lTremors.length > 0 ? (lTremors.reduce((a, b) => a + b, 0) / lTremors.length) : 0;
        }
        microAvg = parseFloat(Number(microAvg || 0).toFixed(2));

        let sweepAvg = metrics.sweep_regularity_avg;
        if (sweepAvg === undefined || sweepAvg === null) {
          const lSweeps = lines ? lines.map(l => (l.sweep_regularity !== undefined && l.sweep_regularity !== null) ? l.sweep_regularity : 100) : [];
          sweepAvg = lSweeps.length > 0 ? (lSweeps.reduce((a, b) => a + b, 0) / lSweeps.length) : 100;
        }
        sweepAvg = parseFloat(Number(sweepAvg !== undefined ? sweepAvg : 100).toFixed(1));

        const tremorLines = metrics.tremor_lines || (lines ? lines.filter(l => l.tremor_flag).map(l => l.linea) : []);

        extraEl.innerHTML = `
          <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #00BCD4;border-radius:10px;padding:16px;margin-bottom:15px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
              <span style="font-weight:700;font-size:0.95rem;color:#00838F;">⚡ Datos Extras de IA — Telemetría Oculomotora, Facial (FER) y Cinemática</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${metrics.video_path ? `
                  <button class="btn btn-ghost btn-sm" style="background:#FFE8E8;color:#C62828;padding:2px 8px;font-size:0.75rem;font-weight:700;" onclick="App.playVideo(${id}, this)">🎥 Ver Video</button>
                  <button class="btn btn-ghost btn-sm" style="background:#E0F2FE;color:#0284C7;padding:2px 8px;font-size:0.75rem;font-weight:700;" onclick="App.downloadVideo(${id}, this)">⬇️ Bajar Video</button>
                ` : ''}
                <span class="badge" style="background:#E0F7FA;color:#006064;font-size:0.75rem;padding:3px 8px;border-radius:6px;font-weight:700;">PARACLÍNICO DE APOYO</span>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;">
              <!-- Panel Oculomotor -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-weight:700;font-size:0.88rem;color:#1E293B;">👁️ Foco Visual & Parpadeo</span>
                  <span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:8px;${camActive ? 'background:#E8F5E9;color:#2E7D32;' : 'background:#ECEFF1;color:#607D8B;'}">
                    ${camActive ? 'CÁMARA ACTIVA' : 'SIN CÁMARA'}
                  </span>
                </div>
                ${camActive ? `
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;">
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:#00838F;">${earMean !== null ? earMean.toFixed(2) : 'N/A'}</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">EAR Prom.</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:#1565C0;">${blinksCount}</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Parp. (${blinkRate}/m)</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:${gazeCount > 2 ? '#C62828' : '#2E7D32'};">${gazeCount}</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Desvíos</div>
                    </div>
                  </div>
                ` : `
                  <div style="font-size:0.8rem;color:#64748B;text-align:center;padding:12px;background:#FFF;border-radius:6px;">
                    Cámara desactivada por el paciente en esta prueba.
                  </div>
                `}
              </div>

              <!-- Panel Emociones Faciales (FER) -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-weight:700;font-size:0.88rem;color:#1E293B;">🎭 Expresión & Tensión (FER)</span>
                  <span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:8px;${camActive ? 'background:#F3E5F5;color:#7B1FA2;' : 'background:#ECEFF1;color:#607D8B;'}">
                    ${camActive ? 'EDGE-AI' : 'N/A'}
                  </span>
                </div>
                ${camActive ? `
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;">
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:0.88rem;font-weight:700;color:#6A1B9A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(metrics.fer_dominant || 'Concentración')}">${escapeHTML(metrics.fer_dominant || 'Neutro')}</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Expresión</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:${(metrics.fer_tension_score || 0) > 40 ? '#D84315' : '#2E7D32'};">${metrics.fer_tension_score !== undefined && metrics.fer_tension_score !== null ? metrics.fer_tension_score : '0.0'}%</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Tensión</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:${(metrics.fer_frustration_events || 0) > 0 ? '#C62828' : '#2E7D32'};">${metrics.fer_frustration_events || 0}</div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Frustración</div>
                    </div>
                  </div>
                ` : `
                  <div style="font-size:0.8rem;color:#64748B;text-align:center;padding:12px;background:#FFF;border-radius:6px;">
                    Sin captura facial en esta evaluación.
                  </div>
                `}
              </div>

              <!-- Panel Cinemática & Microtemblor -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-weight:700;font-size:0.88rem;color:#1E293B;">🖱️ Cinemática & Microtemblor</span>
                  <span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:8px;background:#EDE7F6;color:#512DA8;">60 FPS</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;">
                  <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.05rem;font-weight:700;color:${microAvg > 85 ? '#D84315' : '#1565C0'};">${microAvg}</div>
                    <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Jitter Prom.</div>
                  </div>
                  <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.05rem;font-weight:700;color:${sweepAvg < 80 ? '#C62828' : '#2E7D32'};">${sweepAvg}%</div>
                    <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Barrido</div>
                  </div>
                  <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.05rem;font-weight:700;color:${tremorLines.length > 0 ? '#C62828' : '#2E7D32'};">${tremorLines.length}</div>
                    <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Págs Tremor</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
`;
      }

      // 2.5. Notas de Saltos Erráticos en el modal
      const modalNotesEl = document.getElementById('modal-jumps-notes');
      if (modalNotesEl) {
        const linesWithJumps = lines ? lines.filter(l => l.saltos_erraticos > 0) : [];
        if (linesWithJumps.length === 0) {
          modalNotesEl.innerHTML = '<div style="color:#2E7D32; font-weight:600;">✓ El paciente mantuvo un barrido visual disciplinado en todas las líneas.</div>';
        } else {
          modalNotesEl.innerHTML = '<ul style="color:#BF360C; line-height: 1.6; margin: 0; padding-left: 20px;">' + 
            linesWithJumps.map(l => '<li><strong>Línea ' + l.linea + ':</strong> Se detectó comportamiento errático (' + l.saltos_erraticos + ' saltos/retrocesos).</li>').join('') +
            '</ul>';
        }
      }

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
    const oldText = btn.innerHTML || "🗑️";
    try {
      btn.textContent = "...";
      btn.disabled = true;
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) {
        throw new Error(`Código de respuesta: ${r.status}`);
      }
      btn.closest('tr').remove();
    } catch (e) { 
      alert('Error al eliminar: ' + e.message);
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  },

  async playVideo(id, btn) {
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "⌛ Video";
    }

    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(`${API_BASE}/api/video/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      
      if (btn) {
        btn.textContent = "🎥 Ver";
        btn.disabled = false;
      }
      
      if (d.url) {
        this.currentVideoId = id;
        this.currentVideoUrl = d.url;
        this.currentVideoDownloadUrl = d.download_url || d.url;
        this.currentVideoFilename = d.filename || (`PLC_Sesion_${id}.webm`);

        const modal = document.getElementById('video-modal');
        const player = document.getElementById('player-video');
        const titleEl = document.getElementById('video-modal-title');
        const statusEl = document.getElementById('modal-video-status-info');
        const dlBtn = document.getElementById('modal-btn-download-video');
        
        if (titleEl) titleEl.textContent = `🎥 Grabación de la Sesión #${id}`;
        if (statusEl) statusEl.textContent = `Archivo: ${this.currentVideoFilename}`;
        if (dlBtn) {
          dlBtn.innerHTML = `⬇️ Descargar Video (.webm)`;
          dlBtn.disabled = false;
        }

        player.src = d.url;
        modal.classList.add('active');
      } else {
        alert(d.detail || "No se pudo recuperar la grabación.");
      }
    } catch (e) {
      alert("Error al cargar la grabación");
      if (btn) {
        btn.textContent = "🎥 Ver";
        btn.disabled = false;
      }
    }
  },

  downloadCurrentVideo(btn) {
    if (!this.currentVideoId) return;
    this.downloadVideo(this.currentVideoId, btn);
  },

  async downloadVideo(id, btn) {
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      var prevHtml = btn.innerHTML;
      btn.innerHTML = "⏳ Descargando...";
    }
    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      
      // 1. Obtener URL de video con flag de descarga
      const r = await fetch(`${API_BASE}/api/video/${id}?download=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      
      if (!r.ok || (!d.url && !d.download_url)) {
        throw new Error(d.detail || "No se encontró el video o ha expirado.");
      }

      const targetUrl = d.download_url || d.url;
      const filename = d.filename || `PLC_Sesion_${id}.webm`;

      // 2. Intentar descarga limpia vía Blob en browser
      let downloadedViaBlob = false;
      try {
        const fileResp = await fetch(targetUrl);
        if (fileResp.ok) {
          const blob = await fileResp.blob();
          const objUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => window.URL.revokeObjectURL(objUrl), 60000);
          downloadedViaBlob = true;
        }
      } catch (blobErr) {
        console.warn("Descarga Blob directa no permitida por CORS de storage; activando fallback de streaming / ancla:", blobErr);
      }

      // 3. Fallback A: Servidor FastAPI Streaming Endpoint (100% inmune a CORS)
      if (!downloadedViaBlob) {
        try {
          const streamResp = await fetch(`${API_BASE}/api/video/${id}/stream`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (streamResp.ok) {
            const blob = await streamResp.blob();
            const objUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(objUrl), 60000);
            downloadedViaBlob = true;
          }
        } catch (streamErr) {
          console.warn("Fallback stream falló, usando ancla de navegación directa:", streamErr);
        }
      }

      // 4. Fallback B: Ancla directa hacia URL firmada con Content-Disposition attachment
      if (!downloadedViaBlob) {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.download = filename;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

    } catch (e) {
      console.error("Error al descargar video:", e);
      alert("Error al descargar el video: " + e.message);
    } finally {
      if (btn) {
        btn.innerHTML = prevHtml;
        btn.disabled = false;
      }
    }
  },

  closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('player-video');
    player.pause();
    player.src = "";
    modal.classList.remove('active');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 7: SUPERADMIN DASHBOARD
  ══════════════════════════════════════════════════════════════════════ */
  renderSuperAdmin(app) {
    app.innerHTML = `
      <div id="admin-screen" style="min-height:100vh;background:linear-gradient(135deg,#0D1B2A 0%,#1A1A3E 60%,#0D1B2A 100%);color:#fff;padding:40px;box-sizing:border-box;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;flex-wrap:wrap;gap:16px;">
          <div>
            <div style="font-size:2.4rem;font-weight:800;letter-spacing:-1px;background:linear-gradient(90deg,#7B8CDE,#C5CAE9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
              🛡️ Panel SuperAdmin
            </div>
            <div style="color:#7B8CDE;font-size:1rem;margin-top:8px;-webkit-text-fill-color:#7B8CDE;">
              MecaPsi · Consola de Administración Global · Dilan A. Lamus Pabón
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,.1);color:#C5CAE9;border-color:rgba(255,255,255,.2);" onclick="App.nav('menu')">
            ← Volver al Menú
          </button>
        </div>

        <!-- Diagnostic Alert Banner (si hay problemas con las credenciales de Supabase) -->
        <div id="admin-diagnostic-banner"></div>

        <!-- KPI Cards (se pueblan via loadAdminStats) -->
        <div id="admin-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:36px;">
          ${[1,2,3,4].map(() => `
            <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px 20px;text-align:center;">
              <div class="spinner" style="margin:0 auto 12px;border-color:rgba(123,140,222,0.25);border-top-color:#7B8CDE;width:24px;height:24px;border-width:3px;"></div>
              <div style="color:#546E7A;font-size:0.85rem;">Cargando...</div>
            </div>`).join('')}
        </div>

        <!-- Charts -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:32px;" class="admin-charts-grid">
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;">
            <div style="font-weight:600;margin-bottom:16px;color:#C5CAE9;font-size:1.05rem;">📈 Evaluaciones por Día (Histórico Global)</div>
            <canvas id="admin-daily-chart"></canvas>
          </div>
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;">
            <div style="font-weight:600;margin-bottom:16px;color:#C5CAE9;font-size:1.05rem;">🧠 Distribución de Perfiles Cognitivos</div>
            <canvas id="admin-profile-chart"></canvas>
          </div>
        </div>

        <!-- Registered Psychologists Accounts -->
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;margin-bottom:32px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
            <div style="font-weight:600;color:#C5CAE9;font-size:1.1rem;">
              👥 Cuentas de Psicólogos Registrados en la Plataforma
            </div>
            <span id="admin-users-badge" style="background:rgba(123,140,222,.2);color:#7B8CDE;padding:4px 14px;border-radius:20px;font-size:.85rem;font-weight:600;">
              Cargando cuentas...
            </span>
          </div>
          <div id="admin-users-table" style="overflow-x:auto;">
            <div style="color:#546E7A;text-align:center;padding:20px;">Cargando usuarios...</div>
          </div>
        </div>

        <!-- Recent evaluations -->
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
            <div style="font-weight:600;color:#C5CAE9;font-size:1.1rem;">
              📋 Evaluaciones Clínicas Registradas (Histórico Global)
            </div>
            <span id="admin-evals-badge" style="background:rgba(129,199,132,.2);color:#81C784;padding:4px 14px;border-radius:20px;font-size:.85rem;font-weight:600;">
              Cargando...
            </span>
          </div>
          <div id="admin-recent-table" style="overflow-x:auto;max-height:480px;overflow-y:auto;">
            <div style="color:#546E7A;text-align:center;padding:20px;">Cargando tabla...</div>
          </div>
        </div>

      </div>`;

    requestAnimationFrame(() => this.loadAdminStats());
  },

  async loadAdminStats() {
    try {
      const sess  = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r     = await fetch(API_BASE + '/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!r.ok) {
        const err = await r.json();
        const kpisEl = document.getElementById('admin-kpis');
        if (kpisEl) kpisEl.innerHTML = `<div style="color:#EF9A9A;padding:20px;grid-column:1/-1;">⚠️ ${escapeHTML(err.detail || 'Error al cargar')}</div>`;
        return;
      }

      const d = await r.json();

      // ── Banner de Diagnóstico ──────────────────────────────
      const diagBannerEl = document.getElementById('admin-diagnostic-banner');
      if (diagBannerEl) {
        if (d.diagnostic_message) {
          diagBannerEl.innerHTML = `
            <div style="background:rgba(255,167,38,0.15);border:1.5px solid #FFA726;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;color:#FFE0B2;">
              <div style="font-size:1.8rem;">⚠️</div>
              <div style="font-size:0.95rem;line-height:1.4;">
                <strong style="color:#FFA726;">Aviso de Configuración de Supabase:</strong><br/>
                ${escapeHTML(d.diagnostic_message)}
              </div>
            </div>`;
        } else {
          diagBannerEl.innerHTML = '';
        }
      }

      // ── KPI Cards ──────────────────────────────────────────
      const kpis = [
        { icon: '📊', label: 'Total Evaluaciones',   value: d.total_evaluations },
        { icon: '👨‍⚕️', label: 'Cuentas de Psicólogos', value: d.unique_psychologists },
        { icon: '📅', label: 'Evaluaciones Hoy',     value: d.today_count },
        { icon: '🧠', label: 'Perfil Más Frecuente',  value: d.top_profile }
      ];
      const kpisEl = document.getElementById('admin-kpis');
      if (kpisEl) kpisEl.innerHTML = kpis.map(k => `
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:28px 20px;text-align:center;transition:transform .2s,box-shadow .2s;"
             onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(123,140,222,.25)'"
             onmouseout="this.style.transform='';this.style.boxShadow=''">
          <div style="font-size:2.4rem;margin-bottom:10px;">${k.icon}</div>
          <div style="font-size:2rem;font-weight:800;color:#7B8CDE;line-height:1.1;word-break:break-word;">${k.value}</div>
          <div style="color:#90A4AE;font-size:0.9rem;margin-top:8px;">${k.label}</div>
        </div>
      `).join('');

      // ── Cuentas de Psicólogos ──────────────────────────────────
      const usersBadge = document.getElementById('admin-users-badge');
      if (usersBadge) usersBadge.textContent = `${(d.registered_users || []).length} cuentas activas`;

      const usersTableEl = document.getElementById('admin-users-table');
      if (usersTableEl) {
        if (!d.registered_users || !d.registered_users.length) {
          usersTableEl.innerHTML = '<p style="color:#90A4AE;padding:20px;">No se encontraron cuentas registradas.</p>';
        } else {
          usersTableEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
              <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1);">
                ${['Psicólogo / Correo','Rol de Acceso','Evaluaciones Creadas','Fecha Registro','Último Acceso'].map(h =>
                  `<th style="padding:12px 10px;text-align:left;color:#7B8CDE;font-weight:600;">${h}</th>`
                ).join('')}
              </tr></thead>
              <tbody>
                ${d.registered_users.map(u => {
                  const isSuper = u.role === 'superadmin';
                  const roleBadge = isSuper
                    ? '<span style="padding:3px 10px;border-radius:20px;font-size:.78rem;background:rgba(255,215,0,.2);color:#FFD700;border:1px solid rgba(255,215,0,.4);font-weight:700;">🛡️ SuperAdmin</span>'
                    : '<span style="padding:3px 10px;border-radius:20px;font-size:.78rem;background:rgba(123,140,222,.2);color:#C5CAE9;border:1px solid rgba(123,140,222,.4);">👨‍⚕️ Psicólogo Clínico</span>';
                  const createdStr = u.created_at ? new Date(u.created_at).toLocaleDateString('es') : '—';
                  const lastLoginStr = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('es') : 'Sin registro reciente';
                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
                      <td style="padding:12px 10px;color:#FFFFFF;font-weight:600;">${escapeHTML(u.email)}</td>
                      <td style="padding:12px 10px;">${roleBadge}</td>
                      <td style="padding:12px 10px;color:#7B8CDE;font-weight:700;">${u.evaluations_count || 0} pruebas</td>
                      <td style="padding:12px 10px;color:#90A4AE;">${createdStr}</td>
                      <td style="padding:12px 10px;color:#90A4AE;">${lastLoginStr}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>`;
        }
      }

      // ── Gráfica diaria (barras) ─────────────────────────────────
      const dailyCtx = document.getElementById('admin-daily-chart');
      if (dailyCtx && window.Chart) {
        if (d.daily_distribution && d.daily_distribution.length > 0) {
          new Chart(dailyCtx, {
            type: 'bar',
            data: {
              labels: d.daily_distribution.map(e => e.date.slice(5)), // MM-DD
              datasets: [{
                label: 'Evaluaciones',
                data: d.daily_distribution.map(e => e.count),
                backgroundColor: 'rgba(123,140,222,0.55)',
                borderColor: '#7B8CDE', borderWidth: 1, borderRadius: 4
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { labels: { color: '#C5CAE9' } } },
              scales: {
                x: { ticks: { color: '#90A4AE', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#90A4AE' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
              }
            }
          });
        } else {
          dailyCtx.closest('div').innerHTML += '<p style="color:#546E7A;text-align:center;padding:20px;">Sin datos históricos disponibles.</p>';
        }
      }

      // ── Gráfica de perfiles (dona) ────────────────────────────────
      const profileCtx = document.getElementById('admin-profile-chart');
      if (profileCtx && window.Chart && d.profile_distribution && d.profile_distribution.length > 0) {
        const COLORS = ['#3949AB','#E53935','#F57F17','#2E7D32','#6A1B9A','#00838F','#558B2F','#AD1457'];
        new Chart(profileCtx, {
          type: 'doughnut',
          data: {
            labels: d.profile_distribution.map(e => e.profile),
            datasets: [{
              data: d.profile_distribution.map(e => e.count),
              backgroundColor: COLORS.slice(0, d.profile_distribution.length),
              borderWidth: 2, borderColor: '#0D1B2A'
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#C5CAE9', font: { size: 11 }, padding: 10 } }
            }
          }
        });
      }

      // ── Tabla de evaluaciones (Histórico Global) ────────────────────
      const evalsBadge = document.getElementById('admin-evals-badge');
      if (evalsBadge) evalsBadge.textContent = `${(d.recent_evaluations || []).length} mostradas de ${d.total_evaluations || 0} totales`;

      const recentEl = document.getElementById('admin-recent-table');
      if (recentEl) {
        if (!d.recent_evaluations || !d.recent_evaluations.length) {
          recentEl.innerHTML = '<p style="color:#90A4AE;padding:20px;">Sin evaluaciones registradas.</p>';
        } else {
          recentEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
              <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;background:#141C33;z-index:2;">
                ${['# ID','Fecha','ID Participante (Protegido)','Edad','Perfil IA','Confianza','Estado'].map(h =>
                  `<th style="padding:10px;text-align:left;color:#7B8CDE;font-weight:600;">${h}</th>`
                ).join('')}
              </tr></thead>
              <tbody>
                ${d.recent_evaluations.map(row => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
                    <td style="padding:10px;color:#90A4AE;">${row.id}</td>
                    <td style="padding:10px;color:#C5CAE9;">${row.created_at ? new Date(row.created_at).toLocaleDateString('es') : '—'}</td>
                    <td style="padding:10px;color:#90A4AE;font-family:monospace;font-size:.9rem;letter-spacing:2px;font-weight:700;" title="ID Protegido por confidencialidad clínica">******</td>
                    <td style="padding:10px;color:#C5CAE9;">${row.age || '—'}</td>
                    <td style="padding:10px;color:#7B8CDE;font-weight:600;">${escapeHTML(row.profile)}</td>
                    <td style="padding:10px;color:#90A4AE;">${row.confidence}</td>
                    <td style="padding:10px;"><span style="padding:3px 10px;border-radius:20px;font-size:.8rem;background:${row.status==='completed'?'rgba(46,125,50,.2)':'rgba(230,81,0,.2)'};color:${row.status==='completed'?'#81C784':'#FFB74D'};">${row.status}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        }
      }

    } catch(e) {
      console.error('Admin stats error:', e);
      const kpisEl = document.getElementById('admin-kpis');
      if (kpisEl) kpisEl.innerHTML = `<div style="color:#EF9A9A;padding:20px;grid-column:1/-1;">Error al conectar con el servidor. Verifique la configuración.</div>`;
    }
  }

};

document.addEventListener('DOMContentLoaded', () => App.init());
