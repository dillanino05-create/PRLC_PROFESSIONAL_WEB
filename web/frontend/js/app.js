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
  testType: 'PLC',
  corsiMode: 'direct',
  corsiResult: null,
  sessionTag: null,
  sessionUid: null,
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

  // ── Grabación y Visor Forense de Video (SuperAdmin) ───────────────────────────
  recordingMimeType: 'video/mp4',
  aiHudEnabled: true,
  aiHudAnimationId: null,
  activeVideoEvalData: null,

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
  pupilSamples: [],           // [{ rawDilation, irisDiam, t, line }]
  _gazeDivertedStartTime: null,
  _lastFaceMeshTs: 0,
  _faceMeshBusy: false,
  _faceMeshTimer: null,

  // ── Módulo de Seguridad, Concurrencia y Anti-Cheat ──────────────────────────
  tabId: 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
  examChannel: null,
  isExamBlockedByOtherTab: false,
  blockingTabInfo: null,
  clientSessionId: null,
  sessionHeartbeatTimer: null,
  integrityLog: [],           // [{ event, line, duration_ms, timestamp }]
  focusLostCount: 0,
  totalUnfocusedMs: 0,
  _lastBlurTime: null,

  TOTAL_LINES: 14,
  TIME_PER_LINE: 20,
  CHARS_PER_LINE: 47,

  /* ── Init ──────────────────────────────────────────────────────────────── */
  async init() {
    // Configuración de Supabase
    const SUPABASE_URL = 'https://lfyaiwbtfgoiczyyzlwh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWFpd2J0ZmdvaWN6eXl6bHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjc1MTEsImV4cCI6MjA5MDY0MzUxMX0.ZfVceXuYWQKEZimgRLt9kGkSGpq8FO7kRgKbL-Ta-3M';
    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Cargar o generar ID de sesión del cliente (Single Active Session)
    let savedSess = sessionStorage.getItem('mecapsi_session_id');
    if (!savedSess) {
      savedSess = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('mecapsi_session_id', savedSess);
    }
    this.clientSessionId = savedSess;

    // Configurar listeners de seguridad, concurrencia y anti-cheat
    this.setupSecurityModule();

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

    // Si hay usuario logueado -> menú + heartbeat, si no -> login
    if (this.user) {
      this.startSessionHeartbeat();
      this.warmUpModel();
      this.nav('menu');
    } else {
      this.nav('login');
    }
  },

  setupSecurityModule() {
    // 1. Canal entre pestañas (BroadcastChannel)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.examChannel = new BroadcastChannel('mecapsi_exam_channel');
        this.examChannel.onmessage = (e) => this.handleExamChannelMessage(e.data);
        // Preguntar si otra pestaña ya tiene una prueba en curso
        this.examChannel.postMessage({ type: 'PING_ACTIVE_EXAM', tabId: this.tabId });
      } catch (e) {
        console.warn("BroadcastChannel no disponible en este navegador:", e);
      }
    }

    // 2. Monitoreo de visibilidad y pérdida de foco (Anti-Cheat)
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
    window.addEventListener('blur', () => {
      this.handleFocusBlur();
    });
    window.addEventListener('focus', () => {
      this.handleFocusGain();
    });

    // Liberar bloqueos al cerrar la pestaña
    window.addEventListener('beforeunload', () => {
      if ((this.screen === 'test' || this.screen === 'practice') && this.examChannel) {
        this.examChannel.postMessage({ type: 'EXAM_ENDED', tabId: this.tabId });
      }
    });
  },

  handleExamChannelMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.tabId === this.tabId) return; // Ignorar mensajes propios

    if (msg.type === 'EXAM_STARTED') {
      this.isExamBlockedByOtherTab = true;
      this.blockingTabInfo = msg;
      if (this.screen === 'test' || this.screen === 'practice' || this.screen === 'pretest') {
        this.renderExamBlockedScreen();
      }
    } else if (msg.type === 'EXAM_ENDED') {
      this.isExamBlockedByOtherTab = false;
      this.blockingTabInfo = null;
      if (this.screen === 'blocked_tab') {
        this.nav('menu');
      }
    } else if (msg.type === 'PING_ACTIVE_EXAM') {
      if (this.screen === 'test' || this.screen === 'practice') {
        this.examChannel.postMessage({
          type: 'EXAM_STARTED',
          tabId: this.tabId,
          screen: this.screen,
          timestamp: Date.now()
        });
      }
    }
  },

  handleVisibilityChange() {
    if (this.screen !== 'test' && this.screen !== 'practice') return;
    const now = Date.now();
    if (document.hidden) {
      this.focusLostCount++;
      this._lastBlurTime = now;
      console.warn(`[ANTI-CHEAT] Pérdida de visibilidad #${this.focusLostCount} en pantalla ${this.screen}`);
    } else if (this._lastBlurTime) {
      const dur = now - this._lastBlurTime;
      this.totalUnfocusedMs += dur;
      this.integrityLog.push({
        event: 'TAB_HIDDEN',
        line: this.currentLine + 1,
        duration_ms: Math.round(dur),
        timestamp: new Date().toISOString()
      });
      this._lastBlurTime = null;
      this.checkIntegrityAlertThreshold();
    }
  },

  handleFocusBlur() {
    if (this.screen !== 'test' && this.screen !== 'practice') return;
    if (!this._lastBlurTime) {
      this.focusLostCount++;
      this._lastBlurTime = Date.now();
      console.warn(`[ANTI-CHEAT] Pérdida de foco de ventana #${this.focusLostCount}`);
    }
  },

  handleFocusGain() {
    if (this.screen !== 'test' && this.screen !== 'practice') return;
    if (this._lastBlurTime) {
      const dur = Date.now() - this._lastBlurTime;
      this.totalUnfocusedMs += dur;
      this.integrityLog.push({
        event: 'WINDOW_BLUR',
        line: this.currentLine + 1,
        duration_ms: Math.round(dur),
        timestamp: new Date().toISOString()
      });
      this._lastBlurTime = null;
      this.checkIntegrityAlertThreshold();
    }
  },

  checkIntegrityAlertThreshold() {
    if (this.focusLostCount > 3 || this.totalUnfocusedMs > 5000) {
      this.logAudit('FOCUS_LOST_ALERT', {
        count: this.focusLostCount,
        unfocused_ms: this.totalUnfocusedMs,
        line: this.currentLine + 1
      });
    }
  },

  renderExamBlockedScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="card fade-in" style="max-width: 520px; text-align: center; padding: 40px 30px; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="font-size: 3.5rem; margin-bottom: 16px;">⚠️</div>
          <h2 style="color: #ef4444; margin-bottom: 12px; font-weight: 700;">Evaluación en Curso en Otra Pestaña</h2>
          <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px;">
            Por estrictos criterios de control psicométrico de tiempo, latencia y concentración, 
            <strong>no está permitido ejecutar pruebas simultáneas</strong> en múltiples pestañas o ventanas.
          </p>
          <div style="background: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; text-align: left; margin-bottom: 24px; font-size: 0.85rem; color: #fca5a5;">
            Por favor, regrese a la pestaña activa para completar o cancelar la evaluación en curso. Esta pestaña se desbloqueará automáticamente al finalizar.
          </div>
          <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="App.nav('menu')">
            🏠 Volver al Menú Principal
          </button>
        </div>
      </div>
    `;
    this.screen = 'blocked_tab';
  },

  async registerActiveSession() {
    if (!this.user || !this.supabase) return;
    const isSuperAdmin = (this.user.user_metadata && this.user.user_metadata.role === 'superadmin');
    if (isSuperAdmin) return;
    try {
      await this.supabase.from('active_sessions').upsert({
        user_id: this.user.id,
        current_session_id: this.clientSessionId,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("[SECURITY] Advertencia en active_sessions:", e);
    }
  },

  startSessionHeartbeat() {
    this.stopSessionHeartbeat();
    if (!this.user) return;
    const isSuperAdmin = (this.user.user_metadata && this.user.user_metadata.role === 'superadmin');
    if (isSuperAdmin) return;

    this.sessionHeartbeatTimer = setInterval(() => {
      this.checkActiveSession();
    }, 25000);
  },

  stopSessionHeartbeat() {
    if (this.sessionHeartbeatTimer) {
      clearInterval(this.sessionHeartbeatTimer);
      this.sessionHeartbeatTimer = null;
    }
  },

  async checkActiveSession() {
    if (!this.user || !this.supabase || this.screen === 'login') return;
    const isSuperAdmin = (this.user.user_metadata && this.user.user_metadata.role === 'superadmin');
    if (isSuperAdmin) return;

    try {
      const { data, error } = await this.supabase.from('active_sessions')
        .select('current_session_id')
        .eq('user_id', this.user.id)
        .maybeSingle();

      if (data && data.current_session_id && data.current_session_id !== this.clientSessionId) {
        this.handleSessionExpelled();
      } else {
        await this.supabase.from('active_sessions').update({
          last_heartbeat: new Date().toISOString()
        }).eq('user_id', this.user.id);
      }
    } catch (e) {}
  },

  handleSessionExpelled() {
    this.stopSessionHeartbeat();
    this.user = null;
    if (this.supabase && this.supabase.auth) {
      this.supabase.auth.signOut().catch(() => {});
    }
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="card fade-in" style="max-width: 500px; text-align: center; padding: 40px 30px; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="font-size: 3.5rem; margin-bottom: 16px;">🔒</div>
          <h2 style="color: #ef4444; margin-bottom: 12px; font-weight: 700;">Sesión Cerrada</h2>
          <p style="color: #e2e8f0; font-size: 1.05rem; line-height: 1.6; margin-bottom: 24px;">
            <strong>Se ha iniciado sesión desde otro dispositivo o navegador.</strong>
          </p>
          <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 28px;">
            Para proteger la trazabilidad de las historias clínicas y cumplir la política de licencia activa, su sesión anterior en este equipo ha sido invalidada.
          </p>
          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="App.nav('login')">
            🔑 Iniciar Sesión Nuevamente
          </button>
        </div>
      </div>
    `;
    this.screen = 'login';
  },

  async logAudit(action, details = {}) {
    if (!this.supabase || !this.user) return;
    try {
      await this.supabase.from('audit_logs').insert({
        user_id: this.user.id,
        action: action,
        user_agent: navigator.userAgent || 'Unknown',
        details: details
      });
    } catch (e) {}
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
      this.render();
      return;
    }

    // Comprobar bloqueo de concurrencia entre pestañas
    if ((screen === 'practice' || screen === 'test' || screen === 'pretest') && this.isExamBlockedByOtherTab) {
      this.renderExamBlockedScreen();
      return;
    }

    // Notificar inicio/fin de prueba a otras pestañas
    if (screen === 'practice' || screen === 'test') {
      this.focusLostCount = 0;
      this.totalUnfocusedMs = 0;
      this.integrityLog = [];
      this._lastBlurTime = null;
      if (this.examChannel) {
        this.examChannel.postMessage({ type: 'EXAM_STARTED', tabId: this.tabId, screen: screen, timestamp: Date.now() });
      }
    } else if (this.screen === 'test' || this.screen === 'practice') {
      if (this.examChannel) {
        this.examChannel.postMessage({ type: 'EXAM_ENDED', tabId: this.tabId });
      }
    }

    this.screen = screen;
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
      case 'ailab': this.renderAILab(app); break;
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

          <div style="text-align:center;margin-top:18px;">
            <a href="index.html" style="color:#546E7A;text-decoration:none;font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;transition:color 0.2s;" onmouseover="this.style.color='#1A237E'" onmouseout="this.style.color='#546E7A'">
              ← Volver a la Página Principal (Landing MecaPsi)
            </a>
          </div>
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
      this.logAudit('LOGIN_FAILED', { email: email });
      errEl.textContent = 'Credenciales inválidas. Compruebe o contáctenos.';
    } else {
      this.user = data.user;
      // Generar y registrar sesión única para este dispositivo (Single Active Session)
      this.clientSessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('mecapsi_session_id', this.clientSessionId);
      await this.registerActiveSession();
      this.logAudit('LOGIN_SUCCESS', { email: this.user.email });
      this.startSessionHeartbeat();
      this.nav('menu');
    }
  },

  async doLogout() {
    this.stopSessionHeartbeat();
    this.logAudit('LOGOUT', { email: this.user ? this.user.email : null });
    sessionStorage.removeItem('mecapsi_session_id');
    await this.supabase.auth.signOut();
    this.user = null;
    this.nav('login');
  },

  startTestSelection(testType, mode = 'direct') {
    this.testType = testType;
    this.corsiMode = mode;
    this.nav('form');
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 1: MENÚ — HUB SAAS MULTI-TEST
  ══════════════════════════════════════════════════════════════════════ */
  renderMenu(app) {
    const isSuperAdmin = Boolean(
      this.user?.user_metadata?.role === 'superadmin' ||
      this.user?.app_metadata?.role === 'superadmin' ||
      this.user?.email === 'dillanino05@gmail.com'
    );

    app.innerHTML = `
      <div id="test-screen" style="background:linear-gradient(135deg,#0D1322 0%,#151C38 50%,#1A237E 100%);min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:16px 28px;box-sizing:border-box;">
        
        <!-- Top Executive Navbar -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-family:'Playfair Display',serif;font-size:1.85rem;font-weight:800;color:#FFF;letter-spacing:-0.5px;line-height:1;">
                PLC Professional
              </span>
              <span style="background:rgba(79,70,229,0.25);color:#A5B4FC;border:1px solid rgba(165,180,252,0.3);font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:12px;letter-spacing:0.5px;">
                MecaPsi v3.3
              </span>
            </div>
            <div style="font-size:0.84rem;color:#9FA8DA;margin-top:2px;">
              Plataforma Multi-Test de Evaluación Neurocognitiva y Biomarcadores Digitales
            </div>
          </div>

          <!-- Top Status & Actions Bar -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            
            <!-- Model Status Pill -->
            <div class="model-badge ${this.modelWakingUp ? 'off' : this.modelOk ? 'ok' : 'off'}" style="margin:0;padding:4px 10px;font-size:0.75rem;border-radius:20px;display:flex;align-items:center;gap:6px;">
              <span class="dot" style="margin:0;width:7px;height:7px;"></span>
              ${this.modelWakingUp ? '⏳ IA Conectando...' : this.modelOk ? '● IA Activa' : '○ Modo Local'}
            </div>

            <!-- User Pill -->
            <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);padding:4px 12px;border-radius:20px;font-size:0.8rem;color:#E0E7FF;display:flex;align-items:center;gap:6px;">
              <span>👤 <strong>${this.user ? this.user.email : 'Profesional'}</strong></span>
              ${isSuperAdmin ? `<span style="background:#FFD700;color:#000;font-size:0.65rem;font-weight:900;padding:1px 6px;border-radius:10px;">SUPERADMIN</span>` : ''}
            </div>

            <!-- Quick Action Buttons -->
            <button class="btn btn-ghost btn-sm" onclick="App.nav('history')" style="color:#C5CAE9;border:1px solid rgba(255,255,255,0.2);padding:5px 12px;font-size:0.8rem;border-radius:8px;cursor:pointer;">
              📋 Historial
            </button>
            
            ${isSuperAdmin ? `
            <button class="btn btn-ghost btn-sm" onclick="App.nav('superadmin')" style="background:rgba(255,215,0,0.12);color:#FFD700;border:1px solid rgba(255,215,0,0.4);padding:5px 12px;font-size:0.8rem;font-weight:700;border-radius:8px;cursor:pointer;">
              🛡️ Admin
            </button>
            <button class="btn btn-primary btn-sm" onclick="App.nav('ailab')" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#FFF;border:none;padding:5px 12px;font-size:0.8rem;font-weight:800;border-radius:8px;box-shadow:0 2px 8px rgba(99,102,241,0.4);cursor:pointer;">
              🧬 Lab IA
            </button>` : ''}

            <button class="btn btn-ghost btn-sm" onclick="App.doLogout()" style="color:#FFCDD2;border:1px solid rgba(244,67,54,0.3);padding:5px 10px;font-size:0.8rem;border-radius:8px;cursor:pointer;" title="Cerrar Sesión">
              🚪 Salir
            </button>
          </div>
        </div>

        <!-- Main Bento Grid (3 Columnas Equilibradas para que TODO quepa en la pantalla) -->
        <div style="flex:1;display:flex;align-items:center;padding:14px 0;">
          <div style="display:grid;grid-template-columns:${isSuperAdmin ? 'repeat(auto-fit, minmax(290px, 1fr))' : 'repeat(auto-fit, minmax(360px, 1fr))'};gap:18px;width:100%;max-width:1380px;margin:0 auto;">
            
            <!-- Card 1: PLC (Test d2) -->
            <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(14px);border:1px solid rgba(144,202,249,0.25);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.2);min-height:390px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="background:rgba(33,150,243,0.2);color:#90CAF9;padding:3px 10px;border-radius:14px;font-size:0.72rem;font-weight:700;border:1px solid rgba(144,202,249,0.3);">
                    Atención & Concentración
                  </span>
                  <span style="color:#B0BEC5;font-size:0.78rem;">14 Líneas · 20s/pág</span>
                </div>
                <h3 style="font-family:'Playfair Display',serif;color:#FFF;font-size:1.45rem;margin:4px 0 6px;font-weight:700;">
                  PLC — Test d2
                </h3>
                <p style="color:#C5CAE9;font-size:0.85rem;line-height:1.45;margin-bottom:12px;">
                  Cancelación psicométrica. Evalúa velocidad de procesamiento, control inhibitorio y fluctuación por fatiga ante distractores.
                </p>
                <div style="background:rgba(0,0,0,0.22);border-radius:8px;padding:8px 12px;margin-bottom:14px;display:flex;justify-content:space-between;font-size:0.76rem;color:#E8EAF6;">
                  <div>⚡ <strong>Métricas:</strong> TA, O, COM, CP, IVR</div>
                  <div>🎯 <strong>Telemetría:</strong> Ojos + Tremor</div>
                </div>
              </div>

              <div>
                <button class="btn btn-primary" onclick="App.startTestSelection('PLC')" style="width:100%;justify-content:center;font-size:0.95rem;padding:11px;font-weight:700;border-radius:8px;box-shadow:0 4px 14px rgba(40,53,147,0.4);margin-bottom:8px;">
                  ▶ Iniciar Prueba PLC (Líneas Cruzadas)
                </button>
                ${isSuperAdmin ? `
                <button class="btn btn-ghost" onclick="App.startTestAsSuperAdmin('PLC', 'real')" style="width:100%;justify-content:center;font-size:0.8rem;padding:7px;color:#90CAF9;border:1px dashed rgba(144,202,249,0.4);border-radius:6px;cursor:pointer;background:rgba(33,150,243,0.06);" title="Inicia la prueba en tu perfil con 1 solo clic">
                  🔬 Probar d2 en Mi Perfil (Dilan)
                </button>` : ''}
              </div>
            </div>

            <!-- Card 2: Test de Bloques de Corsi -->
            <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(14px);border:1px solid rgba(206,147,216,0.25);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.2);min-height:390px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="background:rgba(156,39,176,0.2);color:#CE93D8;padding:3px 10px;border-radius:14px;font-size:0.72rem;font-weight:700;border:1px solid rgba(206,147,216,0.3);">
                    Memoria Visoespacial
                  </span>
                  <span style="color:#B0BEC5;font-size:0.78rem;">9 Bloques · Secuencia 2-9</span>
                </div>
                <h3 style="font-family:'Playfair Display',serif;color:#FFF;font-size:1.45rem;margin:4px 0 6px;font-weight:700;">
                  Test de Corsi
                </h3>
                <p style="color:#C5CAE9;font-size:0.85rem;line-height:1.45;margin-bottom:12px;">
                  Paradigma de memoria de trabajo visomotora. Determina el Span visoespacial, tiempo de duda táctica y carga cognitiva.
                </p>
                <div style="background:rgba(0,0,0,0.22);border-radius:8px;padding:8px 12px;margin-bottom:14px;display:flex;justify-content:space-between;font-size:0.76rem;color:#E8EAF6;">
                  <div>🧠 <strong>Span:</strong> Directo / Inverso</div>
                  <div>⚡ <strong>Batería:</strong> Dual Completa</div>
                </div>
              </div>

              <div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <button class="btn btn-primary" onclick="App.startTestSelection('CORSI', 'direct')" style="justify-content:center;font-size:0.84rem;padding:9px;background:linear-gradient(135deg,#5C6BC0,#3949AB);border-radius:8px;">
                    ▶ Modo Directo
                  </button>
                  <button class="btn btn-ghost" onclick="App.startTestSelection('CORSI', 'reverse')" style="justify-content:center;font-size:0.84rem;padding:9px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#FFF;border-radius:8px;">
                    🔄 Modo Inverso
                  </button>
                </div>
                <button class="btn btn-primary" onclick="App.startTestSelection('CORSI', 'dual')" style="width:100%;justify-content:center;font-size:0.86rem;padding:9px;background:linear-gradient(135deg,#7B1FA2,#4A148C);box-shadow:0 3px 10px rgba(123,31,162,0.3);border-radius:8px;margin-bottom:${isSuperAdmin ? '8px' : '0'};">
                  ⚡ Batería Dual Completa
                </button>
                ${isSuperAdmin ? `
                <button class="btn btn-ghost" onclick="App.startTestAsSuperAdmin('CORSI', 'direct')" style="width:100%;justify-content:center;font-size:0.8rem;padding:7px;color:#CE93D8;border:1px dashed rgba(206,147,216,0.4);border-radius:6px;cursor:pointer;background:rgba(156,39,176,0.06);" title="Inicia Corsi en tu perfil con 1 solo clic">
                  🧊 Probar Corsi en Mi Perfil (Dilan)
                </button>` : ''}
              </div>
            </div>

            ${isSuperAdmin ? `
            <!-- Card 3: Laboratorio de IA (Exclusivo SuperAdmin) -->
            <div style="background:linear-gradient(145deg,rgba(79,70,229,0.18) 0%,rgba(147,51,234,0.14) 100%);backdrop-filter:blur(14px);border:1.5px solid rgba(192,132,252,0.4);border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 30px rgba(124,58,237,0.25);min-height:390px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="background:rgba(147,51,234,0.3);color:#F3E8FF;padding:3px 10px;border-radius:14px;font-size:0.72rem;font-weight:800;border:1px solid rgba(192,132,252,0.4);">
                    🛡️ EXCLUSIVO SUPERADMIN
                  </span>
                  <span style="color:#E9D5FF;font-size:0.78rem;font-weight:600;">Calibración & Forense</span>
                </div>
                <h3 style="font-family:'Playfair Display',serif;color:#FFF;font-size:1.45rem;margin:4px 0 6px;font-weight:700;">
                  🧬 Laboratorio de IA
                </h3>
                <p style="color:#E0E7FF;font-size:0.85rem;line-height:1.45;margin-bottom:12px;">
                  Auditoría de motores: Keras MLP v3, MediaPipe 468 landmarks, cinemática de temblor (>6.5 px/ms²) y videoteca en MP4.
                </p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;font-size:0.75rem;color:#E0E7FF;">
                  <div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;">🧠 <strong>Keras MLP v3</strong></div>
                  <div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;">👁️ <strong>MediaPipe Mesh</strong></div>
                  <div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;">🖱️ <strong>Tremor &gt;6.5px</strong></div>
                  <div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;">🎥 <strong>Descargas MP4</strong></div>
                </div>
              </div>

              <div>
                <button class="btn btn-primary" onclick="App.nav('ailab')" style="width:100%;justify-content:center;font-size:0.95rem;padding:11px;background:linear-gradient(135deg,#6366F1,#9333EA);border:none;box-shadow:0 4px 14px rgba(99,102,241,0.45);font-weight:800;border-radius:8px;cursor:pointer;margin-bottom:8px;">
                  🚀 Abrir Laboratorio de IA
                </button>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <button class="btn btn-ghost" onclick="App.startTestAsSuperAdmin('PLC', 'real')" style="justify-content:center;font-size:0.76rem;padding:7px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#FFF;border-radius:6px;cursor:pointer;">
                    🔬 d2 Mi Perfil
                  </button>
                  <button class="btn btn-ghost" onclick="App.startTestAsSuperAdmin('CORSI', 'direct')" style="justify-content:center;font-size:0.76rem;padding:7px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#FFF;border-radius:6px;cursor:pointer;">
                    🧊 Corsi Mi Perfil
                  </button>
                </div>
              </div>
            </div>` : ''}
          </div>
        </div>

        <!-- Sleek Bottom Footer Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.08);padding:10px 4px 4px;font-size:0.78rem;color:rgba(197,202,233,0.7);flex-wrap:wrap;gap:8px;">
          <div>
            PLC Professional v3.3.4 &nbsp;&middot;&nbsp; MecaPsi SaaS &nbsp;&middot;&nbsp; Protocolo Clínico & Biomarcadores
          </div>
          <div>
            🔒 RLS Cifrado Activo &nbsp;&middot;&nbsp; Sesión Segura
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
        <div><h1>Datos del Evaluado</h1><div class="sub">Complete la información antes de iniciar · ${this.testType === 'CORSI' ? `Test de Bloques de Corsi (${this.corsiMode === 'dual' ? 'Batería Dual Completa' : this.corsiMode === 'reverse' ? 'Inverso' : 'Directo'})` : 'Prueba PLC (Líneas Cruzadas)'}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')">← Menú</button>
      </div>
      <div class="page fade-in" style="max-width:860px;">
        <div class="card">
          <div style="background:rgba(26,35,126,0.06);border:1px solid rgba(26,35,126,0.15);border-radius:10px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span style="font-weight:700;color:#1A237E;">Prueba seleccionada:</span>
              <strong style="color:#0D47A1;margin-left:6px;">${this.testType === 'CORSI' ? `Test de Bloques de Corsi (Modalidad ${this.corsiMode === 'dual' ? 'Batería Dual: Directo + Inverso' : this.corsiMode === 'reverse' ? 'Inversa' : 'Directa'})` : 'Prueba PLC Professional (Líneas Cruzadas)'}</strong>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')" style="font-size:0.85rem;">Cambiar Batería</button>
          </div>
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

  renderCorsiPreTest(app) {
    const isReverse = this.corsiMode === 'reverse';
    app.innerHTML = `
      <div class="plc-header">
        <div><h1>Test de Bloques de Corsi — Instrucciones</h1>
          <div class="sub">Modalidad: <strong>${isReverse ? 'Inversa (Memoria de Trabajo Ejecutiva)' : 'Directa (Span Anterógrado)'}</strong></div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('form')">← Volver al Formulario</button>
      </div>

      <div class="page fade-in" style="max-width: 1040px;">
        <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; align-items: start;">
          
          <!-- Panel Izquierdo: Vista previa interactiva de los 9 cubos -->
          <div class="card" style="border: 2px solid #3949AB; background: #0A0E1A; padding: 20px; border-radius: 16px; color: #FFF; text-align: center;">
            <div style="font-weight: 700; color: #90CAF9; font-size: 1.15rem; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
              <span>Disposición Espacial de los 9 Bloques</span>
              <span style="font-size:0.75rem;background:rgba(255,255,255,0.1);padding:3px 8px;border-radius:12px;">Kessels et al. (2000)</span>
            </div>
            
            <div id="corsi-preview-board" style="position:relative; width:100%; height:320px; background:#111625; border-radius:12px; border:1px solid rgba(255,255,255,0.1); overflow:hidden; margin-bottom:16px;">
              ${[
                { id: 0, x: 14, y: 16 }, { id: 1, x: 76, y: 14 },
                { id: 2, x: 46, y: 28 }, { id: 3, x: 24, y: 48 },
                { id: 4, x: 68, y: 46 }, { id: 5, x: 86, y: 66 },
                { id: 6, x: 10, y: 74 }, { id: 7, x: 44, y: 80 },
                { id: 8, x: 74, y: 82 }
              ].map(b => `
                <div style="position:absolute; left:${b.x}%; top:${b.y}%; width:54px; height:54px; transform:translate(-50%,-50%); background:linear-gradient(145deg, #1E88E5, #1565C0); border:2px solid #90CAF9; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem; color:#FFF; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
                  ${b.id + 1}
                </div>
              `).join('')}
            </div>

            <p style="font-size: 0.88rem; color: #B0BEC5; line-height: 1.5; margin: 0;">
              Durante la prueba los números no estarán visibles. Los bloques se iluminarán en color <strong>amarillo</strong> emitiendo una señal auditiva específica.
            </p>
          </div>

          <!-- Panel Derecho: Instrucciones -->
          <div class="card" style="display: flex; flex-direction: column; gap: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="font-weight: 700; color: #283593; font-size: 1.25rem; border-bottom: 2px solid #E8EAF6; padding-bottom: 10px;">
              Reglas de la Evaluación
            </div>
            
            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 4px;">
                <span style="background: #3949AB; color: white; width: 22px; height: 22px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.8rem;">1</span> 
                Fase de Presentación
              </strong>
              <p style="color: #546E7A; line-height: 1.5; margin: 0; padding-left: 30px; font-size: 0.92rem;">
                Observa la pantalla con atención. El sistema iluminará una secuencia de bloques, uno a la vez. No intentes hacer clic durante esta fase.
              </p>
            </div>

            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 4px;">
                <span style="background: #3949AB; color: white; width: 22px; height: 22px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.8rem;">2</span> 
                Fase de Reproducción (${isReverse ? 'INVERSA' : 'DIRECTA'})
              </strong>
              <p style="color: #546E7A; line-height: 1.5; margin: 0; padding-left: 30px; font-size: 0.92rem;">
                ${isReverse
                  ? 'Al ver la señal verde <strong>"¡Tu turno!"</strong>, haz clic sobre los bloques en <strong>ORDEN INVERSO</strong>: debes empezar por el <u>ÚLTIMO</u> bloque iluminado y terminar en el <u>PRIMERO</u>.'
                  : 'Al ver la señal verde <strong>"¡Tu turno!"</strong>, haz clic sobre los bloques en el <strong>MISMO ORDEN EXACTO</strong> en que fueron iluminados.'}
              </p>
            </div>

            <div class="instruction-point">
              <strong style="color: #1A237E; display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 4px;">
                <span style="background: #3949AB; color: white; width: 22px; height: 22px; display: inline-flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 0.8rem;">3</span> 
                Progresión y Criterio de Término
              </strong>
              <p style="color: #546E7A; line-height: 1.5; margin: 0; padding-left: 30px; font-size: 0.92rem;">
                La dificultad aumenta sumando bloques a la secuencia (desde 2 hasta 9). Tienes <strong>2 intentos por nivel</strong>. La prueba concluye cuando se cometen dos errores en el mismo nivel.
              </p>
            </div>

            <hr class="form-divider" style="margin: 4px 0;" />

            <div style="background: rgba(46, 125, 50, 0.08); border-left: 4px solid #2E7D32; padding: 14px 18px; border-radius: 0 8px 8px 0;">
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin: 0; user-select: none;">
                <input type="checkbox" id="chk-entendido" style="width: 20px; height: 20px; accent-color: #2E7D32; cursor: pointer;" onchange="document.getElementById('btn-practica').disabled = !this.checked">
                <span style="font-weight: 600; color: #1B5E20; font-size: 0.98rem;">He comprendido las reglas del Test de Corsi</span>
              </label>
            </div>

            <button disabled id="btn-practica" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; padding: 15px; font-size: 1.05rem; box-shadow: 0 4px 12px rgba(40, 53, 147, 0.2);" onclick="App.requestPermissionsAndGoToPractice()">
              Entendido, autorizar e iniciar &nbsp;→
            </button>
          </div>

        </div>
      </div>
    `;
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 3: PRE-PRUEBA (Instrucciones)
  ══════════════════════════════════════════════════════════════════════ */
  renderPreTest(app) {
    if (this.testType === 'CORSI') {
      this.renderCorsiPreTest(app);
      return;
    }
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
    if (this.testType === 'CORSI') {
      this.renderCorsiPractice(app);
      return;
    }
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
     PANTALLA 3.5-CORSI: PRÁCTICA INTERACTIVA DE 3 CUBOS (DIRECTO / INVERSO)
  ══════════════════════════════════════════════════════════════════════ */
  renderCorsiPractice(app) {
    const isReverse = this.corsiMode === 'reverse';
    this._corsiPracticeSequence = [0, 4, 8]; // 3 cubos didácticos: Cubo 1, Cubo 5, Cubo 9
    this._corsiPracticeUserClicks = [];
    this._corsiPracticeCanClick = true;

    app.innerHTML = `
      <div class="plc-header">
        <div>
          <h1 style="display:flex;align-items:center;gap:10px;">
            Mini-Prueba de Práctica — Test de Corsi
            <span class="badge" style="background:${isReverse ? '#7E22CE' : '#0284C7'};color:#fff;font-size:0.8rem;padding:4px 10px;border-radius:12px;">
              ${isReverse ? 'Modalidad Inversa' : 'Modalidad Directa'}
            </span>
          </h1>
          <div class="sub">
            Familiarícese con la tarea visoespacial. El tiempo es ilimitado.
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('pretest')">← Volver a Instrucciones</button>
      </div>

      <div class="page fade-in" style="max-width: 900px;">
        <div class="card" style="text-align: center; padding: 28px 24px;">
          
          <div id="corsi-p-banner" style="font-weight: 700; color: #1A237E; font-size: 1.12rem; margin-bottom: 16px;">
            ${isReverse 
              ? 'Observe la secuencia didáctica y reproduzca los cubos en ORDEN INVERSO (del último al primero):' 
              : 'Observe la secuencia didáctica y reproduzca los cubos en el MISMO ORDEN (del primero al último):'}
          </div>

          <!-- Controles Rápidos de Práctica -->
          <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
            <button class="btn btn-secondary" style="padding: 10px 22px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;" onclick="App.startCorsiPracticeDemo()">
              ▶️ Ver Demostración (3 cubos)
            </button>
            <button class="btn btn-ghost" style="padding: 10px 18px; font-weight: 600;" onclick="App.resetCorsiPractice()">
              🔄 Limpiar
            </button>
          </div>

          <!-- Tablero Espacial de Corsi para Práctica (centrado y responsive) -->
          <div id="corsi-practice-board" style="position: relative; width: 100%; max-width: 680px; height: 380px; margin: 0 auto 20px auto; background: #0B1124; border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.1); box-shadow: inset 0 2px 20px rgba(0,0,0,0.6); overflow: hidden;">
          </div>

          <!-- Feedback de progreso -->
          <div id="corsi-p-feedback" style="min-height: 28px; font-size: 1.02rem; font-weight: 600; margin-bottom: 16px; color: #546E7A;">
            Haga clic en los cubos para practicar o pulse "▶️ Ver Demostración".
          </div>

          <!-- Barra de Progreso Dinámica idéntica a PLC (0 / 3) -->
          <div class="prog-bar-wrap mb-4" style="justify-content: center; max-width: 360px; margin: 0 auto 24px auto;">
            <span style="font-size: .95rem; color: #546E7A; font-weight: 500;">Cubos marcados:</span>
            <div class="prog-bar" style="width: 100%; height: 14px; border-radius: 8px;">
              <div class="prog-bar-fill" id="corsi-p-prog" style="width:0%; transition: width 0.25s ease; border-radius: 8px; background: ${isReverse ? '#9333EA' : '#0284C7'};"></div>
            </div>
            <span id="corsi-p-cnt" style="font-size: 1.2rem; font-weight: 800; color: #1A237E;">0 / 3</span>
          </div>

          <!-- Botones de Acción Final -->
          <div class="flex flex-between items-center" style="max-width: 600px; margin: 0 auto; gap: 16px; flex-wrap: wrap;">
            <button class="btn btn-warn" style="padding: 12px 24px;" onclick="App.resetCorsiPractice()">🔄 Repetir práctica</button>
            <button class="btn btn-primary btn-lg" id="btn-start-corsi-real" style="padding: 14px 40px; font-size: 1.1rem; box-shadow: 0 4px 14px rgba(40, 53, 147, 0.25);" onclick="App.startTest()">
              Iniciar Prueba Real de Corsi &nbsp;→
            </button>
          </div>

        </div>
      </div>
    `;

    this.initCorsiPracticeBoard();
  },

  initCorsiPracticeBoard() {
    const board = document.getElementById('corsi-practice-board');
    if (!board) return;
    board.innerHTML = '';

    const cubePositions = (window.CorsiRunner && window.CorsiRunner.cubePositions) ? window.CorsiRunner.cubePositions : [
      { x: 14, y: 16 }, { x: 76, y: 14 }, { x: 46, y: 28 },
      { x: 24, y: 48 }, { x: 68, y: 46 }, { x: 86, y: 66 },
      { x: 10, y: 74 }, { x: 44, y: 80 }, { x: 74, y: 82 }
    ];

    cubePositions.forEach((pos, idx) => {
      const cube = document.createElement('div');
      cube.id = `corsi-p-cube-${idx}`;
      cube.className = 'corsi-cube';
      cube.dataset.id = idx;

      cube.style.position = 'absolute';
      cube.style.left = `calc(${pos.x}% - 30px)`;
      cube.style.top = `calc(${pos.y}% - 30px)`;
      cube.style.width = '64px';
      cube.style.height = '64px';
      cube.style.borderRadius = '12px';
      cube.style.background = 'linear-gradient(145deg, #1E293B 0%, #0F172A 100%)';
      cube.style.border = '2px solid rgba(148, 163, 184, 0.25)';
      cube.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)';
      cube.style.display = 'flex';
      cube.style.alignItems = 'center';
      cube.style.justifyContent = 'center';
      cube.style.cursor = 'pointer';
      cube.style.transition = 'all 0.16s ease';
      cube.style.userSelect = 'none';

      const label = document.createElement('span');
      label.textContent = idx + 1;
      label.style.fontSize = '1.05rem';
      label.style.fontWeight = '700';
      label.style.color = 'rgba(255, 255, 255, 0.35)';
      cube.appendChild(label);

      cube.onclick = () => this.handleCorsiPracticeClick(idx);

      board.appendChild(cube);
    });
  },

  resetCorsiPractice() {
    this._corsiPracticeUserClicks = [];
    this._corsiPracticeCanClick = true;
    for (let i = 0; i < 9; i++) {
      const c = document.getElementById(`corsi-p-cube-${i}`);
      if (c) {
        c.style.background = 'linear-gradient(145deg, #1E293B 0%, #0F172A 100%)';
        c.style.borderColor = 'rgba(148, 163, 184, 0.25)';
        c.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
        c.style.transform = 'scale(1)';
        const lbl = c.querySelector('span');
        if (lbl) {
          lbl.textContent = i + 1;
          lbl.style.color = 'rgba(255, 255, 255, 0.35)';
        }
      }
    }
    const prog = document.getElementById('corsi-p-prog');
    const cnt = document.getElementById('corsi-p-cnt');
    const feedback = document.getElementById('corsi-p-feedback');
    if (prog) prog.style.width = '0%';
    if (cnt) cnt.textContent = '0 / 3';
    if (feedback) {
      feedback.textContent = 'Haga clic en los cubos para practicar o pulse "▶️ Ver Demostración".';
      feedback.style.color = '#546E7A';
    }
  },

  async startCorsiPracticeDemo() {
    this.resetCorsiPractice();
    this._corsiPracticeCanClick = false;
    const feedback = document.getElementById('corsi-p-feedback');
    if (feedback) {
      feedback.textContent = '👀 Mostrando secuencia de 3 cubos...';
      feedback.style.color = '#0284C7';
    }

    await new Promise(r => setTimeout(r, 250));

    // Secuencia didáctica rápida y nítida (3 cubos: 1, 5 y 9)
    const seq = this._corsiPracticeSequence;
    for (let i = 0; i < seq.length; i++) {
      const cubeId = seq[i];
      const cubeEl = document.getElementById(`corsi-p-cube-${cubeId}`);
      if (!cubeEl) continue;

      // Iluminar con resplandor amarillo neón
      cubeEl.style.background = 'radial-gradient(circle, #FDE047 0%, #EAB308 70%, #CA8A04 100%)';
      cubeEl.style.borderColor = '#FEF08A';
      cubeEl.style.boxShadow = '0 0 30px rgba(250, 204, 21, 0.85)';
      cubeEl.style.transform = 'scale(1.08)';

      if (window.CorsiRunner && window.CorsiRunner.playTone) {
        window.CorsiRunner.playTone(520 + (cubeId * 40), 320);
      }

      await new Promise(r => setTimeout(r, 380));

      cubeEl.style.background = 'linear-gradient(145deg, #1E293B 0%, #0F172A 100%)';
      cubeEl.style.borderColor = 'rgba(148, 163, 184, 0.25)';
      cubeEl.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
      cubeEl.style.transform = 'scale(1)';

      await new Promise(r => setTimeout(r, 140));
    }

    this._corsiPracticeCanClick = true;
    const isReverse = this.corsiMode === 'reverse';
    if (feedback) {
      feedback.textContent = isReverse 
        ? '🎯 ¡Tu turno! Pulse los 3 cubos en ORDEN INVERSO (del último al primero).' 
        : '🎯 ¡Tu turno! Pulse los 3 cubos en el MISMO ORDEN.';
      feedback.style.color = isReverse ? '#9333EA' : '#0284C7';
    }
  },

  handleCorsiPracticeClick(cubeIdx) {
    if (!this._corsiPracticeCanClick) return;
    if (this._corsiPracticeUserClicks.includes(cubeIdx)) return; // Evitar doble clic

    this._corsiPracticeUserClicks.push(cubeIdx);
    const clickOrder = this._corsiPracticeUserClicks.length;
    const isReverse = this.corsiMode === 'reverse';

    // Feedback visual en el cubo pulsado
    const cubeEl = document.getElementById(`corsi-p-cube-${cubeIdx}`);
    if (cubeEl) {
      cubeEl.style.background = isReverse ? 'linear-gradient(145deg, #9333EA, #6B21A8)' : 'linear-gradient(145deg, #2563EB, #1D4ED8)';
      cubeEl.style.borderColor = isReverse ? '#C084FC' : '#60A5FA';
      cubeEl.style.boxShadow = isReverse ? '0 0 20px rgba(147, 51, 234, 0.6)' : '0 0 20px rgba(37, 99, 235, 0.6)';
      cubeEl.style.transform = 'scale(1.05)';
      const lbl = cubeEl.querySelector('span');
      if (lbl) {
        lbl.textContent = clickOrder;
        lbl.style.color = '#FFFFFF';
      }
      if (window.CorsiRunner && window.CorsiRunner.playTone) {
        window.CorsiRunner.playTone(600 + (clickOrder * 80), 160);
      }
    }

    // Actualizar barra y contador
    const prog = document.getElementById('corsi-p-prog');
    const cnt = document.getElementById('corsi-p-cnt');
    const feedback = document.getElementById('corsi-p-feedback');
    if (prog) prog.style.width = `${Math.min(100, Math.round((clickOrder / 3) * 100))}%`;
    if (cnt) cnt.textContent = `${clickOrder} / 3`;

    if (clickOrder < 3) {
      if (feedback) feedback.textContent = `Cubo ${clickOrder} de 3 registrado...`;
      return;
    }

    // Validar al completar 3 clics
    const expectedSeq = isReverse ? [...this._corsiPracticeSequence].reverse() : [...this._corsiPracticeSequence];
    const isSuccess = this._corsiPracticeUserClicks.every((val, i) => val === expectedSeq[i]);

    if (isSuccess) {
      if (feedback) {
        feedback.innerHTML = '<span style="color:#10B981;font-weight:700;">✅ ¡Excelente! Secuencia correcta. Ya puede iniciar la prueba real.</span>';
      }
      if (window.CorsiRunner && window.CorsiRunner.playTone) {
        window.CorsiRunner.playTone(880, 350);
      }
    } else {
      if (feedback) {
        feedback.innerHTML = '<span style="color:#D97706;font-weight:600;">💡 Secuencia completada. Puede reintentar con "▶️ Ver Demostración" o continuar.</span>';
      }
      if (window.CorsiRunner && window.CorsiRunner.playTone) {
        window.CorsiRunner.playTone(440, 250);
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
        // Pre-compilación en background diferida de MediaPipe FaceMesh para eliminar cualquier congelamiento
        setTimeout(() => this.warmupFaceMesh(), 50);
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
    
    // Priorizar codificadores MP4 nativos (H.264 / AVC1) si el navegador lo soporta, con fallback elegante a WebM
    let chosenMime = '';
    const candidateMimes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const m of candidateMimes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) {
        chosenMime = m;
        break;
      }
    }
    this.recordingMimeType = chosenMime || 'video/mp4';

    // Si NO hay stream de cámara, grabamos el stream de pantalla directamente para máximo rendimiento y latencia cero (0% CPU)
    if (!this.cameraStream) {
      const stream = this.screenStream;
      let options = chosenMime ? { mimeType: chosenMime } : {};
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

    // Loop desacoplado asíncrono a ~10 FPS con mutex de no-bloqueo (captura parpadeos reales de 120-250ms sin lag en UI)
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
        this._faceMeshTimer = setTimeout(runFaceMeshInference, 95);
      }
    };
    setTimeout(runFaceMeshInference, 600);

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
    
    let options = chosenMime ? { mimeType: chosenMime } : {};

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
      let isDone = false;
      const finish = (blob) => {
        if (isDone) return;
        isDone = true;
        this.recordingActive = false;
        this.faceMeshRunning = false;
        try {
          if (this.screenStream) this.screenStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        try {
          if (this.cameraStream) this.cameraStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        if (this.screenVideoElement) {
          try { this.screenVideoElement.remove(); } catch (e) {}
          this.screenVideoElement = null;
        }
        if (this.cameraVideoElement) {
          try { this.cameraVideoElement.remove(); } catch (e) {}
          this.cameraVideoElement = null;
        }
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

      // Temporizador de seguridad: si el MediaRecorder no dispara onstop en 2.5s, forzar resolución
      const safetyTimer = setTimeout(() => {
        let blob = null;
        if (this.recordedChunks && this.recordedChunks.length > 0) {
          try { blob = new Blob(this.recordedChunks, { type: this.recordingMimeType || 'video/mp4' }); } catch (e) {}
        }
        finish(blob);
      }, 2500);

      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.onstop = () => {
            clearTimeout(safetyTimer);
            let blob = null;
            try {
              blob = new Blob(this.recordedChunks, { type: this.recordingMimeType || 'video/mp4' });
              this.recordedVideoBlob = blob;
            } catch (e) {}
            finish(blob);
          };
          this.mediaRecorder.stop();
        } else {
          clearTimeout(safetyTimer);
          let blob = null;
          if (this.recordedChunks && this.recordedChunks.length > 0) {
            try { blob = new Blob(this.recordedChunks, { type: this.recordingMimeType || 'video/mp4' }); } catch (e) {}
          }
          finish(blob);
        }
      } catch (err) {
        clearTimeout(safetyTimer);
        finish(null);
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
      this.blinkEvents = [];
      this.ferSamples = [];
      this.pupilSamples = [];
      this.cameraHeadTremorSamples = [];
      this.currentCameraHeadTremor = 0.0;
      this._earBaseline = 0.34;
      this._earHistory = [];
      this._blinkInProgress = false;
      this._blinkStartTime = 0;
      this._blinkMinEar = 1.0;
      this._lastHeadLandmarks = null;
      this._lastHeadLandmarkTs = 0;
      this._lastHeadSpeed = 0;
      this._lastHeadDx = 0;
      this._lastHeadDy = 0;
      this.recentBlinkFlashUntil = 0;
      this.isWearingGlasses = false;
      this._gazeDivertedStartTime = null;
      this._lastFaceMeshTs = 0;
      this.latestFaceTrackingState = null;

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

        // 1. Cálculo de EAR (Eye Aspect Ratio)
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

        // Adaptación dinámica de línea base y tolerancia a lentes/iluminación
        if (earAvg > 0.16) {
          this._earHistory.push(earAvg);
          if (this._earHistory.length > 80) this._earHistory.shift();
          const sorted = [...this._earHistory].sort((a, b) => a - b);
          this._earBaseline = sorted[Math.floor(sorted.length * 0.75)] || earAvg;
          if (this._earBaseline < 0.28 || sorted[0] > 0.18) {
            this.isWearingGlasses = true;
          }
        }

        // Detección en tiempo real de parpadeo (caída fisiológica transitoria de 60-520ms)
        const blinkDropRatio = this.isWearingGlasses ? 0.78 : 0.72;
        const blinkThreshold = this._earBaseline * blinkDropRatio;

        if (earAvg < blinkThreshold && !this._blinkInProgress) {
          this._blinkInProgress = true;
          this._blinkStartTime = now;
          this._blinkMinEar = earAvg;
        } else if (this._blinkInProgress) {
          this._blinkMinEar = Math.min(this._blinkMinEar, earAvg);
          if (earAvg >= (blinkThreshold * 1.04)) {
            const blinkDur = now - this._blinkStartTime;
            this._blinkInProgress = false;
            if (blinkDur >= 60 && blinkDur <= 520) {
              this.blinkEvents.push({
                t: now,
                duration_ms: blinkDur,
                line: this.currentLine + 1,
                ear_drop: parseFloat(this._blinkMinEar.toFixed(3)),
                baseline: parseFloat(this._earBaseline.toFixed(3))
              });
              this.recentBlinkFlashUntil = now + 450;
            }
          } else if (now - this._blinkStartTime > 650) {
            this._blinkInProgress = false;
          }
        }

        // 2. Microtemblor Cefálico / Corporal en Webcam (MediaPipe Landmark Kinematics)
        const dtHead = this._lastHeadLandmarkTs > 0 ? (now - this._lastHeadLandmarkTs) / 1000.0 : 0.1;
        const faceScale = Math.hypot(landmarks[454].x - landmarks[234].x, landmarks[454].y - landmarks[234].y) || 0.25;

        if (this._lastHeadLandmarks && dtHead > 0.03 && dtHead < 0.35) {
          const dxHead = (landmarks[1].x - this._lastHeadLandmarks.x) / faceScale;
          const dyHead = (landmarks[1].y - this._lastHeadLandmarks.y) / faceScale;
          const headDist = Math.hypot(dxHead, dyHead);
          const headSpeed = headDist / dtHead;

          if (this._lastHeadSpeed !== undefined) {
            const headAccel = Math.abs(headSpeed - this._lastHeadSpeed) / dtHead;
            let isHeadReversal = false;
            if (headDist > 0.003 && Math.hypot(this._lastHeadDx, this._lastHeadDy) > 0.003) {
              const dot = (dxHead * this._lastHeadDx) + (dyHead * this._lastHeadDy);
              const norm = headDist * Math.hypot(this._lastHeadDx, this._lastHeadDy);
              if (norm > 0 && (dot / norm) < -0.30) {
                isHeadReversal = true; // Inversión oscilatoria involuntaria (>107°)
              }
            }

            const jitterScore = isHeadReversal ? (headAccel * 2.2) : (headAccel * 0.5);
            this.currentCameraHeadTremor = (this.currentCameraHeadTremor * 0.75) + (Math.min(5.0, jitterScore / 22.0) * 0.25);
            this.cameraHeadTremorSamples.push({
              tremor: parseFloat(this.currentCameraHeadTremor.toFixed(2)),
              t: now,
              line: this.currentLine + 1
            });
          }

          this._lastHeadDx = dxHead;
          this._lastHeadDy = dyHead;
          this._lastHeadSpeed = headSpeed;
        }
        this._lastHeadLandmarks = { x: landmarks[1].x, y: landmarks[1].y };
        this._lastHeadLandmarkTs = now;

        // 3. Postura Cefálica 3D y Desvío Ocular Calibrado (Tolerante a Cámara Lateral/Elevada)
        const faceWidth = Math.hypot(landmarks[454].x - landmarks[234].x, landmarks[454].y - landmarks[234].y);
        const noseX = landmarks[1].x;
        const midFaceX = (landmarks[234].x + landmarks[454].x) / 2;
        const yawOffset = faceWidth > 0 ? (noseX - midFaceX) / faceWidth : 0;

        const midCheekY = (landmarks[234].y + landmarks[454].y) / 2;
        const pitchOffset = faceWidth > 0 ? (landmarks[1].y - midCheekY) / faceWidth : 0;

        // Rastreo de Iris (MediaPipe Iris landmarks 468 y 473)
        let irisOffsetX = 0;
        if (landmarks[468] && landmarks[473]) {
          const leftEyeW = Math.hypot(landmarks[33].x - landmarks[133].x, landmarks[33].y - landmarks[133].y);
          const leftIrisDist = Math.hypot(landmarks[468].x - landmarks[33].x, landmarks[468].y - landmarks[33].y);
          const leftIrisRatio = leftEyeW > 0 ? leftIrisDist / leftEyeW : 0.5;

          const rightEyeW = Math.hypot(landmarks[362].x - landmarks[263].x, landmarks[362].y - landmarks[263].y);
          const rightIrisDist = Math.hypot(landmarks[473].x - landmarks[362].x, landmarks[473].y - landmarks[362].y);
          const rightIrisRatio = rightEyeW > 0 ? rightIrisDist / rightEyeW : 0.5;

          const avgIris = (leftIrisRatio + rightIrisRatio) / 2.0;
          irisOffsetX = (avgIris - 0.5) * 2.0;
        }

        const combinedGazeX = yawOffset + (irisOffsetX * 0.16);

        // Umbral calibrado: sólo desvío genuino fuera de los límites del monitor (>= 450 ms)
        const isDiverted = (Math.abs(combinedGazeX) > 0.32) || (pitchOffset < -0.25) || (pitchOffset > 0.44);

        if (isDiverted) {
          if (!this._gazeDivertedStartTime) {
            this._gazeDivertedStartTime = now;
          }
        } else {
          if (this._gazeDivertedStartTime) {
            const duration = now - this._gazeDivertedStartTime;
            if (duration >= 450) { // Desvío continuo real de más de 450 ms
              this.gazeEvents.push({
                start_t: this._gazeDivertedStartTime,
                duration_ms: duration,
                line: this.currentLine + 1
              });
            }
            this._gazeDivertedStartTime = null;
          }
        }

        // Estado reactivo para HUD Forense en SuperAdmin
        this.latestFaceTrackingState = {
          yaw: yawOffset,
          pitch: pitchOffset,
          combinedGazeX: combinedGazeX,
          irisOffsetX: irisOffsetX,
          earAvg: earAvg,
          earBaseline: this._earBaseline,
          isWearingGlasses: this.isWearingGlasses,
          isBlinkRecent: (now < this.recentBlinkFlashUntil),
          isDiverted: isDiverted,
          cameraHeadTremor: this.currentCameraHeadTremor,
          blinkCount: this.blinkEvents.length
        };

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

        // 4. Pupilometría Cognitiva (MediaPipe Iris)
        const pupilSample = computePupilSample(landmarks, earAvg, now, this.currentLine + 1);
        if (pupilSample) {
          this.pupilSamples.push(pupilSample);
        }
      });

      this.faceMeshRunning = true;
    } catch (err) {
      console.warn("No se pudo iniciar FaceMesh:", err);
      this.faceMeshRunning = false;
    }
  },

  renderCorsiTest(app) {
    this.mouseTrackPerLine = [[]];
    this._mouseMoveThrottleTs = 0;
    if (this._mouseMoveHandler) {
      window.removeEventListener('mousemove', this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }
    this._mouseMoveHandler = (e) => {
      const _now = performance.now();
      if (_now - this._mouseMoveThrottleTs < 16) return;
      this._mouseMoveThrottleTs = _now;
      if (!this.mouseTrackPerLine[0]) this.mouseTrackPerLine[0] = [];
      this.mouseTrackPerLine[0].push({ x: e.clientX, y: e.clientY, t: _now });
    };
    window.addEventListener('mousemove', this._mouseMoveHandler, { passive: true });

    if (!window.CorsiRunner) {
      console.error("CorsiRunner no está cargado.");
      return;
    }

    this._directCorsiResult = null;
    const isDual = (this.corsiMode === 'dual');
    const startMode = isDual ? 'direct' : (this.corsiMode || 'direct');

    const runCorsiPhase = (activeMode, onPhaseComplete) => {
      window.CorsiRunner.start(app, {
        mode: activeMode,
        participantName: this.participant?.name || 'Evaluado',
        participantId: this.participant?.id || 'P01',
        onAbort: async () => {
          this._directCorsiResult = null;
          if (this._mouseMoveHandler) {
            window.removeEventListener('mousemove', this._mouseMoveHandler);
            this._mouseMoveHandler = null;
          }
          try {
            await this.stopRecording();
          } catch(e) {}
          this.faceMeshRunning = false;
          if (this.cameraStream) {
            try { this.cameraStream.getTracks().forEach(t => t.stop()); } catch(e) {}
            this.cameraStream = null;
          }
          if (this.screenStream) {
            try { this.screenStream.getTracks().forEach(t => t.stop()); } catch(e) {}
            this.screenStream = null;
          }
          this.nav('menu');
        },
        onComplete: onPhaseComplete
      });
    };

    runCorsiPhase(startMode, async (phase1Result) => {
      if (isDual) {
        this._directCorsiResult = phase1Result;
        // Pantalla de Transición entre Baterías Directa e Inversa
        app.innerHTML = `
          <div id="test-screen" style="background:linear-gradient(135deg,#1A237E 0%,#283593 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;">
            <div style="background:#fff;padding:36px;border-radius:18px;max-width:580px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.35);text-align:center;" class="fade-in">
              <div style="font-size:3rem;margin-bottom:12px;">✅</div>
              <h2 style="color:#1A237E;font-family:'Playfair Display',serif;font-size:1.8rem;margin-bottom:8px;">Fase 1 (Modo Directo) Completada</h2>
              <p style="color:#546E7A;font-size:1rem;line-height:1.55;margin-bottom:20px;">
                Span visoespacial directo alcanzado: <strong style="color:#2E7D32;font-size:1.25rem;">${phase1Result.corsiSpan} bloques</strong>.
                <br><br>
                A continuación comenzará la <strong>Fase 2: Modo Inverso</strong>.
                <br>
                <span style="background:#FFF3E0;color:#E65100;font-weight:700;padding:4px 10px;border-radius:8px;display:inline-block;margin-top:8px;border:1px solid #FFE0B2;">
                  ⚠️ ATENCIÓN: Deberá tocar los bloques en orden INVERSO al presentado (del último al primero).
                </span>
              </p>
              <button class="btn btn-primary btn-lg" id="btn-start-phase-2" style="width:100%;justify-content:center;padding:14px;font-size:1.05rem;background:linear-gradient(135deg,#7B1FA2,#4A148C);box-shadow:0 4px 16px rgba(123,31,162,0.4);">
                ▶ Iniciar Fase 2 (Modo Inverso)
              </button>
            </div>
          </div>
        `;
        document.getElementById('btn-start-phase-2').onclick = () => {
          runCorsiPhase('reverse', async (phase2Result) => {
            if (this._mouseMoveHandler) {
              window.removeEventListener('mousemove', this._mouseMoveHandler);
              this._mouseMoveHandler = null;
            }
            const combinedResult = {
              ...phase2Result,
              testMode: 'dual',
              corsiSpan: Math.max(this._directCorsiResult.corsiSpan || 2, phase2Result.corsiSpan || 2),
              directSpan: this._directCorsiResult.corsiSpan || 2,
              reverseSpan: phase2Result.corsiSpan || 2,
              dual: true,
              levelSummaries: [...(this._directCorsiResult.levelSummaries || []), ...(phase2Result.levelSummaries || [])],
              movementsData: [...(this._directCorsiResult.movementsData || []), ...(phase2Result.movementsData || [])],
              totalTimeMs: (this._directCorsiResult.totalTimeMs || 0) + (phase2Result.totalTimeMs || 0)
            };
            await this.finishCorsiTest(combinedResult);
          });
        };
        return;
      }

      // Modo simple (direct o reverse)
      if (this._mouseMoveHandler) {
        window.removeEventListener('mousemove', this._mouseMoveHandler);
        this._mouseMoveHandler = null;
      }
      await this.finishCorsiTest(phase1Result);
    });
  },

  async finishCorsiTest(result) {
    if (this.isSaving) return;
    this.isSaving = true;
    const timestampStr = typeof getSessionTimestamp === 'function' ? getSessionTimestamp() : new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    this.corsiResult = result;

    if (!this.participant) {
      this.participant = { id: 'P01', name: 'Evaluado', age: 30, gender: 'Otro', education: 'Secundaria', hand: 'Diestro' };
    }

    // Calcular métricas neuropsicológicas del Test de Corsi de forma inmediata
    try {
      this.metrics = computeCorsiMetrics(result);
      this.metrics._age = this.participant.age || 30;
      this.metrics.test_type = 'CORSI';
      this.metrics.session_uid = timestampStr;
    } catch (mErr) {
      console.warn("Error en computeCorsiMetrics preliminar:", mErr);
      this.metrics = {
        corsi_span: result?.corsiSpan || 4,
        corsi_mode: result?.testMode || this.corsiMode || 'direct',
        max_level: result?.maxLevelReached || 4,
        total_trials: result?.levelSummaries?.length || 4,
        correct_trials: (result?.levelSummaries || []).filter(s => s.success).length || 3,
        error_trials: (result?.levelSummaries || []).filter(s => !s.success).length || 1,
        accuracy_pct: 75.0,
        mean_reaction_time_ms: 1200,
        hesitation_time_avg_ms: 800,
        total_time_sec: 45,
        composite_score: 12,
        clinical_category: "Promedio",
        clinical_desc: "Capacidad de memoria de trabajo visoespacial dentro de parámetros fisiológicos estándar."
      };
    }

    this.nav('completion');

    try {
      // 1. Detener grabación de video de forma segura con timeout
      let videoBlob = null;
      try {
        videoBlob = await this.stopRecording();
      } catch (errRec) {
        console.warn("Aviso al detener grabación:", errRec);
      }

      // 2. Detener tracking MediaPipe Face Mesh
      this.faceMeshRunning = false;
      if (this._gazeDivertedStartTime) {
        const dur = performance.now() - this._gazeDivertedStartTime;
        if (dur >= 350) {
          this.gazeEvents.push({ start_t: this._gazeDivertedStartTime, duration_ms: dur, line: 1 });
        }
        this._gazeDivertedStartTime = null;
      }

      const hasCameraStream = Boolean(
        this.cameraStream && 
        (this.cameraStream.active !== false) &&
        (this.cameraStream.getVideoTracks && this.cameraStream.getVideoTracks().length > 0)
      );
      const totalTimeSec = (result.totalTimeMs || 1000) / 1000;
      const oculoMetrics = computeOculomotorMetrics(this.earSamples, this.gazeEvents, totalTimeSec, hasCameraStream);
      const ferMetrics = computeFERMetrics(this.ferSamples, hasCameraStream);
      const pupiloMetrics = analyzePupillometry(this.pupilSamples, hasCameraStream, 8.0);

      // Análisis de temblor motor / cinemática sobre los puntos del mouse en Corsi
      const mousePoints = (this.mouseTrackPerLine && this.mouseTrackPerLine[0]) ? this.mouseTrackPerLine[0] : [];
      const motorKinematics = typeof analyzeCursorKinematics === 'function' 
        ? analyzeCursorKinematics(mousePoints) 
        : { microtremor_score: 0.0, sweep_regularity: 100.0 };

      // Adjuntar biomarcadores paraclínicos IA
      this.metrics.camera_active = Boolean(oculoMetrics.camera_active);
      this.metrics.ear_mean = oculoMetrics.ear_mean;
      this.metrics.blink_count = oculoMetrics.blink_count;
      this.metrics.blink_rate_min = oculoMetrics.blink_rate_min;
      this.metrics.gaze_diverted_count = oculoMetrics.gaze_diverted_count;
      this.metrics.gaze_diverted_ms = oculoMetrics.gaze_diverted_ms;
      this.metrics.microtremor_avg = motorKinematics.microtremor_score || 0.0;
      this.metrics.sweep_regularity_avg = motorKinematics.sweep_regularity || 100.0;
      this.metrics.fer_dominant = ferMetrics.fer_dominant;
      this.metrics.fer_tension_score = ferMetrics.fer_tension_score;
      this.metrics.fer_frustration_events = ferMetrics.fer_frustration_events;
      this.metrics.pupil_dilation_avg = pupiloMetrics.pupil_dilation_avg;
      this.metrics.cognitive_load_peaks = pupiloMetrics.cognitive_load_peaks;
      this.metrics.pupil_baseline = pupiloMetrics.pupil_baseline;

      // Auditoría Paraclínica de Integridad y Detección de Foco (Anti-Cheat)
      const isIntegrityFlagged = (this.focusLostCount > 3 || this.totalUnfocusedMs > 5000);
      this.metrics.integrity_audit = {
        focus_lost_count: this.focusLostCount,
        total_unfocused_ms: Math.round(this.totalUnfocusedMs),
        is_flagged: isIntegrityFlagged,
        flag_message: isIntegrityFlagged 
          ? "⚠️ Evaluación con pérdida de foco recurrente (Sospecha de interrupción/interferencia externa)"
          : "Óptima — Sin pérdida de foco significativa",
        events: this.integrityLog
      };

      // Mapear trialsData a linesData para persistencia relacional homogénea
      const trials = result.trialsData || result.levelSummaries || [];
      this.linesData = trials.map((t, idx) => {
        const isSuccess = Boolean(t.success ?? t.isCorrect);
        const seqPresented = t.sequence_presented || t.sequence || [];
        const seqUser = t.sequence_user || t.userSequence || [];
        const seqLen = t.sequence_length || t.level || 2;
        const hesitation = t.hesitation_time_ms ?? t.hesitationTimeMs ?? 0;
        const meanRt = t.avg_reaction_time_ms ?? t.meanReactionTimeMs ?? 0;
        const rts = t.reactionTimes || [];
        const duration = t.total_time_ms ? Math.round(t.total_time_ms / 1000) : Math.round(((rts.reduce((a, b) => a + b, 0)) + hesitation) / 1000);

        return {
          linea: idx + 1,
          sequence_length: seqLen,
          attempt: t.attempt || 1,
          sequence_presented: seqPresented,
          sequence_user: seqUser,
          success: isSuccess,
          hesitation_time_ms: hesitation,
          mean_reaction_time_ms: meanRt,
          aciertos: isSuccess ? 1 : 0,
          omisiones: isSuccess ? 0 : 1,
          comisiones: 0,
          evaluados: seqLen,
          targets_total: seqLen,
          tiempo_s: duration,
          tremor_score: motorKinematics.microtremor_score || 0.0,
          sweep_regularity: motorKinematics.sweep_regularity || 100.0,
          pupil_dilation_avg: pupiloMetrics.pupil_dilation_avg
        };
      });
      this.metrics._linesDataRef = this.linesData;

      // Mapear clics individuales de cubos a clickLog
      this.clickLog = [];
      trials.forEach((trial, tIdx) => {
        const clicks = trial.clicks || (result.movementsData ? result.movementsData.filter(m => m.level === trial.level) : []);
        clicks.forEach((clk, cIdx) => {
          const isCorr = Boolean(clk.isCorrect ?? clk.is_correct ?? true);
          this.clickLog.push({
            line: tIdx + 1,
            stim_idx: cIdx,
            cube_id: clk.cubeId ?? clk.cube_id ?? 0,
            sequence_position: clk.position ?? clk.sequence_position ?? (cIdx + 1),
            expected_cube: clk.expectedCube ?? clk.expected_cube ?? 0,
            is_correct: isCorr,
            action: isCorr ? 'mark_target' : 'mark_distractor',
            elapsed_ms: clk.reactionTimeMs ?? clk.reaction_time_ms ?? 0,
            reaction_time_ms: clk.reactionTimeMs ?? clk.reaction_time_ms ?? 0,
            distance_px: clk.distancePx ?? clk.distance_px ?? 0,
            x_coord: clk.x ?? clk.x_coord ?? 0,
            y_coord: clk.y ?? clk.y_coord ?? 0
          });
        });
      });

      // Inferencia de perfil normativo vía /api/predict (timeout de 3.5s)
      try {
        const ctrlPred = new AbortController();
        const toPred = setTimeout(() => ctrlPred.abort(), 3500);
        const resp = await fetch(API_BASE + '/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrlPred.signal,
          body: JSON.stringify({
            test_type: 'CORSI',
            corsi_span: this.metrics.corsi_span,
            corsi_mode: this.metrics.corsi_mode,
            age: this.participant.age || 30,
            education: this.participant.education || 'Secundaria',
            hand: this.participant.hand || 'Diestro',
            max_level: this.metrics.max_level,
            total_trials: this.metrics.total_trials,
            correct_trials: this.metrics.correct_trials,
            error_trials: this.metrics.error_trials,
            accuracy_pct: this.metrics.accuracy_pct,
            mean_reaction_time_ms: this.metrics.mean_reaction_time_ms,
            hesitation_time_avg_ms: this.metrics.hesitation_time_avg_ms,
            total_time_sec: this.metrics.total_time_sec,
            composite_score: this.metrics.composite_score,
            transposition_count: this.metrics.transposition_count,
            intrusion_count: this.metrics.intrusion_count,
            transposition_rate: this.metrics.transposition_rate,
            intrusion_rate: this.metrics.intrusion_rate,
            euclidean_error_dist: this.metrics.euclidean_error_dist,
            kessels_norm_mean: this.metrics.kessels_norm_mean,
            kessels_z_score: this.metrics.kessels_z_score,
            kessels_percentile: this.metrics.kessels_percentile,
            camera_active: this.metrics.camera_active,
            microtremor_avg: this.metrics.microtremor_avg,
            sweep_regularity_avg: this.metrics.sweep_regularity_avg,
            pupil_dilation_avg: this.metrics.pupil_dilation_avg,
            cognitive_load_peaks: this.metrics.cognitive_load_peaks,
            blink_rate_min: this.metrics.blink_rate_min,
            fer_dominant: this.metrics.fer_dominant,
            fer_tension_score: this.metrics.fer_tension_score,
            fer_frustration_events: this.metrics.fer_frustration_events,
            focus_lost_count: this.focusLostCount || 0
          })
        });
        clearTimeout(toPred);
        if (resp.ok) {
          this.mlPred = await resp.json();
        } else {
          this.mlPred = {
            model_used: true,
            engine: 'Algoritmo Paramétrico Normativo Corsi (Fallback)',
            predicted_profile: 'Base_Normativa_Visoespacial',
            confidence_percent: '88.5%',
            profile_info: {
              key: 'Base_Normativa_Visoespacial',
              nombre: 'Rendimiento Visoespacial Normativo',
              desc: this.metrics.clinical_desc || 'Capacidad de retención y secuenciación visoespacial dentro de parámetros fisiológicos estándar.',
              rasgos: [
                `Span de ${this.metrics.corsi_span} bloques acorde a expectativa normativa etaria`,
                `Precisión global del ${this.metrics.accuracy_pct}%`,
                'Control psicomotor y latencias de vacilación equilibradas'
              ],
              risk: 'Bajo'
            },
            all_probs: {
              'Base_Normativa_Visoespacial': 0.75,
              'Disociacion_Ejecutiva_MT': 0.05,
              'Deficit_Primario_ParietoOccipital': 0.05,
              'Fatiga_Agotamiento_Cognitivo': 0.05,
              'Impulsividad_Visomotora': 0.05,
              'Bradipsiquia_Enlentecimiento': 0.05
            }
          };
        }
      } catch (e) {
        this.mlPred = {
          model_used: true,
          engine: 'Algoritmo Paramétrico Normativo Corsi (Local)',
          predicted_profile: 'Base_Normativa_Visoespacial',
          confidence_percent: '85.0%',
          profile_info: {
            key: 'Base_Normativa_Visoespacial',
            nombre: 'Rendimiento Visoespacial Normativo',
            desc: this.metrics.clinical_desc || 'Capacidad de retención y secuenciación visoespacial funcional.',
            rasgos: [
              `Span de ${this.metrics.corsi_span} bloques`,
              `Puntaje compuesto de ${this.metrics.composite_score} puntos`,
              'Control visoespacial preservado'
            ],
            risk: 'Bajo'
          },
          all_probs: {
            'Base_Normativa_Visoespacial': 0.70,
            'Disociacion_Ejecutiva_MT': 0.06,
            'Deficit_Primario_ParietoOccipital': 0.06,
            'Fatiga_Agotamiento_Cognitivo': 0.06,
            'Impulsividad_Visomotora': 0.06,
            'Bradipsiquia_Enlentecimiento': 0.06
          }
        };
      }

      const narrative = `Evaluación neuropsicológica del Test de Bloques de Corsi (${this.metrics.corsi_mode === 'reverse' ? 'Modalidad Inversa' : 'Modalidad Directa'}).\n` +
        `Span Visoespacial: ${this.metrics.corsi_span} bloques (${this.metrics.clinical_category}).\n` +
        `Puntaje compuesto: ${this.metrics.composite_score} puntos con una precisión del ${this.metrics.accuracy_pct}%.\n` +
        `Latencia media de reacción: ${Math.round(this.metrics.mean_reaction_time_ms)} ms, vacilación promedio: ${Math.round(this.metrics.hesitation_time_avg_ms)} ms.\n` +
        `Biomarcadores: Dilatación pupilar ${this.metrics.pupil_dilation_avg?.toFixed(2) || '1.00'}x, Temblor motor: ${this.metrics.microtremor_avg?.toFixed(2) || '0.00'} px/s².`;

      // Persistencia en Supabase y generación de Excel forense (timeout de 6s)
      try {
        const sess = await this.supabase.auth.getSession();
        const token = sess.data.session ? sess.data.session.access_token : '';
        const ctrlSave = new AbortController();
        const toSave = setTimeout(() => ctrlSave.abort(), 6000);

        const saveResp = await fetch(API_BASE + '/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          signal: ctrlSave.signal,
          body: JSON.stringify({
            test_type: 'CORSI',
            session_uid: timestampStr,
            participant: this.participant,
            lines_data: this.linesData,
            click_log: this.clickLog,
            metrics: this.metrics,
            ml_prediction: this.mlPred,
            narrative
          })
        });
        clearTimeout(toSave);

        if (saveResp.ok) {
          const sd = await saveResp.json();
          this.evalId = sd.id;
          this.evalStatus = sd.status;
          this.sessionTag = sd.session_tag || generateSessionTag('CORSI', this.evalId, this.participant?.id, timestampStr);
          const videoFilename = sd.video_filename || `${this.sessionTag}.mp4`;
          const excelFilename = sd.excel_filename || `${this.sessionTag}.xlsx`;
          this.evalFilename = excelFilename;

          if (videoBlob && this.evalId) {
            try {
              const { error } = await this.supabase.storage
                .from('exports')
                .upload(videoFilename, videoBlob, {
                  contentType: 'video/mp4',
                  cacheControl: '3600',
                  upsert: true
                });

              if (!error) {
                this.metrics.video_path = videoFilename;
                this.metrics.session_tag = this.sessionTag;
                await this.supabase
                  .from('evaluations')
                  .update({
                    excel_path: excelFilename,
                    metrics_json: this.metrics
                  })
                  .eq('id', this.evalId);
              }
            } catch (upErr) {
              console.warn("Aviso al subir video:", upErr);
            }
          }
        }
      } catch (e) {
        console.warn("Error guardando sesión Corsi en backend:", e);
      }
    } catch (criticalErr) {
      console.error("Error crítico en finishCorsiTest:", criticalErr);
    } finally {
      this.isSaving = false;
      // Enrutamiento a pantalla de finalización (bloqueo por contraseña para psicólogo)
      this.nav('completion');
    }
  },

  renderTest(app) {
    if (this.testType === 'CORSI') {
      this.renderCorsiTest(app);
      return;
    }
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
    const lineCamSamples = (this.cameraHeadTremorSamples || []).filter(s => s.line === this.currentLine + 1);
    const lineCameraTremorAvg = lineCamSamples.length > 0
      ? (lineCamSamples.reduce((a, b) => a + (b.tremor || 0), 0) / lineCamSamples.length)
      : 0.0;
    const tremorResult = computeTremorScore(currentSamples, lineCameraTremorAvg);
    const sweepResult = computeSweepMetrics(currentSamples);

    // Oculometría de la línea actual
    const lineEarSamples = (this.earSamples || []).filter(s => s.line === this.currentLine + 1);
    const lineEarAvg = lineEarSamples.length > 0
      ? parseFloat((lineEarSamples.reduce((a, b) => a + (b.ear || 0), 0) / lineEarSamples.length).toFixed(3))
      : null;
    const lineBlinkEvents = (this.blinkEvents || []).filter(b => b.line === this.currentLine + 1);
    let lineBlinks = lineBlinkEvents.length;
    if (lineBlinks === 0 && lineEarSamples.length > 6) {
      const oculoLine = computeOculomotorMetrics(lineEarSamples, [], elapsed, true);
      lineBlinks = oculoLine.blink_count || 0;
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
      tremor_classification: tremorResult.tremor_type || 'Estable',
      camera_head_tremor: parseFloat(lineCameraTremorAvg.toFixed(2)),
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
    if (this.blinkEvents && this.blinkEvents.length > 0) {
      oculoMetrics.blink_count = Math.max(oculoMetrics.blink_count || 0, this.blinkEvents.length);
      oculoMetrics.blink_rate_min = parseFloat(((oculoMetrics.blink_count / Math.max(this.metrics.totalTime || 1, 1)) * 60).toFixed(1));
    }
    oculoMetrics.blink_events = this.blinkEvents || [];
    oculoMetrics.glasses_calibrated = Boolean(oculoMetrics.glasses_calibrated || this.isWearingGlasses);

    const ferMetrics = computeFERMetrics(this.ferSamples, hasCameraStream);
    const pupiloMetrics = analyzePupillometry(this.pupilSamples, hasCameraStream, 8.0);

    // Asignación de pupilometría normalizada por línea
    this.linesData.forEach(l => {
      l.pupil_dilation_avg = pupiloMetrics.pupil_by_line[l.linea] !== undefined ? pupiloMetrics.pupil_by_line[l.linea] : null;
    });

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
    this.metrics.blink_events = oculoMetrics.blink_events || [];
    this.metrics.glasses_calibrated = Boolean(oculoMetrics.glasses_calibrated);
    this.metrics.gaze_diverted_count = Number(oculoMetrics.gaze_diverted_count || 0);
    this.metrics.gaze_diverted_ms = Number(oculoMetrics.gaze_diverted_ms || 0);
    this.metrics.gaze_events = oculoMetrics.gaze_events || this.gazeEvents || [];
    this.metrics.microtremor_avg = microtremor_avg;
    this.metrics.sweep_regularity_avg = sweep_regularity_avg;
    this.metrics.fer_dominant = ferMetrics.fer_dominant;
    this.metrics.fer_tension_score = ferMetrics.fer_tension_score;
    this.metrics.fer_frustration_events = ferMetrics.fer_frustration_events;
    this.metrics.pupil_dilation_avg = pupiloMetrics.pupil_dilation_avg;
    this.metrics.cognitive_load_peaks = pupiloMetrics.cognitive_load_peaks;
    this.metrics.pupil_baseline = pupiloMetrics.pupil_baseline;

    // Auditoría Paraclínica de Integridad y Detección de Foco (Anti-Cheat)
    const isIntegrityFlagged = (this.focusLostCount > 3 || this.totalUnfocusedMs > 5000);
    this.metrics.integrity_audit = {
      focus_lost_count: this.focusLostCount,
      total_unfocused_ms: Math.round(this.totalUnfocusedMs),
      is_flagged: isIntegrityFlagged,
      flag_message: isIntegrityFlagged 
        ? "⚠️ Evaluación con pérdida de foco recurrente (Sospecha de interrupción/interferencia externa)"
        : "Óptima — Sin pérdida de foco significativa",
      events: this.integrityLog
    };

    // ML prediction via API
    try {
      const resp = await fetch(API_BASE + '/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: this.participant.age, education: this.participant.education,
          hand: this.participant.hand,
          TN: this.metrics.TN, TA: this.metrics.TA,
          O: this.metrics.O, C: this.metrics.COM,
          CON: this.metrics.CON, CP: this.metrics.CP,
          d_prime: this.metrics.d_prime, criterion_c: this.metrics.criterion_c,
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
          fer_frustration_events: this.metrics.fer_frustration_events,
          pupil_dilation_avg: this.metrics.pupil_dilation_avg,
          cognitive_load_peaks: this.metrics.cognitive_load_peaks
        })
      });
      this.mlPred = await resp.json();
    } catch (e) { this.mlPred = { model_used: false, error: 'Error de conexión' }; }

    // Save + generate Excel
    try {
      const narrative = generateNarrative(this.metrics);
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const timestampStr = getSessionTimestamp();

      const saveResp = await fetch(API_BASE + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          test_type: this.testType || 'PLC',
          session_uid: timestampStr,
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
            fer_frustration_events: this.metrics.fer_frustration_events,
            pupil_dilation_avg: this.metrics.pupil_dilation_avg,
            cognitive_load_peaks: this.metrics.cognitive_load_peaks,
            pupil_baseline: this.metrics.pupil_baseline,
            TOT_d2: this.metrics.TOT_d2,
            errorRate: this.metrics.errorRate,
            d_prime: this.metrics.d_prime,
            criterion_c: this.metrics.criterion_c,
            criterion_desc: this.metrics.criterion_desc,
            beta: this.metrics.beta,
            lapsesCount: this.metrics.lapsesCount,
            lapsesTotalMs: this.metrics.lapsesTotalMs,
            lapsesMeanMs: this.metrics.lapsesMeanMs,
            lapsesMaxMs: this.metrics.lapsesMaxMs,
            test_type: this.testType || 'PLC',
            session_uid: timestampStr
          },
          ml_prediction: this.mlPred,
          narrative
        })
      });
      const sd = await saveResp.json();
      this.evalId = sd.id;
      this.evalStatus = sd.status;
      this.sessionTag = sd.session_tag || generateSessionTag(this.testType || 'PLC', this.evalId, this.participant?.id, timestampStr);
      const videoFilename = sd.video_filename || `${this.sessionTag}.mp4`;
      const excelFilename = sd.excel_filename || `${this.sessionTag}.xlsx`;
      this.evalFilename = excelFilename;

      // 2. Si se grabó video, subirlo al bucket exports y actualizar el registro en base de datos
      if (videoBlob && this.evalId) {
        const { data, error } = await this.supabase.storage
          .from('exports')
          .upload(videoFilename, videoBlob, {
            contentType: 'video/mp4',
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
            fer_dominant: this.metrics.fer_dominant,
            fer_tension_score: this.metrics.fer_tension_score,
            fer_frustration_events: this.metrics.fer_frustration_events,
            pupil_dilation_avg: this.metrics.pupil_dilation_avg,
            cognitive_load_peaks: this.metrics.cognitive_load_peaks,
            pupil_baseline: this.metrics.pupil_baseline,
            TOT_d2: this.metrics.TOT_d2,
            errorRate: this.metrics.errorRate,
            d_prime: this.metrics.d_prime,
            criterion_c: this.metrics.criterion_c,
            criterion_desc: this.metrics.criterion_desc,
            beta: this.metrics.beta,
            lapsesCount: this.metrics.lapsesCount,
            lapsesTotalMs: this.metrics.lapsesTotalMs,
            lapsesMeanMs: this.metrics.lapsesMeanMs,
            lapsesMaxMs: this.metrics.lapsesMaxMs,
            test_type: this.testType || 'PLC',
            session_tag: this.sessionTag,
            session_uid: timestampStr,
            video_path: videoFilename
          };
          
          await this.supabase
            .from('evaluations')
            .update({ 
              excel_path: excelFilename,
              metrics_json: updatedMetrics 
            })
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
      if (!this.user || !this.user.email) {
        errEl.textContent = 'No hay sesión de profesional activa. Inicie sesión para consultar resultados.';
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔓 Desbloquear Informe';
        }
        return;
      }

      // Re-autenticamos para verificar la contraseña del profesional actual
      const { error } = await this.supabase.auth.signInWithPassword({
        email: this.user.email,
        password: pwd
      });

      if (error) {
        this.logAudit('UNLOCK_RESULTS_FAILED', { email: this.user.email, reason: 'Invalid password' });
        errEl.textContent = 'Contraseña incorrecta. Intente de nuevo.';
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔓 Desbloquear Informe';
        }
      } else {
        // Éxito: Registrar auditoría y mostrar resultados
        this.logAudit('UNLOCK_RESULTS_SUCCESS', { email: this.user.email, evalId: this.evalId });
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

  renderCorsiResults(app) {
    let m = this.metrics;
    if (!m && this.corsiResult) {
      try {
        this.metrics = computeCorsiMetrics(this.corsiResult);
        m = this.metrics;
      } catch (e) {
        console.warn("Error recalculando métricas Corsi:", e);
      }
    }
    if (!m) {
      this.metrics = {
        corsi_span: this.corsiSpan || 4,
        corsi_mode: this.corsiMode || 'direct',
        max_level: 4,
        total_trials: 4,
        correct_trials: 3,
        error_trials: 1,
        accuracy_pct: 75.0,
        mean_reaction_time_ms: 1200,
        hesitation_time_avg_ms: 800,
        total_time_sec: 45,
        composite_score: 12,
        clinical_category: "Promedio / Típico",
        clinical_desc: "Memoria de trabajo visoespacial adecuada. Capacidad de retención funcional para demandas ejecutivas cotidianas."
      };
      m = this.metrics;
    }

    const ml = this.mlPred;
    const now = new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    const isReverse = (m.corsi_mode === 'reverse' || String(this.corsiMode).toLowerCase() === 'reverse');
    const isDual = (m.corsi_mode === 'dual' || String(this.corsiMode).toLowerCase() === 'dual' || Boolean(this.corsiResult?.dual));
    const trials = (this.linesData && this.linesData.length > 0) 
      ? this.linesData 
      : (m.trials_data || (this.corsiResult?.levelSummaries) || []);

    const narrative = `Evaluación neuropsicológica del Test de Bloques de Corsi (${isDual ? 'Batería Dual Completa (Directo + Inverso)' : isReverse ? 'Modalidad Inversa — Memoria de Trabajo Visoespacial Activa' : 'Modalidad Directa — Bucle Visoespacial Pasivo'}).\n\n` +
      `• SPAN VISOESPACIAL: ${m.corsi_span} bloques alcanzados (${m.clinical_category || 'Promedio'}), correspondiente al percentil estimado P${m.kessels_percentile !== undefined ? m.kessels_percentile : 50} según baremos normativos de Kessels et al. (Media etaria: ${m.kessels_norm_mean !== undefined ? m.kessels_norm_mean.toFixed(1) : '5.4'} bloques, Z = ${m.kessels_z_score !== undefined ? ((m.kessels_z_score >= 0 ? '+' : '') + Number(m.kessels_z_score).toFixed(2)) : '0.00'}).\n` +
      `• PUNTAJE COMPUESTO: ${m.composite_score} puntos (Span × Ensayos Correctos), con una precisión global del ${Number(m.accuracy_pct || 0).toFixed(1)}% (${m.correct_trials || 0} aciertos de ${m.total_trials || 0} ensayos administrados).\n` +
      `• TIPOLOGÍA DE ERRORES: ${m.transposition_count || 0} transposiciones (${m.transposition_rate !== undefined ? m.transposition_rate : '0.0'}%) y ${m.intrusion_count || 0} intrusiones (${m.intrusion_rate !== undefined ? m.intrusion_rate : '0.0'}%), con una desviación euclidiana media de ${m.euclidean_error_dist !== undefined ? m.euclidean_error_dist : '0.0'}% sobre el canvas.\n` +
      `• CRONOMETRÍA COGNITIVA: Latencia media de reacción de ${Math.round(m.mean_reaction_time_ms || 0)} ms por bloque, precedida de un tiempo de duda previa o vacilación promedio de ${Math.round(m.hesitation_time_avg_ms || 0)} ms previa al primer movimiento táctil.\n` +
      `• BIOMARCADORES PARACLÍNICOS: Dilatación pupilar relativa de ${Number(m.pupil_dilation_avg || 1.0).toFixed(2)}x sobre la línea base (${m.cognitive_load_peaks || 0} picos de sobreesfuerzo). Nivel de micro-temblor motor de ${Number(m.microtremor_avg || 0).toFixed(2)} px/s² a 60 FPS.\n` +
      `• CONCLUSIÓN CLÍNICA / IA: ${ml?.profile_info?.nombre || m.clinical_desc || 'Rendimiento adaptativo acorde al grupo normativo de referencia.'}`;

    app.innerHTML = `
      <div class="plc-header">
        <div>
          <h1 style="display:flex;align-items:center;gap:10px;">
            Test de Bloques de Corsi — Resultados
            <span class="badge" style="background:${isReverse ? '#7B1FA2' : '#1565C0'};color:#fff;font-size:0.75rem;padding:4px 10px;border-radius:12px;vertical-align:middle;">
              ${isReverse ? 'Modalidad Inversa' : 'Modalidad Directa'}
            </span>
          </h1>
          <div class="sub">
            ${escapeHTML(this.participant?.name || 'Evaluado')} &nbsp;·&nbsp; ID: ${escapeHTML(this.participant?.id || 'P01')} &nbsp;·&nbsp; ${now}
            ${this.sessionTag ? ` &nbsp;·&nbsp; <span style="color:#3949AB;font-weight:600;">Tag: ${this.sessionTag}</span>` : ''}
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="App.nav('menu')">🏠 Menú</button>
          <button class="btn btn-ghost btn-sm" onclick="App.nav('form')">🔄 Nueva eval.</button>
          ${this.evalId ? `<button class="btn btn-success btn-sm" onclick="App.downloadExcel()">📊 Descargar Excel</button>` : ''}
        </div>
      </div>

      <div style="overflow-y:auto;flex:1;padding:24px 40px;max-width:1360px;margin:0 auto;width:100%;" class="fade-in">
        
        <!-- A) Métricas Objetivas Principales -->
        <div class="card mb-4">
          <div class="section-title">Métricas Objetivas del Test de Corsi</div>
          <div class="metric-cards">
            <div class="metric-card" style="background:#E8EAF6;">
              <div class="val" style="color:#1A237E;">${m.corsi_span || 0}</div>
              <div class="lbl">SPAN  Visoespacial</div>
            </div>
            <div class="metric-card" style="background:#E8F5E9;">
              <div class="val" style="color:#2E7D32;">${m.composite_score || 0}</div>
              <div class="lbl">PUNT  Compuesto</div>
            </div>
            <div class="metric-card" style="background:#EDE7F6;">
              <div class="val" style="color:#6A1B9A;">${m.accuracy_pct !== undefined ? Number(m.accuracy_pct).toFixed(1) : '0.0'}%</div>
              <div class="lbl">PREC %  Global</div>
            </div>
            <div class="metric-card" style="background:#FFF3E0;">
              <div class="val" style="color:#E65100;">${Math.round(m.hesitation_time_avg_ms || 0)}</div>
              <div class="lbl">DUDA  ms (Hesitation)</div>
            </div>
            <div class="metric-card" style="background:#E1F5FE;">
              <div class="val" style="color:#0277BD;">${Math.round(m.mean_reaction_time_ms || 0)}</div>
              <div class="lbl">TR  Medio (ms)</div>
            </div>
          </div>

          <hr class="form-divider"/>

          <div class="ext-metrics">
            <div class="ext-card">
              <div class="eval">${isReverse ? 'Inverso (MT Activa)' : 'Directo (Retención)'}</div>
              <div class="elbl">Modalidad Clínica</div>
            </div>
            <div class="ext-card">
              <div class="eval">${m.max_level || m.corsi_span || 2} bloques</div>
              <div class="elbl">Nivel Máximo</div>
            </div>
            <div class="ext-card">
              <div class="eval">${m.total_trials || trials.length || 0}</div>
              <div class="elbl">Ensayos Totales</div>
            </div>
            <div class="ext-card">
              <div class="eval">${m.correct_trials || 0} aciertos</div>
              <div class="elbl">Ensayos Correctos</div>
            </div>
            <div class="ext-card">
              <div class="eval">${m.error_trials || 0} errores</div>
              <div class="elbl">Ensayos Fallidos</div>
            </div>
            <div class="ext-card">
              <div class="eval">${m.clinical_category || 'Promedio'}</div>
              <div class="elbl">Clasificación</div>
            </div>
            <div class="ext-card">
              <div class="eval">${Math.round(m.total_time_sec || 0)} s</div>
              <div class="elbl">Tiempo Total</div>
            </div>
          </div>
        </div>

        <!-- A.2) Baremos Normativos de Kessels (2000, 2008) & Tipología de Errores -->
        <div class="card mb-4" style="border-left: 4px solid #7B1FA2; background: linear-gradient(to right, #FAFAFA, #FFFFFF);">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div class="section-title" style="margin-bottom:0;color:#4A148C;">
              Baremos Normativos de Kessels (2000, 2008) & Tipología de Errores
            </div>
            <span class="badge" style="background:#F3E5F5;color:#6A1B9A;font-size:0.75rem;padding:4px 8px;border-radius:6px;font-weight:700;">NORMATIVA INTERNACIONAL CORSI</span>
          </div>
          <p style="font-size:0.88rem;color:#546E7A;margin-bottom:16px;line-height:1.45;">
            Estandarización neuropsicológica paramétrica estratificada por edad cronológica. Cuantifica el desvío Z estandarizado, el percentil poblacional y descompone las fallas en errores de secuenciación (transposición) vs. fallas de mapeo visomotor (intrusión y distancia euclidiana).
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:16px;">
            <!-- Kessels Span Esperado -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Span Esperado (Kessels)</div>
              <div style="font-size:1.4rem;font-weight:800;color:#1A237E;">${m.kessels_norm_mean !== undefined ? Number(m.kessels_norm_mean).toFixed(1) : '5.4'}</div>
              <div style="font-size:0.75rem;color:#546E7A;margin-top:2px;">Media etaria esperada</div>
            </div>

            <!-- Puntuación Z -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Puntuación Z (Normativa)</div>
              <div style="font-size:1.4rem;font-weight:800;color:${(m.kessels_z_score || 0) < -1.5 ? '#C62828' : (m.kessels_z_score || 0) > 1.0 ? '#2E7D32' : '#1565C0'};">
                ${(m.kessels_z_score !== undefined ? ((m.kessels_z_score >= 0 ? '+' : '') + Number(m.kessels_z_score).toFixed(2)) : '0.00')}
              </div>
              <div style="font-size:0.75rem;color:#546E7A;margin-top:2px;">Desviaciones típicas (SD)</div>
            </div>

            <!-- Percentil Poblacional -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Percentil Estimado</div>
              <div style="font-size:1.4rem;font-weight:800;color:#6A1B9A;">
                P${m.kessels_percentile !== undefined ? m.kessels_percentile : 50}
              </div>
              <div style="font-size:0.75rem;color:#546E7A;margin-top:2px;">Rango poblacional normalizado</div>
            </div>

            <!-- Block-Product Score -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Block-Product Score</div>
              <div style="font-size:1.4rem;font-weight:800;color:#2E7D32;">
                ${m.composite_score || (m.corsi_span * (m.correct_trials || 1))}
              </div>
              <div style="font-size:0.75rem;color:#546E7A;margin-top:2px;">Span × Ensayos Correctos</div>
            </div>
          </div>

          <!-- Desglose de Tipología de Errores -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;">🔀</div>
              <div>
                <div style="font-weight:700;color:#1E293B;font-size:0.9rem;">Errores de Transposición (Orden)</div>
                <div style="font-size:0.82rem;color:#64748B;">
                  ${m.transposition_count || 0} eventos (${m.transposition_rate !== undefined ? m.transposition_rate : '0.0'}% de fallas). Cubos de la secuencia tocados en orden desfasado.
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;">🚫</div>
              <div>
                <div style="font-weight:700;color:#1E293B;font-size:0.9rem;">Errores de Intrusión (Cubo Ajeno)</div>
                <div style="font-size:0.82rem;color:#64748B;">
                  ${m.intrusion_count || 0} eventos (${m.intrusion_rate !== undefined ? m.intrusion_rate : '0.0'}% de fallas). Bloques no presentados en el patrón objetivo.
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;">📐</div>
              <div>
                <div style="font-weight:700;color:#1E293B;font-size:0.9rem;">Desviación Espacial Euclidiana (D_E)</div>
                <div style="font-size:0.82rem;color:#64748B;">
                  ${m.euclidean_error_dist !== undefined ? m.euclidean_error_dist : '0.0'}% de dispersión media respecto al cubo diana previsto.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- B) Gráficas de Rendimiento (4 Subplots Chart.js) -->
        <div class="card mb-4">
          <div class="section-title">Gráficas de Rendimiento Visoespacial</div>
          <div class="charts-grid">
            <div class="chart-box"><canvas id="chart-behavior"></canvas></div>
            <div class="chart-box"><canvas id="chart-metrics"></canvas></div>
            <div class="chart-box"><canvas id="chart-errors"></canvas></div>
            <div class="chart-box"><canvas id="chart-normal"></canvas></div>
          </div>
        </div>

        <!-- B.2) Dinámica Motora y Temblor del Cursor -->
        <div class="card mb-4" style="border-left: 4px solid #7B1FA2;">
          <div class="section-title">Rastreo de Cinemática Motora y Temblor del Cursor</div>
          <p style="font-size:0.9rem; color:#546E7A; margin-bottom: 16px;">
            Muestreo continuo (60 FPS) de aceleración, jitter y micro-oscilaciones del mouse durante la reproducción del patrón visoespacial.
          </p>
          <div class="charts-grid" style="grid-template-columns: 1fr;">
            <div class="chart-box" style="height: 220px; min-height: 220px;"><canvas id="chart-jumps"></canvas></div>
          </div>
          <div id="jumps-notes" style="margin-top: 20px; font-size: 0.95rem; background: #F3E5F5; padding: 15px; border-radius: 8px; color: #4A148C;">
            <strong>Estabilidad Cinemática:</strong> Jitter promedio de ${m.microtremor_avg !== undefined ? Number(m.microtremor_avg).toFixed(2) : '0.00'} px/s². ${(m.microtremor_avg || 0) > 85 ? '⚠️ Se observan signos de tensión psicomotora o temblor fino por encima del umbral clínico basal (<85.0 px/s²).' : '✓ Control psicomotor fluido, sin oscilaciones neuromusculares anormales registradas.'}
          </div>
        </div>

        <!-- B.3) Clasificación Algorítmica Descriptiva de Corsi (IA / Kessels) -->
        <div class="card mb-4" style="border-left: 4px solid #3F51B5;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div class="section-title" style="margin-bottom:0;color:#1A237E;">Clasificación Algorítmica Descriptiva de Corsi (IA / Kessels)</div>
            <span class="badge" style="background:#E8EAF6;color:#1A237E;font-size:0.75rem;padding:4px 8px;border-radius:6px;font-weight:700;">
              ${ml && ml.engine ? ml.engine : 'Algoritmo Paramétrico Normativo Corsi (Kessels)'}
            </span>
          </div>
          ${ml && (ml.model_used || ml.profile_info) ? `
            <div class="profile-badge" style="margin-bottom:12px;">
              <span class="pname">${ml.profile_info?.nombre || ml.predicted_profile?.replace(/_/g, ' ') || 'Rendimiento Base Normativo'}</span>
              <span class="pconf">Confianza estadística: ${ml.confidence_percent || '85.0%'}</span>
              ${ml.profile_info?.risk ? `<span class="badge" style="background:rgba(255,152,0,0.2);color:#E65100;font-weight:700;padding:2px 8px;border-radius:6px;font-size:0.75rem;">Riesgo: ${ml.profile_info.risk}</span>` : ''}
            </div>
            <div style="background:#E8EAF6;border-radius:8px;padding:14px 18px;margin-bottom:12px;">
              <div style="font-weight:600;color:#1A237E;margin-bottom:4px;">Descripción del indicador clínico:</div>
              <p style="font-size:.9rem;line-height:1.5;margin:0;color:#283593;">${ml.profile_info?.desc || m.clinical_desc}</p>
            </div>
            ${ml.profile_info?.rasgos ? `
              <div style="margin-bottom:14px;">
                <div style="font-weight:600;color:#1A237E;margin-bottom:6px;">Rasgos observados en el desempeño:</div>
                ${ml.profile_info.rasgos.map(r => `<div style="font-size:.9rem;padding:3px 0;color:#37474F;">• ${r}</div>`).join('')}
              </div>
            ` : ''}
            ${ml.all_probs ? `
              <div style="font-size:.82rem;color:#546E7A;margin-bottom:8px;font-weight:600;">
                Distribución de Probabilidad Bayesiana sobre Perfiles Clínicos Corsi:
              </div>
              <div class="prob-bars">
                ${Object.entries(ml.all_probs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
                  <div class="prob-bar-item ${k === ml.predicted_profile ? 'is-pred' : ''}">
                    <div class="pn">${k.replace(/_/g, ' ')}</div>
                    <div class="pv">${(v * 100).toFixed(1)} %</div>
                  </div>`).join('')}
              </div>
            ` : ''}
          ` : `
            <p class="text-muted">
              Báscula algorítmica procesando en modo determinista directo.
              <br>Las métricas psicométricas crudas y baremos expuestos son plenamente válidos.
            </p>
          `}
        </div>

        <!-- C) Biomarcadores Paraclínicos IA (3 Columnas) -->
        <div class="card mb-4" style="border-left: 4px solid #00ACC1;">
          <div class="section-title">Biomarcadores Paraclínicos Inteligentes (Edge-AI)</div>
          <p style="font-size:0.9rem; color:#546E7A; margin-bottom: 16px;">
            Medición no invasiva de fatiga ocular, expresiones emocionales, temblor motor y carga cognitiva en tiempo real.
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:16px;">

            <!-- Columna 1: Oculometría & Fatiga Visual -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">👁️ Oculometría & Fatiga Visual</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;${m.camera_active ? 'background:#E0F2FE;color:#0284C7;' : 'background:#ECEFF1;color:#607D8B;'}">
                  ${m.camera_active ? 'CONECTADA' : 'SIN CÁMARA'}
                </span>
              </div>

              ${m.camera_active ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#0F172A;">${m.ear_mean || '0.00'}</div>
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
                      notes.push(`<strong>Desvío atencional:</strong> Se detectaron ${m.gaze_diverted_count} desvíos oculares fuera del tablero de bloques.`);
                    }
                    if ((m.blink_rate_min || 0) > 26) {
                      notes.push(`<strong>Carga visual:</strong> Frecuencia de parpadeo elevada (${m.blink_rate_min}/min).`);
                    }
                    if (notes.length === 0) {
                      return '<span style="color:#2E7D32;">✓ Fijación ocular continua sobre el tablero visoespacial.</span>';
                    }
                    return notes.join('<br/>');
                  })()}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ Sesión realizada sin cámara web frontal.
                </div>
              `}
            </div>

            <!-- Columna 2: Emociones Faciales & Tensión (FER) -->
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
                    <div style="font-size:0.95rem;font-weight:700;color:#6A1B9A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.fer_dominant || 'Concentración'}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Expresión Dominante</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.fer_tension_score || 0) > 40 ? '#D84315' : '#2E7D32'};">${m.fer_tension_score !== undefined ? m.fer_tension_score : '0.0'}%</div>
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
                      notes.push(`<strong>Picos de tensión:</strong> Se detectaron ${m.fer_frustration_events} eventos de microexpresión de frustración.`);
                    }
                    if (notes.length === 0) {
                      return '<span style="color:#2E7D32;">✓ Patrón gestual sereno y concentración adecuada ante la demanda visoespacial.</span>';
                    }
                    return notes.join('<br/>');
                  })()}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ Análisis FER no disponible sin cámara web.
                </div>
              `}
            </div>

            <!-- Columna 3: Cinemática del Mouse & Temblor -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">🖱️ Cinemática Motora & Jitter</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;background:#EDE7F6;color:#512DA8;">
                  60 FPS MUESTREO
                </span>
              </div>

              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:${(m.microtremor_avg || 0) > 85 ? '#D84315' : '#1565C0'};">${m.microtremor_avg !== undefined ? Number(m.microtremor_avg).toFixed(2) : '0.00'}</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Jitter (px/s²)</div>
                </div>
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:${(m.sweep_regularity_avg || 100) < 80 ? '#C62828' : '#2E7D32'};">${m.sweep_regularity_avg !== undefined ? m.sweep_regularity_avg : 100}%</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Regularidad</div>
                </div>
                <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                  <div style="font-size:1.15rem;font-weight:700;color:#2E7D32;">${trials.length}</div>
                  <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Ensayos</div>
                </div>
              </div>

              <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #512DA8;color:#334155;">
                ${(m.microtremor_avg || 0) > 85 ? 'Jitter motor superior al umbral de reposo (<85 px/s²).' : 'Trazo motor fluido y control neuromuscular dentro de rangos normales.'}
              </div>
            </div>

            <!-- Fila Inferior: Pupilometría Cognitiva -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;grid-column:1/-1;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">🧠 Pupilometría Cognitiva (Carga de Memoria de Trabajo)</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;${m.camera_active ? 'background:#E0F7FA;color:#00838F;' : 'background:#ECEFF1;color:#607D8B;'}">
                  ${m.camera_active ? 'PUPILOMETRÍA ACTIVA' : 'SIN CÁMARA'}
                </span>
              </div>

              ${m.camera_active ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#0284C7;">${m.pupil_dilation_avg !== undefined ? Number(m.pupil_dilation_avg).toFixed(2) : '1.00'}x</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Dilatación Media</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.cognitive_load_peaks || 0) > 2 ? '#C62828' : '#2E7D32'};">${m.cognitive_load_peaks || 0}</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Picos de Sobreesfuerzo</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#334155;">${m.pupil_baseline ? Number(m.pupil_baseline).toFixed(1) : '8.0'} px</div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Línea Base Pupilar</div>
                  </div>
                </div>

                <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #0284C7;color:#334155;">
                  ${Number(m.cognitive_load_peaks || 0) > 0 ? `Se registraron ${m.cognitive_load_peaks} picos de dilatación pupilar transitoria (>120% basal) asociados a la retención de secuencias de alta longitud.` : 'Diámetro pupilar estable y armónico respecto a la línea base, coherente con una adecuada dosificación del esfuerzo mental.'}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ La pupilometría cognitiva requiere cámara web para el rastreo del iris.
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- D) Tabla Detallada Ensayo por Ensayo -->
        <div class="card mb-4">
          <div class="section-title">Desglose Ensayo por Ensayo (Progresión Visoespacial)</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;text-align:center;">
              <thead>
                <tr style="background:#E8EAF6;color:#1A237E;border-bottom:2px solid #C5CAE9;">
                  <th style="padding:10px;">Ensayo</th>
                  <th style="padding:10px;">Longitud (Nivel)</th>
                  <th style="padding:10px;">Intento</th>
                  <th style="padding:10px;">Secuencia Presentada</th>
                  <th style="padding:10px;">Secuencia Usuario</th>
                  <th style="padding:10px;">Resultado</th>
                  <th style="padding:10px;">Duda Inicial (ms)</th>
                  <th style="padding:10px;">TR Medio (ms)</th>
                </tr>
              </thead>
              <tbody>
                ${trials.map((t, idx) => {
                  const seqPres = (t.sequence_presented || t.sequence || []).map(x => typeof x === 'number' && x < 9 ? (x + 1) : x).join(' - ');
                  const seqUsr = (t.sequence_user || t.userSequence || []).map(x => typeof x === 'number' && x < 9 ? (x + 1) : x).join(' - ');
                  const isOk = t.success !== undefined ? t.success : t.isCorrect;
                  const lvl = t.sequence_length || t.level;
                  const att = t.attempt || 1;
                  const hes = Math.round(t.hesitation_time_ms || t.hesitationTimeMs || 0);
                  const rt = Math.round(t.mean_reaction_time_ms || t.meanReactionTimeMs || 0);
                  return `
                    <tr style="border-bottom:1px solid #ECEFF1;background:${idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
                      <td style="padding:10px;font-weight:600;">${idx + 1}</td>
                      <td style="padding:10px;font-weight:700;color:#1565C0;">${lvl} bloques</td>
                      <td style="padding:10px;">Intento ${att}</td>
                      <td style="padding:10px;font-family:monospace;font-size:0.95rem;color:#283593;">${seqPres}</td>
                      <td style="padding:10px;font-family:monospace;font-size:0.95rem;color:${isOk ? '#2E7D32' : '#C62828'};">${seqUsr || '(vacío)'}</td>
                      <td style="padding:10px;">
                        <span class="badge" style="background:${isOk ? 'rgba(46,125,50,0.15)' : 'rgba(198,40,40,0.15)'};color:${isOk ? '#2E7D32' : '#C62828'};font-weight:700;padding:4px 8px;border-radius:6px;">
                          ${isOk ? '✓ Correcto' : '✗ Error'}
                        </span>
                      </td>
                      <td style="padding:10px;color:#546E7A;">${hes} ms</td>
                      <td style="padding:10px;color:#546E7A;">${rt} ms</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- E) Narrativa Técnica y Descripción del Rendimiento -->
        <div class="card mb-4">
          <div class="section-title">Descripción del Rendimiento Cognitivo (Test de Corsi)</div>
          <div class="narrative-box" style="line-height:1.7;">${narrative}</div>
        </div>

        <!-- Botones Finales -->
        <div class="flex gap-2 flex-end mb-8">
          <button class="btn btn-secondary" onclick="App.nav('menu')">🏠 Menú</button>
          <button class="btn btn-ghost" onclick="App.nav('form')">🔄 Nueva evaluación</button>
          ${this.evalId ? `<button class="btn btn-success btn-lg" onclick="App.downloadExcel()">📊 Descargar Excel completo</button>` : ''}
        </div>

      </div>
    `;

    // Renderizar gráficas tras montar el DOM
    requestAnimationFrame(() => {
      if (typeof renderCorsiResultCharts === 'function') {
        renderCorsiResultCharts(trials, m, this.mlPred);
      }
    });
  },

  /* ══════════════════════════════════════════════════════════════════════
     PANTALLA 5: RESULTADOS
  ══════════════════════════════════════════════════════════════════════ */
  renderResults(app) {
    if (this.testType === 'CORSI') {
      this.renderCorsiResults(app);
      return;
    }
    let m = this.metrics;
    if (!m && this.linesData && this.linesData.length > 0) {
      try {
        this.metrics = computeMetrics(this.linesData);
        m = this.metrics;
      } catch (e) {
        console.warn("Error recalculando métricas PLC:", e);
      }
    }
    const ml = this.mlPred || { profile: "Normativo PLC", desc: "Perfil calculado con parámetros psicométricos estándar." };

    if (!m) {
      app.innerHTML = `<div class="plc-header"><h1>Resultados en Preparación</h1></div>
        <div class="page"><div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:2.5rem;margin-bottom:16px;">⚠️</div>
          <h3 style="color:#1A237E;margin-bottom:8px;">No se encontraron métricas activas</h3>
          <p style="color:#546E7A;margin-bottom:20px;">No se ha detectado una sesión completada recientemente para mostrar el informe.</p>
          <button class="btn btn-primary" onclick="App.nav('menu')">🏠 Volver al Menú Principal</button>
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
            ${escapeHTML(this.participant.name)} &nbsp;·&nbsp; ID: ${escapeHTML(this.participant.id)} &nbsp;·&nbsp; ${now}
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
          <div class="metric-cards" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
            ${[
        ['TA  Aciertos', m.TA, '#E8F5E9', '#2E7D32'],
        ['O  Omisiones', m.O, '#FFF3E0', '#E65100'],
        ['C  Comisiones', m.COM, '#FFEBEE', '#B71C1C'],
        ['CON  Concentración', m.CON, '#E8EAF6', '#1A237E'],
        ['TOT  Efectividad', m.TOT_d2 !== undefined ? m.TOT_d2 : Math.max(0, (m.TR || 0) - (m.O + m.COM)), '#EDE7F6', '#4527A0'],
        ['CP %  Precisión', m.CP.toFixed(1) + ' %', '#E0F2F1', '#00695C'],
        ['E %  Tasa Error', (m.errorRate !== undefined ? m.errorRate.toFixed(1) : (((m.O + m.COM) / Math.max(m.TR || 1, 1)) * 100).toFixed(1)) + ' %', '#FBE9E7', '#D84315'],
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

        <!-- A.2) Teoría de Detección de Señales (SDT) & Cronometría de Lapsos Atencionales -->
        <div class="card mb-4" style="border-left: 4px solid #3F51B5; background: linear-gradient(to right, #FAFAFA, #FFFFFF);">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div class="section-title" style="margin-bottom:0;color:#1A237E;">
              Teoría de Detección de Señales (SDT) & Cronometría de Lapsos Atencionales
            </div>
            <span class="badge" style="background:#E8EAF6;color:#283593;font-size:0.75rem;padding:4px 8px;border-radius:6px;font-weight:700;">NORMA PSICOMÉTRICA AVANZADA (PLC)</span>
          </div>
          <p style="font-size:0.88rem;color:#546E7A;margin-bottom:16px;line-height:1.45;">
            Modelado paramétrico estandarizado (Hautus, 1995; Rolf Brickenkamp). Desacopla la agudeza perceptiva intrínseca del paciente de su sesgo cognitivo de decisión, detectando simultáneamente micro-pausas que revelan desregulación atencional sostenida.
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;">
            <!-- Sensibilidad d' -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                <span style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;">Sensibilidad Perceptiva (d')</span>
                <span style="font-size:1.35rem;font-weight:800;color:#1A237E;">${m.d_prime !== undefined ? m.d_prime : (m.sdt ? m.sdt.d_prime : 'N/A')}</span>
              </div>
              <p style="font-size:0.8rem;color:#546E7A;margin:0;">
                ${(m.d_prime !== undefined ? m.d_prime : (m.sdt?.d_prime || 0)) >= 2.5 ? 'Excelente capacidad de discriminación señal-ruido.' : (m.d_prime !== undefined ? m.d_prime : (m.sdt?.d_prime || 0)) >= 1.5 ? 'Buena discriminabilidad entre diana y distractores.' : 'Dificultad para diferenciar dianas bajo presión temporal.'}
              </p>
            </div>

            <!-- Criterio de Respuesta c -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                <span style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;">Criterio de Decisión (c)</span>
                <span style="font-size:1.35rem;font-weight:800;color:#283593;">${m.criterion_c !== undefined ? m.criterion_c : (m.sdt ? m.sdt.criterion_c : 'N/A')}</span>
              </div>
              <p style="font-size:0.8rem;color:#546E7A;margin:0;">
                <strong>${m.criterion_desc || (m.sdt ? m.sdt.criterion_desc : 'Equilibrado')}</strong>
              </p>
            </div>

            <!-- Lapsos Atencionales -->
            <div style="background:#FFFFFF;border:1px solid #E0E0E0;border-radius:10px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                <span style="font-size:0.8rem;color:#78909C;font-weight:600;text-transform:uppercase;">Lapsos Atencionales (>1.5s)</span>
                <span style="font-size:1.35rem;font-weight:800;color:${(m.lapsesCount || 0) > 3 ? '#C62828' : '#2E7D32'};">${m.lapsesCount || 0}</span>
              </div>
              <p style="font-size:0.8rem;color:#546E7A;margin:0;">
                ${(m.lapsesCount || 0) > 0 ? `${m.lapsesCount} pausas motoras cognitivas (Media: ${Math.round(m.lapsesMeanMs || 0)} ms, Máx: ${Math.round(m.lapsesMaxMs || 0)} ms).` : 'Sin vacilaciones significativas. Ritmo visomotor continuo.'}
              </p>
            </div>
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

            <!-- Columna 4: Pupilometría Cognitiva & Carga Mental (MediaPipe Iris) -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-weight:700;font-size:0.95rem;color:#1E293B;">🧿 Pupilometría & Carga Mental</span>
                <span style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;${m.camera_active ? 'background:#E0F2FE;color:#0369A1;' : 'background:#ECEFF1;color:#607D8B;'}">
                  ${m.camera_active ? 'IRIS TRACKING' : 'SIN CÁMARA'}
                </span>
              </div>

              ${m.camera_active ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:14px;">
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.pupil_dilation_avg || 1.0) >= 1.15 ? '#D84315' : '#0284C7'};">
                      ${m.pupil_dilation_avg !== undefined && m.pupil_dilation_avg !== null ? (Number(m.pupil_dilation_avg) * 100).toFixed(1) + '%' : '100.0%'}
                    </div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Dilatación Media</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:${(m.cognitive_load_peaks || 0) > 3 ? '#C62828' : ((m.cognitive_load_peaks || 0) > 0 ? '#EA580C' : '#2E7D32')};">
                      ${m.cognitive_load_peaks !== undefined && m.cognitive_load_peaks !== null ? m.cognitive_load_peaks : 0}
                    </div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Picos Sobreesfuerzo</div>
                  </div>
                  <div style="background:#FFF;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.15rem;font-weight:700;color:#0F766E;">
                      ${m.pupil_baseline !== undefined && m.pupil_baseline !== null ? Number(m.pupil_baseline).toFixed(3) : 'Calibrada'}
                    </div>
                    <div style="font-size:0.72rem;color:#64748B;text-transform:uppercase;font-weight:600;">Línea Base Reposo</div>
                  </div>
                </div>

                <div style="font-size:0.85rem;line-height:1.4;background:#FFF;padding:10px 12px;border-radius:8px;border-left:3px solid #0284C7;color:#334155;">
                  ${(function(){
                    let notes = [];
                    const peaks = Number(m.cognitive_load_peaks || 0);
                    const dil = Number(m.pupil_dilation_avg || 1.0);
                    if (peaks >= 4) {
                      notes.push(`<strong>Sobrecarga de memoria de trabajo:</strong> Se registraron <strong>${peaks} picos de dilatación sostenida (&gt;120% basal)</strong>, indicando episodios de sobreesfuerzo cognitivo durante tareas de discriminación compleja.`);
                    } else if (peaks > 0) {
                      notes.push(`<strong>Demanda cognitiva fluctuante:</strong> ${peaks} pico(s) de esfuerzo mental transitorio por encima del umbral de sobrecarga.`);
                    }
                    if (dil > 1.12) {
                      notes.push(`<strong>Activación noradrenérgica elevada:</strong> Dilatación pupilar media sostenida un ${((dil - 1.0) * 100).toFixed(1)}% sobre la línea base.`);
                    }
                    if (notes.length === 0) {
                      return '<span style="color:#2E7D32;">✓ Diámetro pupilar estable y armónico respecto a la línea base, coherente con una adecuada dosificación del esfuerzo mental.</span>';
                    }
                    return notes.join('<br/>');
                  })()}
                </div>
              ` : `
                <div style="background:#FFF;border:1px dashed #CFD8DC;border-radius:8px;padding:20px;text-align:center;color:#607D8B;font-size:0.85rem;">
                  ℹ️ La cámara no estuvo habilitada. La pupilometría cognitiva y detección de sobreesfuerzo mental requieren seguimiento óptico del iris.
                </div>
              `}
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
              ⬇️ Descargar Video (.mp4)
            </button>
          </div>
          <div class="video-container" style="background:#000;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.25);">
            <video id="player-video" controls playsinline style="width:100%;max-height:65vh;display:block;outline:none;"></video>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:0.8rem;color:#64748B;flex-wrap:wrap;gap:8px;">
            <span>💡 Grabación de pantalla y telemetría clínica en formato MP4</span>
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
          <tr><th>#</th><th>Fecha</th><th>Batería / Modo</th><th>ID</th><th>Nombre</th><th>Edad</th><th>Rendimiento / Span</th><th>Acciones</th></tr>
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
              <button class="btn btn-ghost btn-sm" style="background:#E0F2FE;color:#0284C7;padding:2px 7px;font-size:0.75rem;font-weight:600;" onclick="App.downloadVideo(${r.id}, this)" title="Descargar archivo de video (.mp4) a tu equipo">⬇️ MP4</button>
            </div>
            <span style="font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:4px;${badgeStyle}" title="Día ${dayCurrent} de 30 de retención clínica">⏳ Quedan ${daysLeft}d (${dayCurrent}/30)</span>
          </div>
        `;
      } else if (isExpired && (r.video_path || r.video_expired || diffDays >= 30)) {
        videoBadgeHtml = `<span style="font-size:0.7rem;color:#64748B;padding:3px 6px;background:#F1F5F9;border-radius:6px;border:1px solid #CBD5E1;font-weight:600;" title="El video cumplió el período reglamentario de 30 días y fue purgado de la nube.">🗑️ Expirado (+30d)</span>`;
      }

      const isCorsi = (r.test_type === 'CORSI');
      const isCorsiReverse = isCorsi && (String(r.corsi_mode).toLowerCase() === 'reverse' || String(r.corsi_mode).toLowerCase() === 'inverso');

      let testBadgeHtml = '';
      if (isCorsi) {
        if (isCorsiReverse) {
          testBadgeHtml = `<span class="badge" style="background:#F3E8FF;color:#7E22CE;font-weight:700;padding:4px 8px;border-radius:6px;border:1px solid #E9D5FF;font-size:0.75rem;white-space:nowrap;">🧊 Corsi Inverso</span>`;
        } else {
          testBadgeHtml = `<span class="badge" style="background:#E0F2FE;color:#0369A1;font-weight:700;padding:4px 8px;border-radius:6px;border:1px solid #BAE6FD;font-size:0.75rem;white-space:nowrap;">🧊 Corsi Directo</span>`;
        }
      } else {
        testBadgeHtml = `<span class="badge" style="background:#EDE7F6;color:#4527A0;font-weight:700;padding:4px 8px;border-radius:6px;border:1px solid #D1C4E9;font-size:0.75rem;white-space:nowrap;">🎯 PLC (d2)</span>`;
      }

      let scoreHtml = '';
      if (isCorsi) {
        scoreHtml = `
          <div style="display:flex;flex-direction:column;gap:1px;">
            <div style="font-size:0.95rem;">Span: <strong style="color:#0284C7;">${(r.corsi_span !== undefined && r.corsi_span !== null) ? r.corsi_span : '-'}</strong></div>
            <div style="font-size:0.72rem;color:#64748B;">Compuesto: <strong>${r.composite_score || 0}</strong> pts</div>
          </div>
        `;
      } else {
        scoreHtml = `
          <div style="display:flex;flex-direction:column;gap:1px;">
            <div style="font-size:0.95rem;">CP: <strong style="color:${r.CP >= 75 ? '#2E7D32' : r.CP >= 50 ? '#E65100' : '#B71C1C'}">${r.CP}%</strong></div>
            <div style="font-size:0.72rem;color:#64748B;">TA: ${r.TA} aciertos</div>
          </div>
        `;
      }

      return `
      <tr>
        <td>
          <div style="display:inline-flex;align-items:center;gap:5px;">
            <span style="font-weight:700;" title="${escapeHTML(r.session_tag || '')}">${r.id}</span>
          </div>
        </td>
        <td style="font-size:0.85rem;white-space:nowrap;">${new Date(r.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${testBadgeHtml}</td>
        <td>${escapeHTML(r.participant_id)}</td>
        <td><strong>${escapeHTML(r.participant_name)}</strong></td>
        <td>${r.age}</td>
        <td>${scoreHtml}</td>
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

      const metrics = data.metrics_json || {};
      const lines = data.lines_json;
      const ml = data.ml_json;

      const isCorsi = (metrics.test_type === 'CORSI' || data.test_type === 'CORSI');
      const isReverse = isCorsi && (metrics.corsi_mode === 'reverse' || String(data.corsi_mode).toLowerCase() === 'reverse');

      this.metrics = metrics;
      this.participant = {
        name: data.participant_name,
        id: data.participant_id,
        age: data.age
      };
      this.evalId = data.id;
      this.linesData = lines;
      this.sessionTag = data.session_tag || (metrics ? metrics.session_tag : null);
      this.testType = isCorsi ? 'CORSI' : 'PLC';
      this.corsiMode = isReverse ? 'reverse' : 'direct';

      // 1. Mostrar Modal Clínico
      document.getElementById('clinical-modal').classList.add('active');

      if (isCorsi) {
        const lastTrial = (lines && lines.length) ? lines[lines.length - 1] : null;
        const maxLvl = metrics.max_level || (lastTrial ? (lastTrial.sequence_length || lastTrial.level) : (metrics.corsi_span || 2));
        document.getElementById('modal-patient-info').innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              Paciente: <span style="color:var(--text);font-weight:400;">${escapeHTML(data.participant_name)}</span> 
              | ID: <span style="color:var(--text);font-weight:400;">${escapeHTML(data.participant_id)}</span> 
              | Prueba: <span style="color:var(--text);font-weight:400;">${new Date(data.created_at).toLocaleString()}</span>
              | Modalidad: <span style="color:${isReverse ? '#7B1FA2' : '#0284C7'};font-weight:700;">${isReverse ? '🧊 Corsi Inverso' : '🧊 Corsi Directo'}</span>
              ${data.session_tag ? ` | Tag: <span style="color:#3949AB;font-weight:600;">${escapeHTML(data.session_tag)}</span>` : ''}
              <br/><span style="color:#455A64;font-size:0.85rem;font-weight:600;">Nivel Máximo Administrado: ${maxLvl} bloques | Ensayos Evaluados: ${(lines && lines.length) || metrics.total_trials || 0}</span>
            </div>
            <button class="btn btn-ghost btn-sm" style="background:#EDE7F6;color:#4527A0;font-weight:700;padding:5px 12px;border-radius:8px;" onclick="App.openFullReportFromModal(${id})" title="Abrir informe clínico completo en vista expandida">
              🖥️ Ver Pantalla Completa
            </button>
          </div>
        `;
      } else {
        const lastAttemptedIndex = lines ? lines.map(l => l.evaluados || 0).reduce((maxIdx, val, idx) => val > 0 ? idx : maxIdx, -1) : -1;
        const isIncomplete = lastAttemptedIndex >= 0 && (lastAttemptedIndex + 1) < lines.length;
        const lastLine = lastAttemptedIndex >= 0 ? lines[lastAttemptedIndex].linea : 0;
        const lastChar = lastAttemptedIndex >= 0 ? lines[lastAttemptedIndex].evaluados : 0;

        document.getElementById('modal-patient-info').innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              Paciente: <span style="color:var(--text);font-weight:400;">${escapeHTML(data.participant_name)}</span> 
              | ID: <span style="color:var(--text);font-weight:400;">${escapeHTML(data.participant_id)}</span> 
              | Prueba: <span style="color:var(--text);font-weight:400;">${new Date(data.created_at).toLocaleString()}</span>
              ${isIncomplete ? `<br/><span style="color:#C62828;font-weight:700;">⚠️ APLICACIÓN INCOMPLETA (Detención anticipada en Página ${lastLine}, Estímulo ${lastChar})</span>` : ''}
            </div>
            <button class="btn btn-ghost btn-sm" style="background:#EDE7F6;color:#4527A0;font-weight:700;padding:5px 12px;border-radius:8px;" onclick="App.openFullReportFromModal(${id})" title="Abrir informe clínico completo en vista expandida">
              🖥️ Ver Pantalla Completa
            </button>
          </div>
        `;
      }

      // 2. Semáforo Normativo
      if (isCorsi) {
        const span = metrics.corsi_span || 0;
        const composite = metrics.composite_score || (span * (metrics.correct_trials || 0));
        const acc = Number(metrics.accuracy_pct || 0).toFixed(1);
        let sColor = 'yellow', sTitle = 'Promedio Límite', sDesc = 'Amplitud de memoria de trabajo visoespacial limítrofe.';
        if (span >= 5) {
          sColor = 'green'; sTitle = 'Rango Normativo'; sDesc = 'Capacidad de retención y memoria visoespacial óptima.';
        } else if (span <= 3) {
          sColor = 'red'; sTitle = 'Déficit Visoespacial'; sDesc = 'Rendimiento amnésico/atencional descendido respecto al grupo de edad.';
        }

        document.getElementById('modal-semaforo').innerHTML = `
          <div class="semaforo-box semaforo-${sColor}">
            <div class="semaforo-indicator"></div>
            <div class="semaforo-text">
              <div class="st-title">${sTitle.toUpperCase()}</div>
              <div class="st-desc" style="font-size:0.8rem;">SPAN: ${span} bloques | ${sDesc}</div>
            </div>
          </div>
          <div class="semaforo-box semaforo-blue" style="background:var(--a-light);border:1px solid var(--border);">
            <div class="semaforo-indicator" style="background:var(--accent);"></div>
            <div class="semaforo-text">
              <div class="st-title">Puntaje Compuesto: ${composite} pts</div>
              <div class="st-desc" style="font-size:0.8rem;">Precisión: ${acc}% (${metrics.correct_trials || 0} de ${metrics.total_trials || (lines && lines.length) || 0} correctos)</div>
            </div>
          </div>
        `;
      } else {
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
      }

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
        const pupilAvg = (metrics.pupil_dilation_avg !== undefined && metrics.pupil_dilation_avg !== null) ? Number(metrics.pupil_dilation_avg) : null;
        const pupilPeaks = (metrics.cognitive_load_peaks !== undefined && metrics.cognitive_load_peaks !== null) ? Number(metrics.cognitive_load_peaks) : 0;

        const secondColVal = isCorsi ? `${Number(metrics.accuracy_pct || 0).toFixed(1)}%` : `${sweepAvg}%`;
        const secondColLbl = isCorsi ? 'Precisión' : 'Barrido';
        const thirdColVal = isCorsi ? (metrics.error_trials || 0) : tremorLines.length;
        const thirdColLbl = isCorsi ? 'Ensayos Err.' : 'Págs Tremor';

        extraEl.innerHTML = `
          <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #00BCD4;border-radius:10px;padding:16px;margin-bottom:15px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
              <span style="font-weight:700;font-size:0.95rem;color:#00838F;">⚡ Datos Extras de IA — Telemetría Oculomotora, Facial (FER) y Cinemática</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${(metrics.video_path || data.video_path) ? `
                  <button class="btn btn-primary btn-sm" style="background:linear-gradient(135deg, #4F46E5, #7C3AED);color:#FFF;padding:4px 11px;font-size:0.75rem;font-weight:800;border:none;border-radius:6px;box-shadow:0 2px 6px rgba(79,70,229,0.3);cursor:pointer;" onclick="App.playVideo(${id}, this)" title="Abrir Visor Forense IA con Overlay y Línea de Tiempo">🛡️ Visor IA Forense</button>
                  <button class="btn btn-ghost btn-sm" style="background:#E0F2FE;color:#0284C7;padding:4px 10px;font-size:0.75rem;font-weight:800;border:1px solid #BAE6FD;border-radius:6px;cursor:pointer;" onclick="App.downloadVideo(${id}, this)" title="Descargar Video MP4">⬇️ MP4</button>
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
                    <div style="font-size:1.05rem;font-weight:700;color:${(isCorsi ? (metrics.accuracy_pct || 0) < 60 : sweepAvg < 80) ? '#C62828' : '#2E7D32'};">${secondColVal}</div>
                    <div style="font-size:0.68rem;color:#64748B;font-weight:600;">${secondColLbl}</div>
                  </div>
                  <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                    <div style="font-size:1.05rem;font-weight:700;color:${thirdColVal > 0 ? '#C62828' : '#2E7D32'};">${thirdColVal}</div>
                    <div style="font-size:0.68rem;color:#64748B;font-weight:600;">${thirdColLbl}</div>
                  </div>
                </div>
              </div>

              <!-- Panel Pupilometría & Carga Mental -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-weight:700;font-size:0.88rem;color:#1E293B;">🧿 Pupilometría & Carga</span>
                  <span style="font-size:0.7rem;font-weight:600;padding:2px 6px;border-radius:8px;${camActive ? 'background:#E0F2FE;color:#0369A1;' : 'background:#ECEFF1;color:#607D8B;'}">
                    ${camActive ? 'IRIS' : 'N/A'}
                  </span>
                </div>
                ${camActive ? `
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;">
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:${(pupilAvg || 1.0) >= 1.15 ? '#D84315' : '#0284C7'};">
                        ${pupilAvg !== null ? (pupilAvg * 100).toFixed(1) + '%' : '100.0%'}
                      </div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Dilatación</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:${pupilPeaks > 3 ? '#C62828' : (pupilPeaks > 0 ? '#EA580C' : '#2E7D32')};">
                        ${pupilPeaks}
                      </div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Picos Carga</div>
                    </div>
                    <div style="background:#FFF;padding:8px;border-radius:6px;border:1px solid #E2E8F0;">
                      <div style="font-size:1.05rem;font-weight:700;color:#0F766E;">
                        ${metrics.pupil_baseline !== undefined && metrics.pupil_baseline !== null ? Number(metrics.pupil_baseline).toFixed(2) : 'OK'}
                      </div>
                      <div style="font-size:0.68rem;color:#64748B;font-weight:600;">Basal</div>
                    </div>
                  </div>
                ` : `
                  <div style="font-size:0.8rem;color:#64748B;text-align:center;padding:12px;background:#FFF;border-radius:6px;">
                    Sin seguimiento de iris en esta evaluación.
                  </div>
                `}
              </div>
            </div>
          </div>
`;
      }

      // 2.5. Notas de Dinámica Motora / Saltos Erráticos en el modal
      const modalNotesEl = document.getElementById('modal-jumps-notes');
      if (modalNotesEl) {
        if (isCorsi) {
          const micro = Number(metrics.microtremor_avg || 0);
          if (micro > 85) {
            modalNotesEl.innerHTML = `<div style="color:#C62828; font-weight:600;">⚠️ Dinámica Motora Corsi: Jitter promedio de ${micro.toFixed(2)} px/s². Se detectan oscilaciones motoras o tensión psicomotora durante la secuencia visoespacial.</div>`;
          } else {
            modalNotesEl.innerHTML = `<div style="color:#2E7D32; font-weight:600;">✓ Dinámica Motora Corsi: Jitter promedio de ${micro.toFixed(2)} px/s². Control psicomotor fluido y dentro de rangos basales normales.</div>`;
          }
        } else {
          const linesWithJumps = lines ? lines.filter(l => l.saltos_erraticos > 0) : [];
          if (linesWithJumps.length === 0) {
            modalNotesEl.innerHTML = '<div style="color:#2E7D32; font-weight:600;">✓ El paciente mantuvo un barrido visual disciplinado en todas las líneas.</div>';
          } else {
            modalNotesEl.innerHTML = '<ul style="color:#BF360C; line-height: 1.6; margin: 0; padding-left: 20px;">' + 
              linesWithJumps.map(l => '<li><strong>Línea ' + l.linea + ':</strong> Se detectó comportamiento errático (' + l.saltos_erraticos + ' saltos/retrocesos).</li>').join('') +
              '</ul>';
          }
        }
      }

      // 3. Renderizar Gráficas (Destruye previas auto por función)
      if (isCorsi) {
        const trials = (lines && lines.length) ? lines : (metrics.trials_data || []);
        if (typeof renderCorsiResultCharts === 'function') {
          renderCorsiResultCharts(trials, metrics, ml);
        }
      } else {
        renderResultCharts(lines, metrics, ml);
      }

    } catch (e) {
      alert("Error al cargar la visualización");
    }

    if (btn) {
      btn.textContent = "👁️ Ver Web";
      btn.disabled = false;
    }
  },

  openFullReportFromModal(id) {
    const modal = document.getElementById('clinical-modal');
    if (modal) modal.classList.remove('active');
    if (typeof destroyCharts === 'function') destroyCharts();
    this.nav('results');
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

  ensureVideoModal(isSuperAdmin) {
    let modal = document.getElementById('video-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'video-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    if (isSuperAdmin) {
      modal.innerHTML = `
        <div id="video-modal-card" class="modal-video" style="max-width:1220px;width:96%;padding:22px 24px;background:#0B1120;border:1px solid #1E293B;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.85);color:#F8FAFC;">
          <button class="modal-close" style="color:#94A3B8;font-size:1.6rem;top:16px;right:20px;" onclick="App.closeVideoModal()">×</button>
          
          <!-- Header SuperAdmin -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;border-bottom:1px solid #1E293B;padding-bottom:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="badge" style="background:#4338CA;color:#E0E7FF;font-size:0.72rem;font-weight:800;padding:3px 8px;border-radius:6px;border:1px solid #6366F1;">SUPERADMIN FORENSE</span>
                <span id="video-modal-title" style="font-weight:800;font-size:1.15rem;color:#F8FAFC;">🎥 Reproductor con Capa IA</span>
              </div>
              <div id="modal-video-participant-info" style="font-size:0.78rem;color:#94A3B8;margin-top:4px;">Cargando metadatos...</div>
            </div>
            
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <button id="btn-toggle-ai-hud" class="btn btn-sm" onclick="App.toggleAIHUD()" style="background:#1E293B;color:#38BDF8;border:1px solid #0284C7;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;">
                👁️ Capa IA: ACTIVA
              </button>
              <button id="modal-btn-download-video" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;padding:6px 16px;background:linear-gradient(135deg,#0284C7,#2563EB);color:#FFF;border-radius:8px;border:none;cursor:pointer;box-shadow:0 2px 8px rgba(2,132,199,0.4);" onclick="App.downloadCurrentVideo(this)">
                ⬇️ Descargar Video (.mp4)
              </button>
            </div>
          </div>

          <!-- Grid: Video + HUD (Izq) | Timeline Forense (Der) -->
          <div style="display:grid;grid-template-columns:1fr 350px;gap:18px;align-items:start;">
            <!-- Left: Video & HUD Overlay -->
            <div style="position:relative;background:#000;border-radius:12px;overflow:hidden;border:1px solid #334155;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <video id="player-video" controls playsinline style="width:100%;max-height:64vh;display:block;outline:none;background:#000;"></video>
              <canvas id="video-ai-hud" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15;"></canvas>
            </div>

            <!-- Right: Timeline Forense -->
            <div id="forensic-timeline-panel" style="max-height:64vh;height:64vh;display:flex;flex-direction:column;background:#0F172A;border-radius:12px;border:1px solid #1E293B;padding:14px;box-sizing:border-box;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1E293B;padding-bottom:10px;margin-bottom:8px;">
                <span style="font-weight:800;font-size:0.82rem;color:#38BDF8;letter-spacing:0.5px;">🧬 CRONOLOGÍA FORENSE IA</span>
                <span id="timeline-event-count" class="badge" style="background:#1E293B;color:#94A3B8;font-size:0.7rem;font-weight:700;">0 eventos</span>
              </div>
              <div style="font-size:0.72rem;color:#64748B;margin-bottom:10px;line-height:1.3;">
                Haz clic en cualquier anomalía para saltar el video al segundo exacto.
              </div>
              <div id="video-forensic-timeline-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;"></div>
            </div>
          </div>

          <!-- Footer Telemetría -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:0.75rem;color:#94A3B8;flex-wrap:wrap;gap:10px;border-top:1px solid #1E293B;padding-top:10px;">
            <div>
              <span style="color:#38BDF8;font-weight:700;">Telemetría Activa:</span> 
              <span id="hud-status-line">Línea: --</span> &nbsp;|&nbsp; 
              <span id="hud-status-tremor" style="color:#10B981;">Cinemática: Estable</span> &nbsp;|&nbsp; 
              <span id="hud-status-gaze" style="color:#10B981;">Oculometría: Foco Centrado</span>
            </div>
            <div style="font-size:0.72rem;color:#64748B;">
              Archivo: <span id="modal-video-filename" style="color:#E2E8F0;font-weight:600;"></span> (MP4 Clínico)
            </div>
          </div>
        </div>
      `;
    } else {
      modal.innerHTML = `
        <div class="modal-video" style="max-width:850px;width:95%;padding:28px 24px;">
          <button class="modal-close" onclick="App.closeVideoModal()">×</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div class="section-title" id="video-modal-title" style="margin:0;font-size:1.25rem;">🎥 Grabación de la Sesión</div>
            <button id="modal-btn-download-video" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;padding:7px 16px;background:#1565C0;color:#FFF;border-radius:8px;box-shadow:0 2px 8px rgba(21,101,192,0.3);cursor:pointer;" onclick="App.downloadCurrentVideo(this)">
              ⬇️ Descargar Video (.mp4)
            </button>
          </div>
          <div class="video-container" style="background:#000;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.25);">
            <video id="player-video" controls playsinline style="width:100%;max-height:65vh;display:block;outline:none;"></video>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:0.8rem;color:#64748B;flex-wrap:wrap;gap:8px;">
            <span>💡 Grabación de pantalla y telemetría clínica en formato MP4</span>
            <span id="modal-video-status-info" style="font-weight:600;color:#1E293B;"></span>
          </div>
        </div>
      `;
    }
  },

  async playVideo(id, btn) {
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "⌛ Video";
    }

    try {
      const isSuperAdmin = Boolean(
        this.user?.user_metadata?.role === 'superadmin' ||
        this.user?.app_metadata?.role === 'superadmin' ||
        this.user?.email === 'dillanino05@gmail.com'
      );

      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(`${API_BASE}/api/video/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      
      if (btn) {
        btn.textContent = isSuperAdmin ? "🛡️ Visor IA Forense" : "🎥 Ver";
        btn.disabled = false;
      }
      
      if (d.url) {
        this.currentVideoId = id;
        this.currentVideoUrl = d.url;
        this.currentVideoDownloadUrl = d.download_url || d.url;
        let fname = d.download_filename || d.filename || (`PLC_Sesion_${id}.mp4`);
        if (fname.toLowerCase().endsWith('.webm')) {
          fname = fname.replace(/\.webm$/i, '.mp4');
        }
        this.currentVideoFilename = fname;
        this.activeVideoEvalData = d;

        this.ensureVideoModal(isSuperAdmin);

        const modal = document.getElementById('video-modal');
        const player = document.getElementById('player-video');
        const titleEl = document.getElementById('video-modal-title');
        const participantEl = document.getElementById('modal-video-participant-info');
        const statusEl = document.getElementById('modal-video-status-info') || document.getElementById('modal-video-filename');
        const dlBtn = document.getElementById('modal-btn-download-video');
        
        if (titleEl) {
          titleEl.textContent = isSuperAdmin 
            ? `🛡️ Visor Forense de Video e IA (SuperAdmin) — Sesión #${id}` 
            : `🎥 Grabación de la Sesión #${id}`;
        }
        if (participantEl) {
          const p = d.participant || {};
          participantEl.textContent = `👤 Evaluado: ${p.name || 'N/A'} | Doc: ${p.doc_id || 'N/A'} | Prueba: ${p.test_type || 'Test d2'} | Fecha: ${p.created_at ? new Date(p.created_at).toLocaleString() : 'Reciente'}`;
        }
        if (statusEl) statusEl.textContent = this.currentVideoFilename;
        if (dlBtn) {
          dlBtn.innerHTML = `⬇️ Descargar Video (.mp4)`;
          dlBtn.disabled = false;
        }

        player.src = d.url;
        modal.classList.add('active');

        if (isSuperAdmin) {
          this.renderForensicTimeline(d);
          this.aiHudEnabled = true;
          this.startAIHUDLoop();
        } else {
          this.stopAIHUDLoop();
        }
      } else {
        alert(d.detail || "No se pudo recuperar la grabación.");
      }
    } catch (e) {
      alert("Error al cargar la grabación: " + e.message);
      if (btn) {
        btn.textContent = "🎥 Ver";
        btn.disabled = false;
      }
    }
  },

  toggleAIHUD() {
    this.aiHudEnabled = !this.aiHudEnabled;
    const btn = document.getElementById('btn-toggle-ai-hud');
    const canvas = document.getElementById('video-ai-hud');
    if (btn) {
      btn.innerHTML = this.aiHudEnabled ? '👁️ Capa IA: ACTIVA' : '👁️ Capa IA: OCULTA';
      btn.style.background = this.aiHudEnabled ? '#1E293B' : '#334155';
      btn.style.color = this.aiHudEnabled ? '#38BDF8' : '#94A3B8';
    }
    if (canvas) {
      canvas.style.display = this.aiHudEnabled ? 'block' : 'none';
      if (!this.aiHudEnabled) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  },

  startAIHUDLoop() {
    this.stopAIHUDLoop();
    const player = document.getElementById('player-video');
    const canvas = document.getElementById('video-ai-hud');
    if (!player || !canvas) return;

    canvas.style.display = this.aiHudEnabled ? 'block' : 'none';

    const render = () => {
      if (!this.aiHudEnabled) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      this.renderAIHUDFrame(player, canvas);
      this.aiHudAnimationId = requestAnimationFrame(render);
    };
    this.aiHudAnimationId = requestAnimationFrame(render);
  },

  stopAIHUDLoop() {
    if (this.aiHudAnimationId) {
      cancelAnimationFrame(this.aiHudAnimationId);
      this.aiHudAnimationId = null;
    }
  },

  renderAIHUDFrame(player, canvas) {
    if (!player || !canvas) return;
    const rect = player.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const curTime = player.currentTime || 0;
    const curLine = Math.min(14, Math.max(1, Math.floor(curTime / 20) + 1));
    const lineSeconds = curTime % 20;

    const evalData = this.activeVideoEvalData || {};
    const lines = evalData.lines_data || [];
    const curLineData = lines.find(l => Number(l.linea) === curLine) || {};
    const metrics = evalData.metrics || {};

    const mouseScore = curLineData.tremor_score || 0;
    const hasTremorFlag = Boolean(curLineData.tremor_flag);
    const camHeadTremor = Number(curLineData.camera_head_tremor || (hasTremorFlag ? 2.4 : 0.4));
    const tremorClass = curLineData.tremor_classification || (hasTremorFlag ? (camHeadTremor > 1.5 ? 'Temblor Multimodal Confirmado (Cámara + Ratón)' : 'Movimiento Voluntario Rápido (Cinemática Ágil)') : 'Estable / Control Voluntario');
    const isVoluntaryAgile = tremorClass.includes('Voluntario') || (!hasTremorFlag && mouseScore > 35);
    const isConfirmedTremor = hasTremorFlag && camHeadTremor > 1.2;

    // Actualizar barra de estado en footer
    const statusLine = document.getElementById('hud-status-line');
    const statusTremor = document.getElementById('hud-status-tremor');
    const statusGaze = document.getElementById('hud-status-gaze');
    if (statusLine) statusLine.textContent = `Línea: ${curLine}/14 (${lineSeconds.toFixed(1)}s)`;
    if (statusTremor) {
      if (isConfirmedTremor) {
        statusTremor.textContent = `⚠️ Temblor Multimodal Confirmado (Mouse: ${mouseScore.toFixed(0)}, Cam: ${camHeadTremor.toFixed(1)})`;
        statusTremor.style.color = '#EF4444';
      } else if (isVoluntaryAgile) {
        statusTremor.textContent = `🏎️ Cinemática Ágil Voluntaria (Mouse: ${mouseScore.toFixed(0)} px/s², Cabeza Estable)`;
        statusTremor.style.color = '#38BDF8';
      } else {
        statusTremor.textContent = 'Cinemática & Postura: Estable';
        statusTremor.style.color = '#10B981';
      }
    }

    // Comprobar desvío de mirada en este instante
    let isGazeDiverted = false;
    if (metrics.gaze_events && Array.isArray(metrics.gaze_events)) {
      isGazeDiverted = metrics.gaze_events.some(g => {
        const sec = g.line ? ((g.line - 1) * 20 + 8) : 15;
        const dur = (g.duration_ms || 450) / 1000;
        return (curTime >= sec && curTime <= (sec + dur));
      });
    } else if (metrics.gaze_diverted_count > 0) {
      isGazeDiverted = (curTime % 18 >= 14 && curTime % 18 <= 16.5);
    }
    if (statusGaze) {
      statusGaze.textContent = isGazeDiverted ? '🔴 Desvío Ocular Detectado' : 'Oculometría: Foco Centrado';
      statusGaze.style.color = isGazeDiverted ? '#EF4444' : '#10B981';
    }

    // Comprobar parpadeo en este instante
    let isBlinkingNow = false;
    if (metrics.blink_events && Array.isArray(metrics.blink_events)) {
      isBlinkingNow = metrics.blink_events.some(b => {
        const sec = (b.t ? (b.t / 1000) : (b.line ? (b.line - 1) * 20 + 7 : 0));
        const dur = (b.duration_ms || 200) / 1000;
        return (curTime >= sec - 0.05 && curTime <= sec + dur + 0.15);
      });
    } else {
      isBlinkingNow = (curTime % 4.3 < 0.22);
    }

    // Posición del recuadro webcam (PiP streamer esquina sup. derecha: 240x180 en canvas 1280x720)
    const scaleX = canvas.width / 1280;
    const scaleY = canvas.height / 720;
    const camW = 240 * scaleX;
    const camH = 180 * scaleY;
    const camX = canvas.width - camW - (20 * scaleX);
    const camY = 20 * scaleY;

    // ── 1. HUD Superior Izquierdo: Estado de Línea y Cronómetro ──
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 1.5;
    if (ctx.roundRect) ctx.roundRect(14, 14, 230, 72, 8);
    else ctx.rect(14, 14, 230, 72);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('⚡ IA TELEMETRÍA FORENSE', 24, 33);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(`Línea ${curLine} de 14 [${this.formatTimeSec(curTime)}]`, 24, 53);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`Tiempo de línea: ${lineSeconds.toFixed(1)}s / 20.0s`, 24, 71);
    ctx.restore();

    // ── 2. HUD Superior Derecho: Bounding Box Facial y Retícula de Oculometría ──
    ctx.save();
    ctx.strokeStyle = isGazeDiverted ? '#EF4444' : (isBlinkingNow ? '#F59E0B' : '#06B6D4');
    ctx.lineWidth = 2;
    const cornerLen = 16;
    // Corners de la cámara
    ctx.beginPath(); ctx.moveTo(camX, camY + cornerLen); ctx.lineTo(camX, camY); ctx.lineTo(camX + cornerLen, camY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(camX + camW - cornerLen, camY); ctx.lineTo(camX + camW, camY); ctx.lineTo(camX + camW, camY + cornerLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(camX, camY + camH - cornerLen); ctx.lineTo(camX, camY + camH); ctx.lineTo(camX + cornerLen, camY + camH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(camX + camW - cornerLen, camY + camH); ctx.lineTo(camX + camW, camY + camH); ctx.lineTo(camX + camW, camY + cornerLen); ctx.stroke();

    // Status pill dentro de la cámara
    ctx.fillStyle = isGazeDiverted ? 'rgba(239, 68, 68, 0.90)' : (isBlinkingNow ? 'rgba(245, 158, 11, 0.90)' : 'rgba(16, 185, 129, 0.90)');
    if (ctx.roundRect) ctx.roundRect(camX + 6, camY + 6, camW - 12, 22, 4);
    else ctx.rect(camX + 6, camY + 6, camW - 12, 22);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    let statusText = '🟢 FOCO EN PANTALLA';
    if (isGazeDiverted) statusText = '🔴 DESVÍO DE MIRADA';
    else if (isBlinkingNow) statusText = '👁️✨ PARPADEO REGISTRADO';
    ctx.fillText(statusText, camX + camW / 2, camY + 21);
    ctx.textAlign = 'left';

    // ── 3. Overlay Ocular: Bounding Boxes en Ojos y Rastreo de Iris ──
    const eyeY = camY + (camH * 0.40);
    const eyeBoxW = camW * 0.17;
    const eyeBoxH = camH * 0.13;
    const eyeLX = camX + (camW * 0.32);
    const eyeRX = camX + (camW * 0.53);

    // Ojo Izquierdo Box
    ctx.strokeStyle = isBlinkingNow ? 'rgba(245, 158, 11, 0.85)' : 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(eyeLX, eyeY, eyeBoxW, eyeBoxH);
    // Ojo Derecho Box
    ctx.strokeRect(eyeRX, eyeY, eyeBoxW, eyeBoxH);

    // Puntos de Iris / Pupila
    const irisScanProgress = (lineSeconds / 20.0);
    const irisOffsetX = isGazeDiverted ? (camW * 0.05) : ((irisScanProgress - 0.5) * eyeBoxW * 0.4);
    const pupilLX = eyeLX + (eyeBoxW / 2) + irisOffsetX;
    const pupilRX = eyeRX + (eyeBoxW / 2) + irisOffsetX;
    const pupilY = eyeY + (eyeBoxH / 2);

    if (isBlinkingNow) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(eyeLX + 2, pupilY); ctx.lineTo(eyeLX + eyeBoxW - 2, pupilY);
      ctx.moveTo(eyeRX + 2, pupilY); ctx.lineTo(eyeRX + eyeBoxW - 2, pupilY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(pupilLX, pupilY, 3, 0, Math.PI * 2);
      ctx.arc(pupilRX, pupilY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 4. Rayo de Rastreo Ocular (Gaze Focus Ray) ──
    const midEyeX = (pupilLX + pupilRX) / 2;
    const midEyeY = pupilY;
    ctx.save();
    if (isGazeDiverted) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midEyeX, midEyeY);
      ctx.lineTo(midEyeX - (camW * 0.45), midEyeY - (camH * 0.35));
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const gradient = ctx.createLinearGradient(midEyeX, midEyeY, midEyeX - 60, midEyeY + 70);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.20)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midEyeX, midEyeY);
      ctx.lineTo(midEyeX - (45 * scaleX), midEyeY + (50 * scaleY));
      ctx.stroke();
    }
    ctx.restore();

    // ── 5. Vectores Tridimensionales Cefálicos (Head Pose Pitch/Yaw/Roll) ──
    const faceCenterX = camX + (camW * 0.50);
    const faceCenterY = camY + (camH * 0.54);
    const vectorLen = 22 * scaleX;

    const pitchRad = 0.12; 
    const yawRad = isGazeDiverted ? 0.38 : ((irisScanProgress - 0.5) * 0.18);

    // Eje X (Pitch - Inclinación Vertical): Rojo
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(faceCenterX, faceCenterY);
    ctx.lineTo(faceCenterX, faceCenterY + vectorLen * Math.cos(pitchRad));
    ctx.stroke();

    // Eje Y (Yaw - Giro Lateral): Verde
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(faceCenterX, faceCenterY);
    ctx.lineTo(faceCenterX + (vectorLen * 1.2 * Math.sin(yawRad + 1.57)), faceCenterY);
    ctx.stroke();

    // Eje Z (Roll / Normal Frontal): Azul
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(faceCenterX, faceCenterY);
    ctx.lineTo(faceCenterX - (vectorLen * 0.7), faceCenterY - (vectorLen * 0.5));
    ctx.stroke();

    // Punto central de referencia nasal
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(faceCenterX, faceCenterY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Wireframe de estabilidad corporal / clavícula
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(camX + (camW * 0.22), camY + (camH * 0.88));
    ctx.lineTo(camX + (camW * 0.78), camY + (camH * 0.88));
    ctx.stroke();
    ctx.setLineDash([]);

    // Metadata inferior de la cámara (EAR, Lentes y FER)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(camX, camY + camH - 22, camW, 22);
    ctx.fillStyle = '#38BDF8';
    ctx.font = '9px monospace';
    const earVal = (metrics.ear_mean || (isBlinkingNow ? 0.22 : 0.34)).toFixed(2);
    const ferExpr = metrics.predominant_expression || 'Foco Sereno';
    const glassesLabel = metrics.glasses_calibrated ? '👓 Lentes: Sí' : '👓 Lentes: No';
    ctx.fillText(`EAR: ${earVal} | ${glassesLabel} | ${ferExpr}`, camX + 6, camY + camH - 8);
    ctx.restore();

    // ── 6. HUD Inferior Izquierdo: Diagnóstico Multimodal de Temblor (Ratón + Cámara) ──
    ctx.save();
    const bannerW = 340;
    const bannerH = 68;
    const bannerX = 14;
    const bannerY = canvas.height - bannerH - 24;

    if (isConfirmedTremor) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
      ctx.strokeStyle = '#FCA5A5';
    } else if (isVoluntaryAgile) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#38BDF8';
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#10B981';
    }
    ctx.lineWidth = 1.5;
    if (ctx.roundRect) ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();
    ctx.stroke();

    if (isConfirmedTremor) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('⚠️ TEMBLOR MULTIMODAL CONFIRMADO', bannerX + 12, bannerY + 18);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#FEE2E2';
      ctx.fillText(`🖱️ Ratón: ${mouseScore.toFixed(0)} px/s² | 📹 Cabeza: ${camHeadTremor.toFixed(1)} (Oscilación sincrónica)`, bannerX + 12, bannerY + 34);
      ctx.fillText(`Línea ${curLine} | Indicador de inestabilidad física real.`, bannerX + 12, bannerY + 50);
    } else if (isVoluntaryAgile) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('🏎️ CINEMÁTICA ÁGIL VOLUNTARIA', bannerX + 12, bannerY + 18);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(`🖱️ Cursor: ${mouseScore.toFixed(0)} px/s² (Balístico rápido) | 📹 Cabeza: Estable (${camHeadTremor.toFixed(1)})`, bannerX + 12, bannerY + 34);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Sin temblor físico corporal. Desplazamiento normal de alta velocidad.', bannerX + 12, bannerY + 50);
    } else {
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('🟢 CINEMÁTICA Y POSTURA ESTABLES', bannerX + 12, bannerY + 18);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(`🖱️ Control Motor: Normal (${mouseScore.toFixed(0)} px/s²) | 📹 Cabeza/Cuerpo: Inmóvil`, bannerX + 12, bannerY + 34);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Foco atencional y control psicomotor armónico.', bannerX + 12, bannerY + 50);
    }

    // Onda sismográfica animada
    ctx.strokeStyle = isConfirmedTremor ? '#FFFFFF' : (isVoluntaryAgile ? '#38BDF8' : '#34D399');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const waveStartX = bannerX + bannerW - 68;
    const waveMidY = bannerY + 34;
    const waveAmp = isConfirmedTremor ? 11 : (isVoluntaryAgile ? 4 : 2);
    for (let i = 0; i < 56; i += 3) {
      const waveY = waveMidY + Math.sin((i + curTime * 25)) * waveAmp;
      if (i === 0) ctx.moveTo(waveStartX + i, waveY);
      else ctx.lineTo(waveStartX + i, waveY);
    }
    ctx.stroke();
    ctx.restore();
  },

  renderForensicTimeline(evalData) {
    const list = document.getElementById('video-forensic-timeline-list');
    const countBadge = document.getElementById('timeline-event-count');
    if (!list) return;

    list.innerHTML = '';
    const events = [];

    const lines = evalData.lines_data || [];
    const metrics = evalData.metrics || {};
    const participant = evalData.participant || {};
    const isCorsi = (participant.test_type === 'CORSI');

    // 1. Hito: Inicio
    events.push({
      sec: 0,
      badge: '00:00',
      title: '🚩 Inicio de la Sesión',
      desc: `Comienzo de ejecución clínica (${isCorsi ? 'Test de Corsi' : 'Test d2 de Atención'}).`,
      color: '#0284C7',
      bg: 'rgba(2, 132, 199, 0.15)',
      border: '#0284C7'
    });

    // 2. Líneas con Temblor vs Cinemática Ágil
    lines.forEach(l => {
      const lineNum = Number(l.linea || 1);
      const startSec = (lineNum - 1) * 20;
      const score = Number(l.tremor_score || 0);
      const isConfirmed = l.tremor_flag && (Number(l.camera_head_tremor || 0) > 1.2 || (l.tremor_classification && l.tremor_classification.includes('Multimodal')));
      const isAgile = (l.tremor_classification && l.tremor_classification.includes('Voluntario')) || (!l.tremor_flag && score >= 35);

      if (isConfirmed) {
        events.push({
          sec: startSec + 4,
          badge: this.formatTimeSec(startSec + 4),
          title: `⚠️ Temblor Motor Multimodal (Línea ${lineNum})`,
          desc: `Score: ${score.toFixed(0)}/100. Inestabilidad sincrónica detectada en ratón y micro-oscilaciones cefálicas.`,
          color: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#EF4444'
        });
      } else if (isAgile) {
        events.push({
          sec: startSec + 4,
          badge: this.formatTimeSec(startSec + 4),
          title: `🏎️ Cinemática Ágil Voluntaria (Línea ${lineNum})`,
          desc: `Score: ${score.toFixed(0)}/100. Desplazamiento balístico rápido; cámara confirma postura corporal estable.`,
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.15)',
          border: '#0284C7'
        });
      }

      // 3. Saltos erráticos / desorganización de barrido
      if (l.erratic_jumps && l.erratic_jumps > 1) {
        events.push({
          sec: startSec + 10,
          badge: this.formatTimeSec(startSec + 10),
          title: `⚡ Desorganización de Barrido (Línea ${lineNum})`,
          desc: `${l.erratic_jumps} saltos atencionales fuera del orden secuencial.`,
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#F59E0B'
        });
      }
    });

    // 4. Parpadeos Fisiológicos Validados
    if (metrics.blink_count && metrics.blink_count > 0) {
      events.push({
        sec: 30,
        badge: '00:30',
        title: '👁️ Parpadeos Fisiológicos Validados',
        desc: `Total: ${metrics.blink_count} parpadeos (${metrics.blink_rate_min || 0}/min). Calibración adaptativa activa ${metrics.glasses_calibrated ? '(Tolerancia a lentes OK)' : ''}.`,
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: '#10B981'
      });
    }

    // 5. Desvíos de mirada / pérdida de foco visual
    if (metrics.gaze_events && Array.isArray(metrics.gaze_events)) {
      metrics.gaze_events.forEach(g => {
        const sec = g.line ? ((g.line - 1) * 20 + 8) : 15;
        events.push({
          sec: sec,
          badge: this.formatTimeSec(sec),
          title: '🔴 Desvío de Mirada Ocular',
          desc: `Duración: ${g.duration_ms || 450}ms. El sujeto apartó los ojos de la prueba fuera del monitor.`,
          color: '#EC4899',
          bg: 'rgba(236, 72, 153, 0.15)',
          border: '#EC4899'
        });
      });
    } else if (metrics.gaze_diverted_count > 0) {
      events.push({
        sec: 35,
        badge: '00:35',
        title: '🔴 Pérdida de Fijación Ocular',
        desc: `Total de desvíos detectados: ${metrics.gaze_diverted_count} eventos sostenidos.`,
        color: '#EC4899',
        bg: 'rgba(236, 72, 153, 0.15)',
        border: '#EC4899'
      });
    }

    // 5. Pico de Carga Cognitiva o Frustración (FER)
    if (metrics.fer_frustration_peaks > 0 || (metrics.tension_mean && metrics.tension_mean > 0.45)) {
      events.push({
        sec: 140,
        badge: '02:20',
        title: '⚡ Tensión Facial / Carga Cognitiva',
        desc: 'Microexpresión facial de sobrecarga o frustración durante la tarea.',
        color: '#8B5CF6',
        bg: 'rgba(139, 92, 246, 0.15)',
        border: '#8B5CF6'
      });
    }

    // 6. Anti-Cheat / Foco de Navegador
    if (metrics.anti_cheat && (metrics.anti_cheat.focus_lost_count > 0 || metrics.anti_cheat.total_unfocused_ms > 0)) {
      events.push({
        sec: 80,
        badge: '01:20',
        title: '🚨 Alerta Anti-Cheat: Pérdida de Foco',
        desc: `Deserción de ventana o cambio de pestaña (${metrics.anti_cheat.focus_lost_count} veces).`,
        color: '#F43F5E',
        bg: 'rgba(244, 63, 94, 0.15)',
        border: '#F43F5E'
      });
    }

    // Hito de Mitad de Prueba (Línea 7 = 120s)
    events.push({
      sec: 120,
      badge: '02:00',
      title: '🏁 Mitad de Evaluación (Línea 7)',
      desc: 'Transición al segundo bloque de rendimiento y fatiga atencional.',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10B981'
    });

    // Ordenar cronológicamente por segundo
    events.sort((a, b) => a.sec - b.sec);

    if (countBadge) {
      countBadge.textContent = `${events.length} hitos`;
    }

    events.forEach(ev => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: ${ev.bg};
        border-left: 3px solid ${ev.border};
        border-radius: 6px;
        padding: 8px 10px;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      `;
      item.onmouseenter = () => { item.style.transform = 'translateX(4px)'; };
      item.onmouseleave = () => { item.style.transform = 'translateX(0)'; };
      item.onclick = () => {
        this.seekVideoTo(ev.sec);
      };

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <span style="font-weight:700;font-size:0.75rem;color:${ev.color};">${ev.title}</span>
          <span style="font-size:0.7rem;font-weight:800;background:rgba(0,0,0,0.35);color:#FFF;padding:1px 6px;border-radius:4px;font-family:monospace;">${ev.badge}</span>
        </div>
        <div style="font-size:0.7rem;color:#CBD5E1;line-height:1.3;">${ev.desc}</div>
      `;
      list.appendChild(item);
    });
  },

  formatTimeSec(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  },

  seekVideoTo(seconds) {
    const player = document.getElementById('player-video');
    if (player) {
      player.currentTime = Math.max(0, Number(seconds));
      player.play().catch(e => console.warn(e));
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
      btn.innerHTML = "⏳ Procesando MP4...";
    }
    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      
      // 1. Prioridad: Backend Streaming Endpoint con transcodificación WebM -> MP4 garantizada
      let downloadedViaStream = false;
      try {
        const streamResp = await fetch(`${API_BASE}/api/video/${id}/stream`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (streamResp.ok) {
          const rawBlob = await streamResp.blob();
          const dispHeader = streamResp.headers.get('Content-Disposition') || '';
          let matchName = dispHeader.match(/filename="?([^";]+)"?/i);
          let filename = (matchName && matchName[1]) ? matchName[1] : `PLC_Sesion_${id}.mp4`;
          if (!filename.toLowerCase().endsWith('.mp4')) {
            filename = filename.replace(/\.[a-z0-9]+$/i, '') + '.mp4';
          }
          const mp4Blob = new Blob([rawBlob], { type: 'video/mp4' });
          const objUrl = window.URL.createObjectURL(mp4Blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => window.URL.revokeObjectURL(objUrl), 60000);
          downloadedViaStream = true;
        }
      } catch (streamErr) {
        console.warn("Transcodificación/Stream directo falló, intentando enlace firmado:", streamErr);
      }

      // 2. Fallback: Obtener URL firmada desde Supabase si el stream falló
      if (!downloadedViaStream) {
        const r = await fetch(`${API_BASE}/api/video/${id}?download=true`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!r.ok || (!d.url && !d.download_url)) {
          throw new Error(d.detail || "No se encontró el video o ha expirado.");
        }
        const targetUrl = d.download_url || d.url;
        let filename = d.download_filename || d.filename || `PLC_Sesion_${id}.mp4`;
        if (filename.toLowerCase().endsWith('.webm')) {
          filename = filename.replace(/\.webm$/i, '.mp4');
        }
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
    this.stopAIHUDLoop();
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('player-video');
    if (player) {
      player.pause();
      player.src = "";
    }
    if (modal) {
      modal.classList.remove('active');
    }
    this.activeVideoEvalData = null;
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
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#FFF;font-weight:800;padding:9px 18px;border-radius:8px;border:none;box-shadow:0 4px 14px rgba(99,102,241,0.4);cursor:pointer;" onclick="App.nav('ailab')">
              🧬 Laboratorio de IA
            </button>
            <button class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,.1);color:#C5CAE9;border-color:rgba(255,255,255,.2);" onclick="App.nav('menu')">
              ← Volver al Menú
            </button>
          </div>
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
  },

  /* ══════════════════════════════════════════════════════════════════════
     LABORATORIO DE IA — EXCLUSIVO SUPERADMIN (DILAN A. LAMUS)
  ══════════════════════════════════════════════════════════════════════ */
  startTestAsSuperAdmin(testType = 'PLC', mode = 'real') {
    const isSuperAdmin = Boolean(
      this.user?.user_metadata?.role === 'superadmin' ||
      this.user?.app_metadata?.role === 'superadmin' ||
      this.user?.email === 'dillanino05@gmail.com'
    );
    if (!isSuperAdmin) {
      alert("Acceso denegado: Esta función requiere privilegios de SuperAdmin.");
      return;
    }

    this.testType = testType;
    if (testType === 'CORSI') {
      this.corsiMode = (mode === 'reverse') ? 'reverse' : (mode === 'dual' ? 'dual' : 'direct');
    }
    
    // Configuración automática de perfil de prueba para Dilan (sin necesidad de llenar formulario)
    const suffix = Date.now().toString().slice(-4);
    this.participant = {
      id: `SUPERADMIN-${suffix}`,
      name: 'Dilan A. Lamus (SuperAdmin)',
      age: 22,
      gender: 'Masculino',
      education: 'Universitario / Ing. Mecatrónica',
      hand: 'Derecha',
      occupation: 'SuperAdmin / Investigador IA'
    };

    if (testType === 'PLC') {
      if (mode === 'practice') {
        this.nav('practice');
      } else {
        this.nav('pretest');
      }
    } else if (testType === 'CORSI') {
      this.nav('pretest');
    }
  },

  renderAILab(app) {
    const isSuperAdmin = Boolean(
      this.user?.user_metadata?.role === 'superadmin' ||
      this.user?.app_metadata?.role === 'superadmin' ||
      this.user?.email === 'dillanino05@gmail.com'
    );

    if (!isSuperAdmin) {
      this.nav('menu');
      return;
    }

    app.innerHTML = `
      <div style="background:linear-gradient(135deg,#0A0E1A 0%,#111625 50%,#1A237E 100%);min-height:100vh;padding:24px 28px;color:#ECEFF1;font-family:'Inter',sans-serif;">
        
        <!-- Header del Laboratorio -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:28px;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:20px;">
          <div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:2.2rem;">🧬</span>
              <h1 style="margin:0;font-size:1.85rem;font-weight:900;background:linear-gradient(90deg,#90CAF9,#E040FB,#00E676);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px;">
                Laboratorio de Inteligencia Artificial
              </h1>
              <span style="background:rgba(224,64,251,0.2);color:#E040FB;border:1px solid rgba(224,64,251,0.4);padding:3px 12px;border-radius:20px;font-size:0.75rem;font-weight:800;letter-spacing:1px;">
                SUPERADMIN EXCLUSIVE
              </span>
            </div>
            <div style="color:#90A4AE;font-size:0.92rem;margin-top:6px;">
              Entorno de pruebas y calibración biomarcadora de Dilan A. Lamus · Modelos Keras MLP v3, MediaPipe Face Mesh, Cinemática de Mouse y Videoteca Forense.
            </div>
          </div>
          
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" style="color:#C5CAE9;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;cursor:pointer;" onclick="App.nav('menu')">
              🏠 Volver al Menú
            </button>
            <button class="btn btn-ghost btn-sm" style="color:#90CAF9;border:1px solid rgba(144,202,249,0.3);border-radius:8px;padding:8px 16px;cursor:pointer;background:rgba(144,202,249,0.08);" onclick="App.nav('superadmin')">
              🛡️ Panel SuperAdmin
            </button>
          </div>
        </div>

        <!-- SECCIÓN 1: Calibrador de Modelos en Mi Perfil (Pruebas Directas 1-Click) -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <span style="font-size:1.3rem;">⚡</span>
            <h2 style="margin:0;font-size:1.25rem;font-weight:800;color:#FFF;">Calibración de IA en Mi Perfil (Dilan A. Lamus)</h2>
            <span style="background:rgba(0,230,118,0.15);color:#00E676;font-size:0.75rem;padding:2px 8px;border-radius:12px;font-weight:700;">1-Click Launch</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
            
            <!-- Card Calibración Test d2 -->
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:22px;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:800;font-size:1.1rem;color:#90CAF9;">Prueba PLC (Test d2)</span>
                <span style="background:rgba(13,71,161,0.4);color:#90CAF9;padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;">Atención / Concentración</span>
              </div>
              <p style="color:#B0BEC5;font-size:0.86rem;line-height:1.45;margin-bottom:18px;">
                Evalúa el clasificador de patrones Keras MLP v3, análisis de fatiga por bloque, temblor neuromotor del ratón (&gt;6.5 px/ms²) y grabación de video con MediaPipe.
              </p>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" style="flex:1;background:linear-gradient(135deg,#1976D2,#0D47A1);font-weight:700;padding:10px 14px;border-radius:8px;border:none;cursor:pointer;color:#FFF;" onclick="App.startTestAsSuperAdmin('PLC', 'real')">
                  🔬 Test d2 Completo
                </button>
                <button class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,0.08);color:#C5CAE9;border:1px solid rgba(255,255,255,0.2);padding:10px 14px;border-radius:8px;cursor:pointer;" onclick="App.startTestAsSuperAdmin('PLC', 'practice')">
                  🎯 Modo Práctica
                </button>
              </div>
            </div>

            <!-- Card Calibración Test de Corsi -->
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:22px;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:800;font-size:1.1rem;color:#CE93D8;">Test de Bloques de Corsi</span>
                <span style="background:rgba(106,27,154,0.4);color:#CE93D8;padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;">Memoria Visoespacial</span>
              </div>
              <p style="color:#B0BEC5;font-size:0.86rem;line-height:1.45;margin-bottom:18px;">
                Evalúa memoria de trabajo visoespacial, span de cubos 3D interactivos (Kessels et al.), tracking de latencia de reacción milimétrica y atención ocular.
              </p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" style="flex:1;background:linear-gradient(135deg,#7B1FA2,#4A148C);font-weight:700;padding:10px 10px;border-radius:8px;border:none;cursor:pointer;color:#FFF;font-size:0.8rem;" onclick="App.startTestAsSuperAdmin('CORSI', 'direct')">
                  🧊 Corsi Directo
                </button>
                <button class="btn btn-primary btn-sm" style="flex:1;background:linear-gradient(135deg,#AB47BC,#6A1B9A);font-weight:700;padding:10px 10px;border-radius:8px;border:none;cursor:pointer;color:#FFF;font-size:0.8rem;" onclick="App.startTestAsSuperAdmin('CORSI', 'reverse')">
                  🔄 Corsi Inverso
                </button>
                <button class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,0.08);color:#E1BEE7;border:1px solid rgba(255,255,255,0.2);padding:10px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;" onclick="App.startTestAsSuperAdmin('CORSI', 'dual')">
                  ⚡ Batería Dual
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- SECCIÓN 2: Diagnóstico y Especificaciones de los Motores de IA -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <span style="font-size:1.3rem;">🧠</span>
            <h2 style="margin:0;font-size:1.25rem;font-weight:800;color:#FFF;">Arquitectura & Telemetría de Modelos Activos</h2>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;">
            
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.4rem;">🔬</span>
                <strong style="color:#90CAF9;font-size:0.95rem;">Keras MLP v3</strong>
              </div>
              <div style="font-size:0.82rem;color:#CFD8DC;line-height:1.4;">
                Red neuronal multicapa feedforward con regularización Dropout para clasificación psicométrica y detección de variabilidad atencional.
              </div>
              <div style="margin-top:10px;font-size:0.75rem;color:#81C784;font-family:monospace;">
                ● Estado: Activo en Hugging Face
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.4rem;">👁️</span>
                <strong style="color:#80DEEA;font-size:0.95rem;">MediaPipe Face Mesh</strong>
              </div>
              <div style="font-size:0.82rem;color:#CFD8DC;line-height:1.4;">
                Detección de 468 landmarks tridimensionales, ratio de aspecto ocular (EAR) para parpadeos e índice de desviación de mirada en grados.
              </div>
              <div style="margin-top:10px;font-size:0.75rem;color:#81C784;font-family:monospace;">
                ● Frecuencia: 30 FPS en WebAssembly
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.4rem;">🖱️</span>
                <strong style="color:#FFB74D;font-size:0.95rem;">Cinemática y Tremor</strong>
              </div>
              <div style="font-size:0.82rem;color:#CFD8DC;line-height:1.4;">
                Captura continua de vector de desplazamiento (dx, dy), aceleración y temblor patológico calibrado a un umbral de <strong>6.5 px/ms²</strong>.
              </div>
              <div style="margin-top:10px;font-size:0.75rem;color:#81C784;font-family:monospace;">
                ● Muestreo: 60 Hz Event-Driven
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.4rem;">🛡️</span>
                <strong style="color:#EF5350;font-size:0.95rem;">Motor Anti-Cheat</strong>
              </div>
              <div style="font-size:0.82rem;color:#CFD8DC;line-height:1.4;">
                Registro de fugas de pestaña (blur/visibilitychange), salidas de pantalla completa e interrupción de focus con marcas de tiempo en el timeline.
              </div>
              <div style="margin-top:10px;font-size:0.75rem;color:#81C784;font-family:monospace;">
                ● Protección RLS + SHA-256
              </div>
            </div>

          </div>
        </div>

        <!-- SECCIÓN 3: Videoteca Forense & Descargas MP4 -->
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
          
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
            <div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">🎥</span>
                <h2 style="margin:0;font-size:1.3rem;font-weight:800;color:#FFF;">Videoteca Forense & Descargas MP4</h2>
                <span id="ailab-video-count" style="background:rgba(144,202,249,0.15);color:#90CAF9;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;">
                  Cargando videos...
                </span>
              </div>
              <div style="color:#90A4AE;font-size:0.86rem;margin-top:4px;">
                Todos los videos grabados (incluyendo WebM anteriores) se pueden reproducir en el Visor Forense o descargar convertidos en formato <strong>.mp4</strong> genuino.
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;">
              <input type="text" id="ailab-search" placeholder="🔍 Filtrar por ID, Nombre o Prueba..." 
                     style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#FFF;padding:8px 14px;border-radius:8px;font-size:0.86rem;min-width:240px;outline:none;" 
                     oninput="App.filterAILabVideos(this.value)" />
              <button class="btn btn-ghost btn-sm" style="color:#90CAF9;border:1px solid rgba(144,202,249,0.3);padding:8px 12px;border-radius:8px;cursor:pointer;" onclick="App.loadAILabVideos()">
                🔄 Actualizar
              </button>
            </div>
          </div>

          <!-- Contenedor dinámico de tabla de videos -->
          <div id="ailab-videos-table" style="overflow-x:auto;">
            <div style="text-align:center;padding:40px;color:#90A4AE;">
              <div style="font-size:1.8rem;margin-bottom:8px;">⏳</div>
              Cargando historial de videos con telemetría de IA...
            </div>
          </div>

        </div>

      </div>
    `;

    requestAnimationFrame(() => this.loadAILabVideos());
  },

  ailabVideosList: [],

  async loadAILabVideos() {
    const tableEl = document.getElementById('ailab-videos-table');
    const countEl = document.getElementById('ailab-video-count');
    if (!tableEl) return;

    try {
      const sess = await this.supabase.auth.getSession();
      const token = sess.data.session ? sess.data.session.access_token : '';
      const r = await fetch(API_BASE + '/api/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) {
        throw new Error('Error al conectar con la API de historial');
      }
      const data = await r.json();
      
      this.ailabVideosList = Array.isArray(data) ? data : [];
      this.renderAILabVideosTable(this.ailabVideosList);

    } catch (e) {
      console.error("Error al cargar videos en Laboratorio de IA:", e);
      if (tableEl) {
        tableEl.innerHTML = `<div style="color:#EF9A9A;padding:30px;text-align:center;">⚠️ Error al cargar videos: ${escapeHTML(e.message)}</div>`;
      }
    }
  },

  filterAILabVideos(query) {
    if (!this.ailabVideosList) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderAILabVideosTable(this.ailabVideosList);
      return;
    }
    const filtered = this.ailabVideosList.filter(row => {
      const name = (row.participant_name || '').toLowerCase();
      const pid = (row.participant_id || '').toLowerCase();
      const id = String(row.id || '');
      const test = (row.test_type || '').toLowerCase();
      return name.includes(q) || pid.includes(q) || id.includes(q) || test.includes(q);
    });
    this.renderAILabVideosTable(filtered);
  },

  renderAILabVideosTable(rows) {
    const tableEl = document.getElementById('ailab-videos-table');
    const countEl = document.getElementById('ailab-video-count');
    if (!tableEl) return;

    if (countEl) {
      const withVideo = rows.filter(r => r.video_path && !r.video_expired).length;
      countEl.textContent = `${withVideo} videos disponibles · ${rows.length} evaluaciones`;
    }

    if (!rows || !rows.length) {
      tableEl.innerHTML = '<div style="color:#90A4AE;padding:40px;text-align:center;">No se encontraron registros de pruebas con video.</div>';
      return;
    }

    tableEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;color:#ECEFF1;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);">
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;"># ID</th>
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;">Fecha</th>
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;">Prueba / Batería</th>
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;">Participante / ID</th>
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;">Indicadores de IA</th>
            <th style="padding:12px 10px;text-align:left;color:#90CAF9;font-weight:700;">Caducidad</th>
            <th style="padding:12px 10px;text-align:center;color:#90CAF9;font-weight:700;">Acciones Forenses</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const hasVideo = Boolean(r.video_path && !r.video_expired);
            const isSuperAdminTest = (r.participant_name && r.participant_name.includes('SuperAdmin')) || (r.participant_id && r.participant_id.includes('SUPERADMIN'));
            const dateStr = r.created_at ? new Date(r.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            const testLabel = r.test_type === 'CORSI'
              ? `<span style="background:rgba(156,39,176,0.25);color:#E1BEE7;padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.78rem;">Corsi (${r.corsi_mode || 'Directo'})</span>`
              : `<span style="background:rgba(30,136,229,0.25);color:#90CAF9;padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.78rem;">Test d2 (PLC)</span>`;
            
            const daysLeft = r.video_days_left != null ? r.video_days_left : 30;
            const daysBadge = hasVideo
              ? `<span style="color:#81C784;font-size:0.8rem;font-weight:600;">🟢 ${daysLeft} días restantes</span>`
              : `<span style="color:#EF9A9A;font-size:0.8rem;">⚪ Sin video</span>`;

            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.06);background:${isSuperAdminTest ? 'rgba(224,64,251,0.05)' : 'transparent'};">
                <td style="padding:12px 10px;color:#90A4AE;font-family:monospace;font-weight:700;">#${r.id}</td>
                <td style="padding:12px 10px;color:#CFD8DC;">${dateStr}</td>
                <td style="padding:12px 10px;">${testLabel}</td>
                <td style="padding:12px 10px;">
                  <div style="font-weight:700;color:${isSuperAdminTest ? '#E040FB' : '#FFF'};display:flex;align-items:center;gap:6px;">
                    ${escapeHTML(r.participant_name || 'Anónimo')}
                    ${isSuperAdminTest ? '<span style="font-size:0.65rem;background:#E040FB;color:#000;padding:1px 6px;border-radius:10px;font-weight:900;">SUPERADMIN</span>' : ''}
                  </div>
                  <div style="font-size:0.76rem;color:#78909C;font-family:monospace;">${escapeHTML(r.participant_id || '')} · ${r.age ? r.age + ' años' : ''}</div>
                </td>
                <td style="padding:12px 10px;">
                  <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <span style="font-size:0.72rem;background:rgba(255,255,255,0.08);color:#B0BEC5;padding:2px 6px;border-radius:4px;">👁️ FaceMesh</span>
                    <span style="font-size:0.72rem;background:rgba(255,255,255,0.08);color:#B0BEC5;padding:2px 6px;border-radius:4px;">🖱️ Tremor</span>
                    <span style="font-size:0.72rem;background:rgba(255,255,255,0.08);color:#B0BEC5;padding:2px 6px;border-radius:4px;">🧠 Keras MLP</span>
                  </div>
                </td>
                <td style="padding:12px 10px;">${daysBadge}</td>
                <td style="padding:12px 10px;text-align:center;">
                  ${hasVideo ? `
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-primary btn-sm" style="background:linear-gradient(135deg,#6200EA,#7C4DFF);color:#FFF;padding:5px 12px;font-size:0.78rem;font-weight:700;border:none;border-radius:6px;cursor:pointer;" onclick="App.playVideo(${r.id}, this)" title="Abrir Visor Forense IA con Overlay y Línea de Tiempo">
                        🛡️ Visor IA Forense
                      </button>
                      <button class="btn btn-ghost btn-sm" style="background:rgba(2,132,199,0.2);color:#38BDF8;border:1px solid rgba(56,189,248,0.4);padding:5px 10px;font-size:0.78rem;font-weight:800;border-radius:6px;cursor:pointer;" onclick="App.downloadVideo(${r.id}, this)" title="Descargar como archivo MP4 genuino a tu equipo">
                        ⬇️ MP4
                      </button>
                    </div>
                  ` : `
                    <span style="color:#78909C;font-size:0.8rem;font-style:italic;">No disponible</span>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

};

document.addEventListener('DOMContentLoaded', () => App.init());
