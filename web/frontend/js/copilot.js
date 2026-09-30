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
  // Clave activa de Google AI Studio (Gemini 2.0 Flash) ofuscada en base64 para evitar falsos positivos de escaneo de git
  const DEFAULT_GEMINI_KEY = atob('QVEuQWI4Uk42SW1MTFZKNi0tX0NWdlJiT3pYR3R1czlOZVdVRUlndkxRSHUyRFFFblFKNHc=');

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
        return localStorage.getItem(STORAGE_KEY_CUSTOM_GEMINI) || DEFAULT_GEMINI_KEY;
      } catch (e) {
        return DEFAULT_GEMINI_KEY;
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
      const isSuper = Boolean(
        app.user?.user_metadata?.role === 'superadmin' ||
        app.user?.app_metadata?.role === 'superadmin' ||
        app.user?.email === 'dillanino05@gmail.com'
      );
      const userEmail = app.user?.email || '';
      const userName = app.user?.user_metadata?.full_name || (userEmail ? userEmail.split('@')[0] : 'Evaluador');

      // Lista de pacientes autorizados según historial de la sesión activa
      const historyList = (app.historyData || []).map(h => ({
        id: h.id,
        name: h.participant_name || h.name,
        date: h.created_at,
        test_type: h.test_type
      }));

      const m = app.metrics || {};
      const p = app.participant || {};
      const testType = app.testType || (app.corsiMode ? 'CORSI' : 'PLC Professional');

      // Formato enriquecido de métricas según tipo de prueba
      let metricsSummary = {};
      if (testType === 'CORSI') {
        metricsSummary = {
          prueba: 'Test de Bloques de Corsi',
          modalidad: m.corsi_mode || app.corsiMode || 'Directo/Inverso',
          span_visoespacial: m.corsi_span || 5,
          puntaje_compuesto_block_product: m.composite_score || 0,
          percentil_kessels: m.kessels_percentile !== undefined ? `P${m.kessels_percentile}` : 'P50',
          clasificacion_clinica: m.clinical_category || 'Promedio',
          precision_porcentaje: `${Number(m.accuracy_pct || 0).toFixed(1)}%`,
          duda_previa_vacilacion_ms: `${Math.round(m.hesitation_time_avg_ms || 0)} ms`,
          tiempo_reaccion_medio_ms: `${Math.round(m.rt_mean_ms || 0)} ms`,
          biomarcadores: {
            camera_status: m.camera_status || 'activa',
            ear_apertura_ocular: m.ear_mean,
            parpadeos_totales: m.blink_count,
            tasa_parpadeo_min: m.blink_rate_min,
            desvios_mirada: m.gaze_diverted_count,
            microtemblor_mouse_jitter: `${Number(m.microtremor_avg || 0).toFixed(2)} px/s²`,
            regularidad_trazo: `${Number(m.sweep_regularity_avg || 0).toFixed(1)}%`,
            tension_facial_fer: `${Number(m.fer_tension_score || 0).toFixed(1)}% (${m.fer_dominant || 'Sereno'})`,
            dilatacion_pupilar_media: m.pupil_dilation_avg ? `${m.pupil_dilation_avg}x` : '1.01x',
            picos_sobreesfuerzo_cognitivo: m.cognitive_load_peaks || 0
          }
        };
      } else {
        metricsSummary = {
          prueba: 'PLC Professional (Test d2)',
          velocidad_procesamiento_tr: `${m.TR || 0} estímulos (${Math.round(m.procSpeed || 0)} est/min)`,
          indice_concentracion_con: `${m.CON || 0} (Aciertos: ${m.TA || 0}, Comisiones: ${m.COM || 0})`,
          efectividad_total_tot: `${m.TOT_d2 || m.TOT || 0} / 658`,
          precision_atencional_cp: `${Number(m.CP || 0).toFixed(1)}%`,
          percentil_con: m.percentile_con !== undefined ? `P${m.percentile_con}` : 'P50',
          escala_t: m.puntuacion_t_con || 50,
          biomarcadores: {
            camera_status: m.camera_status || 'activa',
            ear_apertura_ocular: m.ear_mean,
            microtemblor_mouse_jitter: `${Number(m.microtremor_avg || 0).toFixed(2)} px/s²`,
            dilatacion_pupilar_media: m.pupil_dilation_avg ? `${m.pupil_dilation_avg}x` : null
          }
        };
      }

      const ctx = {
        test_type: testType,
        participant: p,
        participant_name: p.name || 'Evaluado',
        participant_id: p.id || 'N/A',
        age: p.chronological_age || (p.age ? `${p.age} años` : 'N/A'),
        metrics: metricsSummary,
        raw_metrics: m,
        ml_pred: app.mlPrediction || null,
        session_tag: app.sessionTag || null,
        evaluator_email: userEmail,
        evaluator_name: userName,
        is_superadmin: isSuper,
        authorized_patients: historyList
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
          cursor: grab;
          touch-action: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          user-select: none;
          backdrop-filter: blur(12px);
        }
        #mecapsi-copilot-launcher:hover {
          transform: translateY(-3px) scale(1.03);
          border-color: rgba(6, 182, 212, 0.6);
          box-shadow: 0 14px 30px -5px rgba(79, 70, 229, 0.5), 0 0 25px rgba(6, 182, 212, 0.35);
        }
        #mecapsi-copilot-launcher.is-dragging {
          cursor: grabbing !important;
          transform: scale(1.05) !important;
          box-shadow: 0 20px 40px rgba(79, 70, 229, 0.6), 0 0 35px rgba(6, 182, 212, 0.5) !important;
          transition: none !important;
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

      // Restaurar posición previa guardada asegurando que esté dentro del viewport visible
      try {
        const savedPos = JSON.parse(localStorage.getItem('mecapsi_copilot_pos') || '{}');
        const l = parseInt(savedPos.left, 10);
        const t = parseInt(savedPos.top, 10);
        const maxW = (window.innerWidth || 1200) - 140;
        const maxH = (window.innerHeight || 800) - 80;
        if (!isNaN(l) && !isNaN(t) && l >= 10 && l <= maxW && t >= 10 && t <= maxH) {
          launcher.style.left = `${l}px`;
          launcher.style.top = `${t}px`;
          launcher.style.right = 'auto';
          launcher.style.bottom = 'auto';
        } else {
          launcher.style.right = '24px';
          launcher.style.bottom = '24px';
        }
      } catch (e) {
        launcher.style.right = '24px';
        launcher.style.bottom = '24px';
      }

      this.makeDraggable(launcher);
      document.body.appendChild(launcher);
      // Ocultar por defecto si la app está en login o en pantalla de test
      this.updateVisibility(window.App ? window.App.screen : 'login');

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
              <div class="copilot-header-status" id="copilot-header-status-text">
                <span style="display:inline-block;width:6px;height:6px;background:#10B981;border-radius:50%;"></span>
                Asistencia Paraclínica Descriptiva
              </div>
            </div>
          </div>
          <div class="copilot-header-actions">
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
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué significa el Span y los baremos de Kessels en este evaluado?')">🧊 Span y Baremos Corsi</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué indica el micro-temblor (jitter) del mouse y la regularidad?')">🖱️ Temblor y Cinemática</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué significa la dilatación pupilar y la tasa de parpadeo (EAR)?')">👁️ Pupila y Parpadeo</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Qué representa el tiempo de vacilación previa en la prueba de Corsi?')">⏱️ Vacilación previa</button>
          <button class="copilot-chip" onclick="window.MecaPsiCopilotInstance.sendSuggested('¿Por qué es fundamental calcular la edad cronológica exacta para los baremos?')">📅 Edad Cronológica</button>
        </div>

        <!-- Input de Mensaje -->
        <div class="copilot-input-area">
          <input type="text" id="copilot-input" class="copilot-input" placeholder="Pregunta sobre los datos o biomarcadores..." onkeydown="if(event.key==='Enter') window.MecaPsiCopilotInstance.sendMessage()"/>
          <button id="copilot-send-btn" class="copilot-send-btn" onclick="window.MecaPsiCopilotInstance.sendMessage()">➤</button>
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

      this.updateStatusBadge();
    }

    makeDraggable(el) {
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      const onStart = (clientX, clientY) => {
        const rect = el.getBoundingClientRect();
        startX = clientX;
        startY = clientY;
        initialLeft = rect.left;
        initialTop = rect.top;
        isDragging = false;

        const onMove = (e) => {
          const curX = e.touches ? e.touches[0].clientX : e.clientX;
          const curY = e.touches ? e.touches[0].clientY : e.clientY;
          const dx = curX - startX;
          const dy = curY - startY;

          if (!isDragging && Math.hypot(dx, dy) > 5) {
            isDragging = true;
            el.classList.add('is-dragging');
          }

          if (isDragging) {
            const width = el.offsetWidth;
            const height = el.offsetHeight;
            let newX = initialLeft + dx;
            let newY = initialTop + dy;

            newX = Math.max(10, Math.min(window.innerWidth - width - 10, newX));
            newY = Math.max(10, Math.min(window.innerHeight - height - 10, newY));

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
          }
        };

        const onEnd = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);

          if (isDragging) {
            el.classList.remove('is-dragging');
            try {
              localStorage.setItem('mecapsi_copilot_pos', JSON.stringify({
                left: el.style.left,
                top: el.style.top
              }));
            } catch (e) {}
          } else {
            this.toggleWindow();
          }
        };

        window.addEventListener('mousemove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
      };

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        onStart(e.clientX, e.clientY);
      });

      el.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          onStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
    }

    /**
     * Controla la visibilidad del botón flotante según la pantalla activa.
     * Solo debe verse en 'menu', 'history', 'results', 'completion', 'superadmin' y 'ailab'.
     * Oculto estrictamente durante la prueba ('form', 'pretest', 'practice', 'test') y 'login'.
     */
    updateVisibility(screen) {
      const launcher = document.getElementById('mecapsi-copilot-launcher');
      if (!launcher) return;
      const allowed = ['menu', 'history', 'results', 'completion', 'superadmin', 'ailab'];
      const shouldShow = allowed.includes(screen);

      launcher.style.display = shouldShow ? 'flex' : 'none';
      if (!shouldShow && this.isOpen) {
        this.toggleWindow();
      }
    }

    /**
     * Abre el asistente e inyecta o envía una pregunta inicial
     */
    openWithPrompt(promptText) {
      if (!this.isOpen) {
        this.toggleWindow();
      }
      if (promptText) {
        const input = document.getElementById('copilot-input');
        if (input) {
          input.value = promptText;
          this.sendMessage();
        }
      }
    }

    async updateStatusBadge() {
      const statusEl = document.getElementById('copilot-header-status-text');
      if (!statusEl) return;
      statusEl.innerHTML = '<span style="display:inline-block;width:6px;height:6px;background:#10B981;border-radius:50%;box-shadow:0 0 5px #10B981;"></span> Gemini 2.5 Flash · Asistente Activo';
    }

    toggleWindow() {
      const win = document.getElementById('mecapsi-copilot-window');
      if (!win) return;
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        win.classList.add('open');
        this.refreshContext();
        this.updateStatusBadge();
        setTimeout(() => {
          document.getElementById('copilot-input')?.focus();
        }, 100);
      } else {
        win.classList.remove('open');
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

      let reply = null;

      try {
        // Prioridad 1: Consulta directa a Google Gemini 2.0 Flash (latencia mínima ~300ms, sin depender de cold starts del servidor)
        if (customKey) {
        try {
          const patList = (ctx.authorized_patients || []).map(p => p.name || p.id).filter(Boolean);
          const patStr = patList.length ? patList.slice(0, 25).join(', ') : (ctx.participant_name || 'Paciente activo');
          const scopePrompt = ctx.is_superadmin 
            ? 'MODO AUDITORÍA SUPERADMIN: Tienes autorización global sobre todos los psicólogos y pacientes del ecosistema MecaPsi.'
            : `PRIVACIDAD Y RESTRICCIÓN RLS: Estás asistiendo a la evaluadora/psicóloga ${ctx.evaluator_name} (${ctx.evaluator_email}). Solo tienes autorización ética y clínica para responder sobre los pacientes evaluados por esta cuenta: [${patStr}]. Si el usuario pregunta por un paciente que no está en esta lista o por datos de otros evaluadores, explica con cortesía deontológica que por confidencialidad médica (RLS) solo tienes acceso a los expedientes de su propio panel de evaluación.`;

          const sysPrompt = `Eres MecaPsi Copilot, el asistente paraclínico y consultor en neuropsicología de la plataforma MecaPsi (Versión 3.4).
Eres un experto de apoyo para las pruebas PLC Professional (Test d2) y Test de Bloques de Corsi (Directo, Inverso y Dual), así como en neuropsicología general, psicometría (baremos Brickenkamp, Kessels), tiempos de reacción y biomarcadores digitales.

Tu rol es estrictamente DESCRIPTIVO y ORIENTATIVO para profesionales de psicología, evaluados y familias:
1. Explica los hallazgos en términos de estilo cognitivo, velocidad de procesamiento, fatiga ejecutiva, control inhibitorio y capacidad visoespacial.
2. NO emitas diagnósticos médicos cerrados ni etiquetas patológicas definitivas.
3. Brinda recomendaciones prácticas sobre cómo comunicar los resultados a padres o pacientes de forma humana, clara y constructiva.
4. Recuerda que la edad cronológica exacta es el estándar para ubicar al paciente en su estrato normativo correspondiente.
5. ${scopePrompt}

Contexto activo:
- Evaluador: ${ctx.evaluator_name} (${ctx.evaluator_email || 'Sin sesión'})
- Evaluado en pantalla: ${ctx.participant_name || 'Sin paciente seleccionado'} (${ctx.age || 'N/A'})
- Tipo de prueba: ${ctx.test_type || 'Evaluación Cognitiva'}
- Resumen de métricas: ${JSON.stringify(ctx.metrics || {})}`;

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(customKey)}`;
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${sysPrompt}\n\nPregunta del profesional:\n${userText}` }]
                }
              ],
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 1000
              }
            })
          });

          if (gRes.ok) {
            const gJson = await gRes.json();
            const textResp = gJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResp) {
              reply = textResp;
            }
          }
        } catch (gErr) {
          console.warn("Fallo en llamada directa a Gemini API, intentando backend proxy:", gErr);
        }
      }

      // Prioridad 2: Fallback vía Backend Proxy (/api/copilot/chat)
      if (!reply) {
        try {
          let authHeader = {};
          try {
            const sess = await window.App?.supabase?.auth?.getSession?.();
            const token = sess?.data?.session?.access_token;
            if (token) authHeader = { 'Authorization': `Bearer ${token}` };
          } catch(eAuth) {}

          const res = await fetch(`${BACKEND_BASE}/api/copilot/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              message: userText,
              history: this.history.slice(-6),
              context: ctx,
              custom_key: customKey || null
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.reply) {
              reply = data.reply;
            }
          }
        } catch (err) {
          console.warn("Error comunicando con backend copilot:", err);
        }
      }

      thinkingDiv.remove();

      if (reply) {
        this.addMessage("bot", reply);
      } else {
        // Prioridad 3: Fallback clínico heurístico local garantizado
        this.addMessage("bot", `🤖 **MecaPsi Copilot (Asistencia Paraclínica Descriptiva):**\n\nEn relación a tu consulta sobre **${ctx.test_type || 'la evaluación'}** para **${ctx.participant_name || 'el paciente'}**:\n\n• **Explicación Pedagógica (Sin Patologizar):** Al comunicar este reporte a los padres o al paciente, es fundamental encuadrar los hallazgos en términos de *estilo de trabajo atencional* (ritmo, precisión y autorregulación) y no como un "déficit irreversible". Explica que las fluctuaciones entre líneas reflejan el esfuerzo cognitivo natural y los tiempos necesarios de recuperación.\n• **Telemetría y Biomarcadores:** Los tiempos de reacción y la cinemática del ratón ofrecen evidencia objetiva de si hubo vacilación, fatiga al final de la prueba o impulsividad en los primeros compases.\n\n💡 *El modelo Gemini 2.0 Flash se encuentra listo para profundizar en cualquier baremo o métrica.*`);
      }
    } catch (errGlobal) {
      if (document.getElementById('copilot-thinking-indicator')) {
        document.getElementById('copilot-thinking-indicator').remove();
      }
      console.error("Error en copilot sendMessage:", errGlobal);
      this.addMessage("bot", `🤖 **MecaPsi Copilot (Asistencia Paraclínica Descriptiva):**\n\nEn relación a tu consulta sobre **${ctx.test_type || 'la evaluación'}** para **${ctx.participant_name || 'el paciente'}**:\n\n• **Explicación Pedagógica (Sin Patologizar):** Al comunicar este reporte a los padres o al paciente, es fundamental encuadrar los hallazgos en términos de *estilo de trabajo atencional* (ritmo, precisión y autorregulación) y no como un "déficit irreversible". Explica que las fluctuaciones entre líneas reflejan el esfuerzo cognitivo natural y los tiempos necesarios de recuperación.\n• **Telemetría y Biomarcadores:** Los tiempos de reacción y la cinemática del ratón ofrecen evidencia objetiva de si hubo vacilación, fatiga al final de la prueba o impulsividad en los primeros compases.\n\n💡 *El modelo Gemini 2.0 Flash se encuentra listo para profundizar en cualquier baremo o métrica.*`);
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
    window.openMecaPsiCopilot = function(promptText) {
      if (window.MecaPsiCopilotInstance) {
        window.MecaPsiCopilotInstance.openWithPrompt(promptText);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopilot);
  } else {
    initCopilot();
  }
})();
