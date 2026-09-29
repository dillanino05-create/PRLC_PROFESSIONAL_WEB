/**
 * copilot.js — MecaPsi AI Copilot (Fase 2)
 * Asistente Inteligente Paraclínico y Pedagógico
 * 
 * Regla de Oro: Enfoque estrictamente DESCRIPTIVO.
 * Explica lo que muestran los datos, gráficas y biomarcadores (pupila, temblor, baremos)
 * sin emitir diagnósticos médicos, psiquiátricos o etiquetas patológicas definitivas.
 */

(function () {
  'use strict';

  // API Backend URL (Hugging Face Spaces o localhost)
  const BACKEND_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:7860'
    : 'https://dalamus2405-plc-backend.hf.space';

  const STORAGE_KEY_CUSTOM_GEMINI = 'mecapsi_custom_gemini_key';

  class MecaPsiCopilot {
    constructor() {
      this.isOpen = false;
      this.isMinimized = false;
      this.isLoading = false;
      this.history = [];
      this.initUI();
    }

    getCustomKey() {
      try {
        return localStorage.getItem(STORAGE_KEY_CUSTOM_GEMINI) || '';
      } catch (e) {
        return '';
      }
    }

    setCustomKey(key) {
      try {
        if (key) localStorage.setItem(STORAGE_KEY_CUSTOM_GEMINI, key.trim());
        else localStorage.removeItem(STORAGE_KEY_CUSTOM_GEMINI);
      } catch (e) {}
    }

    getCurrentContext() {
      // Extraer contexto del estado de la app si está presente en window.App
      const app = window.App || {};
      const ctx = {
        test_type: app.testType || (app.corsiMode ? 'CORSI' : 'PLC Professional'),
        participant: app.participant || null,
        metrics: app.metrics || null,
        ml_pred: app.mlPrediction || null,
        session_tag: app.sessionTag || null
      };
      return ctx;
    }

    initUI() {
      // Estilos CSS inyectados para el launcher y el modal glassmorphism
      const style = document.createElement('style');
      style.textContent = `
        /* ══════════════════════════════════════════════════════════
           MecaPsi AI Copilot — Floating Launcher & Modal
        ══════════════════════════════════════════════════════════ */
        #mecapsi-copilot-launcher {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99990;
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);
          border: 1px solid rgba(99, 102, 241, 0.4);
          padding: 10px 18px 10px 12px;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 0 20px rgba(6, 182, 212, 0.2);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          backdrop-filter: blur(12px);
        }
        #mecapsi-copilot-launcher:hover {
          transform: translateY(-3px) scale(1.03);
          border-color: rgba(6, 182, 212, 0.6);
          box-shadow: 0 14px 30px -5px rgba(79, 70, 229, 0.5), 0 0 25px rgba(6, 182, 212, 0.35);
        }
        #mecapsi-copilot-launcher .copilot-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4F46E5, #06B6D4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.5);
          position: relative;
        }
        #mecapsi-copilot-launcher .copilot-pulse {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          background: #10B981;
          border-radius: 50%;
          border: 2px solid #0F172A;
          animation: copilot-glow 2s infinite;
        }
        @keyframes copilot-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        #mecapsi-copilot-launcher .copilot-label {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        #mecapsi-copilot-launcher .copilot-title {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          color: #FFFFFF;
          letter-spacing: 0.2px;
          line-height: 1.2;
        }
        #mecapsi-copilot-launcher .copilot-sub {
          font-size: 0.7rem;
          color: #94A3B8;
          line-height: 1.1;
        }

        /* ── Ventana Modal Flotante ────────────────────────────── */
        #mecapsi-copilot-window {
          position: fixed;
          bottom: 84px;
          right: 24px;
          width: 400px;
          max-width: calc(100vw - 32px);
          height: 580px;
          max-height: calc(100vh - 120px);
          z-index: 99991;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(79, 70, 229, 0.25);
          backdrop-filter: blur(20px);
          display: none;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #mecapsi-copilot-window.open {
          display: flex;
          animation: copilot-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes copilot-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Header */
        .copilot-header {
          padding: 14px 18px;
          background: linear-gradient(90deg, rgba(30, 27, 75, 0.8), rgba(15, 23, 42, 0.8));
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .copilot-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .copilot-header-avatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4F46E5, #06B6D4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .copilot-header-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #FFFFFF;
          margin: 0;
          line-height: 1.2;
        }
        .copilot-header-status {
          font-size: 0.72rem;
          color: #38BDF8;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .copilot-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .copilot-btn-icon {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #CBD5E1;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }
        .copilot-btn-icon:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #FFFFFF;
        }

        /* Disclaimer Banner */
        .copilot-disclaimer {
          background: rgba(16, 185, 129, 0.08);
          border-bottom: 1px solid rgba(16, 185, 129, 0.2);
          padding: 8px 14px;
          font-size: 0.73rem;
          color: #6EE7B7;
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1.3;
        }

        /* Context Badge */
        .copilot-context-bar {
          background: rgba(79, 70, 229, 0.08);
          border-bottom: 1px solid rgba(79, 70, 229, 0.15);
          padding: 6px 14px;
          font-size: 0.72rem;
          color: #A5B4FC;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Chat Body */
        .copilot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .copilot-msg {
          max-width: 88%;
          padding: 11px 14px;
          border-radius: 14px;
          font-size: 0.84rem;
          line-height: 1.45;
          word-break: break-word;
        }
        .copilot-msg.bot {
          align-self: flex-start;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #E2E8F0;
          border-bottom-left-radius: 4px;
        }
        .copilot-msg.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #4F46E5, #4338CA);
          color: #FFFFFF;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        /* Suggestions chips */
        .copilot-chips {
          padding: 8px 14px;
          display: flex;
          gap: 6px;
          overflow-x: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.6);
        }
        .copilot-chips::-webkit-scrollbar {
          height: 4px;
        }
        .copilot-chip {
          white-space: nowrap;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #C7D2FE;
          font-size: 0.72rem;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .copilot-chip:hover {
          background: rgba(99, 102, 241, 0.25);
          color: #FFFFFF;
          border-color: rgba(6, 182, 212, 0.5);
          transform: translateY(-1px);
        }

        /* Input Area */
        .copilot-input-area {
          padding: 12px 14px;
          background: rgba(15, 23, 42, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .copilot-input {
          flex: 1;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 9px 12px;
          color: #FFFFFF;
          font-size: 0.84rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .copilot-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
        }
        .copilot-input::placeholder {
          color: #64748B;
        }
        .copilot-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #06B6D4, #3B82F6);
          border: none;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 15px;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .copilot-send-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.5);
        }
        .copilot-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* Settings overlay */
        #copilot-settings-modal {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(10px);
          z-index: 99995;
          display: none;
          flex-direction: column;
          padding: 20px;
        }
        #copilot-settings-modal.active {
          display: flex;
        }
      `;
      document.head.appendChild(style);

      // Inyectar HTML del Launcher
      const launcher = document.createElement('div');
      launcher.id = 'mecapsi-copilot-launcher';
      launcher.innerHTML = `
        <div class="copilot-icon">
          <span>🧠</span>
          <div class="copilot-pulse"></div>
        </div>
        <div class="copilot-label">
          <span class="copilot-title">MecaPsi Copilot</span>
          <span class="copilot-sub">Explicar Datos · No Diagnóstico</span>
        </div>
      `;
      launcher.onclick = () => this.toggleWindow();
      document.body.appendChild(launcher);

      // Inyectar HTML del Window Chat
      const win = document.createElement('div');
      win.id = 'mecapsi-copilot-window';
      win.innerHTML = `
        <!-- Header -->
        <div class="copilot-header">
          <div class="copilot-header-info">
            <div class="copilot-header-avatar">🧠</div>
            <div>
              <div class="copilot-header-title">MecaPsi AI Copilot</div>
              <div class="copilot-header-status">
                <span style="display:inline-block;width:6px;height:6px;background:#10B981;border-radius:50%;"></span>
                Asistencia Paraclínica Descriptiva
              </div>
            </div>
          </div>
          <div class="copilot-header-actions">
            <button class="copilot-btn-icon" title="Configurar Clave Gemini" onclick="window.MecaPsiCopilotInstance.toggleSettings()">⚙️</button>
            <button class="copilot-btn-icon" title="Cerrar" onclick="window.MecaPsiCopilotInstance.toggleWindow()">✕</button>
          </div>
        </div>

        <!-- Banner Paraclínico Descriptivo Obligatorio -->
        <div class="copilot-disclaimer">
          <span>🛡️</span>
          <span><strong>Rol Descriptivo:</strong> Explica métricas y biomarcadores paraclínicos sin emitir diagnósticos patológicos.</span>
        </div>

        <!-- Barra de Contexto Dinámico -->
        <div class="copilot-context-bar" id="copilot-context-bar">
          <span id="copilot-ctx-text">🔍 Contexto: En espera de evaluación...</span>
          <button style="background:none;border:none;color:#38BDF8;font-size:0.7rem;cursor:pointer;" onclick="window.MecaPsiCopilotInstance.refreshContext()">Actualizar</button>
        </div>

        <!-- Historial de Mensajes -->
        <div class="copilot-messages" id="copilot-messages"></div>

        <!-- Chips de Sugerencias Rápidas -->
        <div class="copilot-chips">
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Cómo le explico este reporte a los padres o al paciente de forma pedagógica y sin patologizar?')">👨‍👩‍👧 Explicar a padres/paciente</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Por qué el percentil de velocidad en computador difiere de la prueba tradicional de papel?')">⚖️ Papel vs. Computador</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué significa la dilatación pupilar y la tasa de parpadeo en esta prueba?')">👁️ Pupila y parpadeo</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué indica el micro-temblor (jitter) del mouse y sus umbrales?')">🖱️ Temblor (Jitter)</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué representa el tiempo de vacilación previa en la prueba de Corsi?')">⏱️ Corsi y vacilación</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Por qué es fundamental calcular la edad cronológica exacta para los baremos?')">📅 Edad Cronológica</button>
        </div>

        <!-- Input de Mensaje -->
        <div class="copilot-input-area">
          <input type="text" id="copilot-input" class="copilot-input" placeholder="Pregunta sobre los datos o biomarcadores..." onkeydown="if(event.key==='Enter') window.MecaPsiCopilotInstance.sendMessage()"/>
          <button id="copilot-send-btn" class="copilot-send-btn" onclick="window.MecaPsiCopilotInstance.sendMessage()">➤</button>
        </div>

        <!-- Modal de Ajustes (Clave Gemini) -->
        <div id="copilot-settings-modal">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;color:#fff;font-size:1rem;font-weight:700;">⚙️ Configuración del Asistente</h3>
            <button class="copilot-btn-icon" onclick="window.MecaPsiCopilotInstance.toggleSettings()">✕</button>
          </div>
          <div style="font-size:0.8rem;color:#94A3B8;line-height:1.4;margin-bottom:14px;">
            El asistente MecaPsi opera automáticamente con el motor clínico integrado. Si deseas conectar directamente tu propia clave de <strong>Google Gemini API</strong> (Gemini 2.0 Flash), ingrésala a continuación:
          </div>
          <label style="font-size:0.75rem;color:#C7D2FE;font-weight:600;margin-bottom:6px;display:block;">Google Gemini API Key (Opcional):</label>
          <input type="password" id="copilot-gemini-key-input" class="copilot-input" placeholder="AIzaSy..." style="margin-bottom:14px;"/>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm" style="color:#CBD5E1;" onclick="window.MecaPsiCopilotInstance.toggleSettings()">Cancelar</button>
            <button class="btn btn-primary btn-sm" style="background:#4F46E5;color:#fff;padding:6px 14px;border-radius:8px;" onclick="window.MecaPsiCopilotInstance.saveCustomKey()">Guardar Clave</button>
          </div>
        </div>
      `;
      document.body.appendChild(win);

      // Mensaje de bienvenida inicial
      this.addMessage(
        "bot",
        "👋 **¡Hola, colega! Soy tu Asistente Paraclínico MecaPsi.**\n\n" +
        "Mi objetivo es **explicar lo que hay en los datos** de manera objetiva, didáctica y humana, " +
        "respetando el rigor paraclínico y **sin emitir diagnósticos patológicos cerrados**.\n\n" +
        "Puedes preguntarme sobre el significado de cualquier biomarcador (pupilometría, micro-temblor del mouse, tiempos de vacilación en Corsi), " +
        "la calibración de los baremos según la edad cronológica exacta, o cómo traducir estos resultados a los padres de familia."
      );
    }

    toggleWindow() {
      const win = document.getElementById('mecapsi-copilot-window');
      if (!win) return;
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        win.classList.add('open');
        this.refreshContext();
        setTimeout(() => {
          document.getElementById('copilot-input')?.focus();
        }, 100);
      } else {
        win.classList.remove('open');
      }
    }

    toggleSettings() {
      const modal = document.getElementById('copilot-settings-modal');
      const input = document.getElementById('copilot-gemini-key-input');
      if (!modal) return;
      modal.classList.toggle('active');
      if (modal.classList.contains('active') && input) {
        input.value = this.getCustomKey();
      }
    }

    saveCustomKey() {
      const input = document.getElementById('copilot-gemini-key-input');
      if (input) {
        this.setCustomKey(input.value);
        this.toggleSettings();
        this.addMessage("bot", "✅ **Clave de Gemini guardada correctamente.** Tus consultas aprovecharán el modelo de Google AI Studio.");
      }
    }

    refreshContext() {
      const ctxBar = document.getElementById('copilot-ctx-text');
      if (!ctxBar) return;
      const ctx = this.getCurrentContext();
      if (ctx.participant && (ctx.participant.name || ctx.participant.id)) {
        const pName = ctx.participant.name || 'Evaluado';
        const pAge = ctx.participant.chronological_age || `${ctx.participant.age || 25} años`;
        ctxBar.textContent = `👤 Evaluado: ${pName} (${pAge}) · ${ctx.test_type}`;
        ctxBar.style.color = '#38BDF8';
      } else {
        ctxBar.textContent = `🔍 Modo General · ${ctx.test_type || 'PLC Professional'}`;
        ctxBar.style.color = '#A5B4FC';
      }
    }

    addMessage(role, text) {
      const container = document.getElementById('copilot-messages');
      if (!container) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = `copilot-msg ${role}`;
      msgDiv.innerHTML = this.formatMarkdown(text);
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;

      this.history.push({ role, content: text });
    }

    formatMarkdown(text) {
      if (!text) return '';
      // Escape básico y reemplazos simples de markdown
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Negritas **texto**
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Cursivas *texto*
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Listas con viñetas •
      html = html.replace(/\n• (.*?)(?=\n|$)/g, '<div style="margin-left:10px;margin-top:3px;">• $1</div>');
      // Saltos de línea
      html = html.replace(/\n/g, '<br/>');

      return html;
    }

    sendSuggested(text) {
      const input = document.getElementById('copilot-input');
      if (input) {
        input.value = text;
        this.sendMessage();
      }
    }

    async sendMessage() {
      const input = document.getElementById('copilot-input');
      const sendBtn = document.getElementById('copilot-send-btn');
      if (!input || this.isLoading) return;

      const userText = input.value.trim();
      if (!userText) return;

      // 1. Mostrar mensaje del usuario
      this.addMessage("user", userText);
      input.value = '';
      this.isLoading = true;
      if (sendBtn) sendBtn.disabled = true;

      // 2. Indicador visual de pensando
      const container = document.getElementById('copilot-messages');
      const thinkingDiv = document.createElement('div');
      thinkingDiv.id = 'copilot-thinking-indicator';
      thinkingDiv.className = 'copilot-msg bot';
      thinkingDiv.innerHTML = '<span style="color:#38BDF8;">🧠 Analizando paraclínicamente...</span>';
      container.appendChild(thinkingDiv);
      container.scrollTop = container.scrollHeight;

      // 3. Obtener contexto actual
      const ctx = this.getCurrentContext();
      const customKey = this.getCustomKey();

      try {
        const res = await fetch(`${BACKEND_BASE}/api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: this.history.slice(-6),
            context: ctx,
            custom_key: customKey || null
          })
        });

        const data = await res.json();
        thinkingDiv.remove();

        if (data.reply) {
          this.addMessage("bot", data.reply);
        } else {
          this.addMessage("bot", "⚠️ No se recibió respuesta descriptiva. Reintenta la consulta.");
        }
      } catch (err) {
        console.warn("Error comunicando con MecaPsi Copilot:", err);
        thinkingDiv.remove();
        // Fallback local en frontend si no hay conexión de red con el backend
        this.addMessage("bot", "⚠️ No se pudo conectar con el servidor de IA en este instante. Verifica tu conexión a internet o reintenta.");
      } finally {
        this.isLoading = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
      }
    }
  }

  // Inicializar en DOMContentLoaded
  function initCopilot() {
    if (!window.MecaPsiCopilotInstance) {
      window.MecaPsiCopilotInstance = new MecaPsiCopilot();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopilot);
  } else {
    initCopilot();
  }
})();
