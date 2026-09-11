/**
 * Módulo CorsiRunner — Test de Bloques de Corsi (MecaPsi v3.3.4)
 * Evaluación Neuropsicológica de Memoria de Trabajo Visoespacial
 * Protocolo Estandarizado de 9 Bloques (Secuencias Directa e Inversa)
 */
window.CorsiRunner = {
  // Coordenadas relativas (%) de los 9 bloques sobre el tablero espacial
  cubePositions: [
    { x: 14, y: 16 }, { x: 76, y: 14 }, { x: 46, y: 28 },
    { x: 24, y: 48 }, { x: 68, y: 46 }, { x: 86, y: 66 },
    { x: 10, y: 74 }, { x: 44, y: 80 }, { x: 74, y: 82 }
  ],

  // Estado del motor
  container: null,
  testMode: 'direct', // 'direct' | 'inverse'
  currentLevel: 2,
  maxLevel: 9,
  attemptsLeft: 2,
  corsiSpan: 0,
  sequence: [],
  userSequence: [],
  isShowingSequence: false,
  canClick: false,
  activeTimers: [],
  audioCtx: null,

  // Datos métricos y telemetría
  movementsData: [],
  levelSummaries: [],
  levelStartTime: 0,
  sequenceStartTime: 0,
  lastClickTime: 0,
  lastClickCoords: { x: 0, y: 0 },
  errorCount: 0,
  currentSelectedCubes: new Set(),

  // Callbacks de integración
  onFinish: null,
  onAbort: null,

  /**
   * Inicializar sistema de audio sintetizado Web Audio API
   */
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  },

  playTone(frequency, durationMs, type = 'sine') {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (durationMs / 1000));
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + (durationMs / 1000));
    } catch (e) {
      // Ignorar fallos de audio si el navegador bloquea autoplay
    }
  },

  sleep(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      this.activeTimers.push(timer);
    });
  },

  clearTimers() {
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers = [];
  },

  /**
   * Montar e inicializar el runner en el contenedor DOM
   */
  start(containerEl, options = {}) {
    this.container = containerEl;
    this.testMode = options.mode || 'direct';
    this.onFinish = options.onFinish || null;
    this.onAbort = options.onAbort || null;

    this.currentLevel = 2;
    this.attemptsLeft = 2;
    this.corsiSpan = 0;
    this.sequence = [];
    this.userSequence = [];
    this.isShowingSequence = false;
    this.canClick = false;
    this.movementsData = [];
    this.levelSummaries = [];
    this.currentSelectedCubes = new Set();
    this.clearTimers();

    this.renderUI();
    this.startLevel();
  },

  renderUI() {
    const isDirect = this.testMode === 'direct';
    this.container.innerHTML = `
      <div style="background: radial-gradient(circle at center, #1E293B 0%, #0F172A 100%); min-height: calc(100vh - 120px); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; box-shadow: 0 12px 36px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); user-select: none;">
        
        <!-- Barra Superior de Estado SaaS -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: rgba(255,255,255,0.04); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.3rem;">🧊</span>
            <div>
              <div style="font-weight: 700; color: #F8FAFC; font-size: 1rem; letter-spacing: -0.3px;">Test de Bloques de Corsi</div>
              <div style="font-size: 0.75rem; color: ${isDirect ? '#38BDF8' : '#C084FC'}; font-weight: 600; text-transform: uppercase;">
                Modo ${isDirect ? '➡️ Directo (Mismo Orden)' : '🔄 Inverso (Orden Inverso)'}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 20px;">
            <div style="text-align: center;">
              <div style="font-size: 0.68rem; color: #94A3B8; font-weight: 600; text-transform: uppercase;">Longitud (Nivel)</div>
              <div id="corsi-stat-level" style="font-size: 1.25rem; font-weight: 800; color: #38BDF8;">${this.currentLevel}</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.68rem; color: #94A3B8; font-weight: 600; text-transform: uppercase;">Intento</div>
              <div id="corsi-stat-attempt" style="font-size: 1.25rem; font-weight: 800; color: #FBBF24;">${3 - this.attemptsLeft}/2</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.68rem; color: #94A3B8; font-weight: 600; text-transform: uppercase;">Span Actual</div>
              <div id="corsi-stat-span" style="font-size: 1.25rem; font-weight: 800; color: #34D399;">${this.corsiSpan || '-'}</div>
            </div>
            <button id="corsi-abort-btn" class="btn btn-danger btn-sm" style="margin-left: 8px; font-size: 0.78rem; padding: 6px 12px; border-radius: 8px;">
              ⏹️ Detener
            </button>
          </div>
        </div>

        <!-- Banner de Mensaje / Estado -->
        <div id="corsi-banner" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: #E0F2FE; padding: 10px 16px; border-radius: 10px; font-size: 0.92rem; font-weight: 600; text-align: center; margin-bottom: 16px; transition: all 0.3s ease;">
          Preparando secuencia...
        </div>

        <!-- Tablero de los 9 Bloques de Corsi -->
        <div id="corsi-board" style="position: relative; flex: 1; min-height: 520px; background: rgba(15, 23, 42, 0.6); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: inset 0 4px 24px rgba(0,0,0,0.6); overflow: hidden;">
        </div>

        <!-- Footer Informativo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 0.75rem; color: #64748B;">
          <span>Captura continua de telemetría ocular y cinemática activa</span>
          <span>9 Bloques Estandarizados &bull; Memoria de Trabajo</span>
        </div>
      </div>
    `;

    document.getElementById('corsi-abort-btn').onclick = () => {
      if (confirm('¿Deseas finalizar la prueba de Corsi anticipadamente? Se guardarán las métricas hasta este intento.')) {
        this.finishTest();
      }
    };

    this.initBoard();
  },

  initBoard() {
    const board = document.getElementById('corsi-board');
    if (!board) return;
    board.innerHTML = '';

    this.cubePositions.forEach((pos, idx) => {
      const cube = document.createElement('div');
      cube.id = `corsi-cube-${idx}`;
      cube.className = 'corsi-cube';
      cube.dataset.id = idx;
      
      cube.style.position = 'absolute';
      cube.style.left = `calc(${pos.x}% - 40px)`;
      cube.style.top = `calc(${pos.y}% - 40px)`;
      cube.style.width = '80px';
      cube.style.height = '80px';
      cube.style.borderRadius = '14px';
      cube.style.background = 'linear-gradient(145deg, #334155 0%, #1E293B 100%)';
      cube.style.border = '2px solid rgba(148, 163, 184, 0.2)';
      cube.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15)';
      cube.style.display = 'flex';
      cube.style.alignItems = 'center';
      cube.style.justifyContent = 'center';
      cube.style.cursor = 'pointer';
      cube.style.transition = 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)';
      cube.style.userSelect = 'none';

      // Etiqueta del bloque (sutil)
      const label = document.createElement('span');
      label.textContent = idx + 1;
      label.style.fontSize = '1.2rem';
      label.style.fontWeight = '700';
      label.style.color = 'rgba(255, 255, 255, 0.35)';
      cube.appendChild(label);

      cube.onmouseenter = () => {
        if (this.canClick && !this.isShowingSequence && !this.currentSelectedCubes.has(idx)) {
          cube.style.transform = 'translateY(-3px) scale(1.04)';
          cube.style.borderColor = 'rgba(56, 189, 248, 0.6)';
          cube.style.boxShadow = '0 12px 28px rgba(56, 189, 248, 0.2)';
        }
      };

      cube.onmouseleave = () => {
        if (!cube.classList.contains('active') && !cube.classList.contains('selected')) {
          cube.style.transform = 'translateY(0) scale(1)';
          cube.style.borderColor = 'rgba(148, 163, 184, 0.2)';
          cube.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15)';
        }
      };

      cube.onclick = (e) => this.handleCubeClick(idx, e);

      board.appendChild(cube);
    });
  },

  setBanner(text, type = 'info') {
    const banner = document.getElementById('corsi-banner');
    if (!banner) return;
    banner.textContent = text;
    if (type === 'info') {
      banner.style.background = 'rgba(56, 189, 248, 0.12)';
      banner.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      banner.style.color = '#E0F2FE';
    } else if (type === 'success') {
      banner.style.background = 'rgba(16, 185, 129, 0.15)';
      banner.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      banner.style.color = '#D1FAE5';
    } else if (type === 'error') {
      banner.style.background = 'rgba(239, 68, 68, 0.18)';
      banner.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      banner.style.color = '#FEE2E2';
    } else if (type === 'warning') {
      banner.style.background = 'rgba(245, 158, 11, 0.15)';
      banner.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      banner.style.color = '#FEF3C7';
    }
  },

  updateStats() {
    const lvlEl = document.getElementById('corsi-stat-level');
    const attEl = document.getElementById('corsi-stat-attempt');
    const spnEl = document.getElementById('corsi-stat-span');
    if (lvlEl) lvlEl.textContent = this.currentLevel;
    if (attEl) attEl.textContent = `${3 - this.attemptsLeft}/2`;
    if (spnEl) spnEl.textContent = this.corsiSpan || '-';
  },

  clearSelection() {
    this.currentSelectedCubes.clear();
    this.userSequence = [];
    document.querySelectorAll('.corsi-cube').forEach(c => {
      c.classList.remove('active', 'selected', 'error');
      c.style.background = 'linear-gradient(145deg, #334155 0%, #1E293B 100%)';
      c.style.borderColor = 'rgba(148, 163, 184, 0.2)';
      c.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15)';
      c.style.transform = 'scale(1)';
    });
  },

  async startLevel() {
    this.canClick = false;
    this.clearSelection();
    this.updateStats();

    this.levelStartTime = Date.now();
    this.errorCount = 0;

    // Generar secuencia aleatoria sin repetición de cubos
    const available = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    this.sequence = [];
    for (let i = 0; i < this.currentLevel; i++) {
      const rIdx = Math.floor(Math.random() * available.length);
      this.sequence.push(available[rIdx]);
      available.splice(rIdx, 1);
    }

    this.setBanner(`Nivel ${this.currentLevel} (Intento ${3 - this.attemptsLeft}/2): Observa atentamente la secuencia iluminada...`, 'info');
    await this.sleep(900);
    await this.showSequence();
  },

  async showSequence() {
    this.isShowingSequence = true;
    this.sequenceStartTime = Date.now();

    for (let i = 0; i < this.sequence.length; i++) {
      const cubeId = this.sequence[i];
      const cubeEl = document.getElementById(`corsi-cube-${cubeId}`);
      if (cubeEl) {
        cubeEl.classList.add('active');
        cubeEl.style.background = 'linear-gradient(145deg, #00D4FF 0%, #0284C7 100%)';
        cubeEl.style.borderColor = '#FFFFFF';
        cubeEl.style.boxShadow = '0 0 35px rgba(0, 212, 255, 0.8), inset 0 2px 4px rgba(255,255,255,0.5)';
        cubeEl.style.transform = 'scale(1.12)';
        this.playTone(520 + (cubeId * 45), 240);
      }

      await this.sleep(750);

      if (cubeEl) {
        cubeEl.classList.remove('active');
        cubeEl.style.background = 'linear-gradient(145deg, #334155 0%, #1E293B 100%)';
        cubeEl.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        cubeEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15)';
        cubeEl.style.transform = 'scale(1)';
      }

      await this.sleep(300);
    }

    this.isShowingSequence = false;
    this.canClick = true;
    this.lastClickTime = Date.now();

    const isDirect = this.testMode === 'direct';
    this.setBanner(
      isDirect 
        ? `▶️ Tu turno: Haz clic en los cubos en el MISMO ORDEN en que se iluminaron (${this.sequence.length} cubos)` 
        : `▶️ Tu turno: Haz clic en los cubos en ORDEN INVERSO (del último al primero) (${this.sequence.length} cubos)`,
      'success'
    );
  },

  async handleCubeClick(cubeId, event) {
    if (!this.canClick || this.isShowingSequence) return;
    if (this.currentSelectedCubes.has(cubeId)) return;

    const now = Date.now();
    const cubeEl = document.getElementById(`corsi-cube-${cubeId}`);

    // Cálculo de latencia y titubeo
    const reactionTime = this.userSequence.length === 0 ? (now - this.lastClickTime) : (now - this.lastClickTime);
    const rect = this.container.getBoundingClientRect();
    const coords = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const distance = this.lastClickCoords.x 
      ? Math.hypot(coords.x - this.lastClickCoords.x, coords.y - this.lastClickCoords.y) 
      : 0;

    this.lastClickTime = now;
    this.lastClickCoords = coords;

    // Cubo esperado según modo
    let expectedCube;
    if (this.testMode === 'direct') {
      expectedCube = this.sequence[this.userSequence.length];
    } else {
      expectedCube = this.sequence[this.sequence.length - 1 - this.userSequence.length];
    }

    const isCorrect = (cubeId === expectedCube);

    // Registro de evento
    this.movementsData.push({
      timestamp: new Date().toISOString(),
      event_type: 'cube_click',
      level: this.currentLevel,
      cube_id: cubeId + 1,
      sequence_position: this.userSequence.length + 1,
      expected_cube: expectedCube + 1,
      is_correct: isCorrect,
      reaction_time_ms: Math.max(1, reactionTime),
      distance_px: Math.round(distance),
      x_coord: Math.round(coords.x),
      y_coord: Math.round(coords.y)
    });

    if (isCorrect) {
      this.currentSelectedCubes.add(cubeId);
      this.userSequence.push(cubeId);
      if (cubeEl) {
        cubeEl.classList.add('selected');
        cubeEl.style.background = 'linear-gradient(145deg, #10B981 0%, #059669 100%)';
        cubeEl.style.borderColor = '#34D399';
        cubeEl.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.7)';
        cubeEl.style.transform = 'scale(1.08)';
      }
      this.playTone(680, 150);

      // ¿Completó toda la secuencia con éxito?
      if (this.userSequence.length === this.sequence.length) {
        await this.handleLevelSuccess();
      }
    } else {
      this.errorCount++;
      if (cubeEl) {
        cubeEl.classList.add('error');
        cubeEl.style.background = 'linear-gradient(145deg, #EF4444 0%, #DC2626 100%)';
        cubeEl.style.borderColor = '#F87171';
        cubeEl.style.boxShadow = '0 0 30px rgba(239, 68, 68, 0.8)';
      }
      this.playTone(240, 300, 'sawtooth');
      await this.sleep(450);
      await this.handleLevelError();
    }
  },

  async handleLevelSuccess() {
    this.canClick = false;
    const totalTime = Date.now() - this.levelStartTime;
    if (this.currentLevel > this.corsiSpan) {
      this.corsiSpan = this.currentLevel;
    }

    const levelClicks = this.movementsData.filter(m => m.level === this.currentLevel);
    const rts = levelClicks.map(m => m.reaction_time_ms).filter(t => t > 0);
    const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
    const hesitation = rts.length ? rts[0] : 0;

    this.levelSummaries.push({
      level: this.currentLevel,
      attempt: 3 - this.attemptsLeft,
      sequence_length: this.currentLevel,
      sequence_presented: this.sequence.map(i => i + 1),
      sequence_user: this.userSequence.map(i => i + 1),
      success: true,
      total_time_ms: totalTime,
      avg_reaction_time_ms: avgRt,
      hesitation_time_ms: hesitation,
      error_count: this.errorCount,
      test_mode: this.testMode
    });

    this.setBanner(`¡Excelente! Secuencia de ${this.currentLevel} cubos completada correctamente. ✅`, 'success');
    this.updateStats();

    await this.sleep(1200);

    if (this.currentLevel < this.maxLevel) {
      this.currentLevel++;
      this.attemptsLeft = 2;
      this.startLevel();
    } else {
      this.finishTest();
    }
  },

  async handleLevelError() {
    this.canClick = false;
    this.attemptsLeft--;
    this.updateStats();

    this.levelSummaries.push({
      level: this.currentLevel,
      attempt: 2 - this.attemptsLeft,
      sequence_length: this.currentLevel,
      sequence_presented: this.sequence.map(i => i + 1),
      sequence_user: this.userSequence.map(i => i + 1),
      success: false,
      total_time_ms: Date.now() - this.levelStartTime,
      error_count: this.errorCount,
      test_mode: this.testMode
    });

    if (this.attemptsLeft > 0) {
      this.setBanner(`Secuencia incorrecta ❌ Tienes 1 intento restante para el Nivel ${this.currentLevel}.`, 'warning');
      await this.sleep(1400);
      this.clearSelection();
      await this.showSequence();
    } else {
      this.setBanner(`Fin de la prueba: Se agotaron los intentos en el Nivel ${this.currentLevel}.`, 'error');
      await this.sleep(1500);
      this.finishTest();
    }
  },

  finishTest() {
    this.canClick = false;
    this.clearTimers();

    const finalData = {
      testMode: this.testMode,
      corsiSpan: this.corsiSpan,
      maxLevelReached: this.currentLevel,
      levelSummaries: this.levelSummaries,
      movementsData: this.movementsData
    };

    if (typeof this.onFinish === 'function') {
      this.onFinish(finalData);
    }
  }
};
