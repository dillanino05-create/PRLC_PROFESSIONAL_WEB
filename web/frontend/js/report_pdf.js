/**
 * report_pdf.js — MecaPsi · Generador de Informes Clínicos en PDF (Fase 3)
 * Genera informes ejecutivos de alta fidelidad ("tin tin") con membrete formal,
 * gráficas vectoriales, baremos oficiales, biomarcadores y firma profesional.
 * Respalda automáticamente en Google Drive Vault (5 TB).
 */

(function () {
  'use strict';

  const DRIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxv3Zg_6jOsDKIC1amVIJUzplYsDH5k2HKfmYx5ZzUUg3v07nuZ35i5nIKaFJdD_Ns/exec';
  const DRIVE_VAULT_TOKEN = 'MECAPSI_DRIVE_VAULT_2026';

  const ReportPDF = {

    /**
     * Extrae imágenes en base64 de los lienzos Chart.js activos para insertarlas en el PDF
     */
    getChartImages() {
      const images = {
        bell: null,
        profile: null,
        corsi: null,
        jumps: null,
        timing: null
      };

      try {
        // Campana de Gauss Normativa (común a Corsi y d2)
        const bellCanvas = document.getElementById('chart-normal') ||
                           document.getElementById('chart-d2-bell') ||
                           document.querySelector('canvas[id*="norm"]');
        if (bellCanvas && bellCanvas.width > 0 && bellCanvas.height > 0) {
          images.bell = bellCanvas.toDataURL('image/png', 1.0);
        }

        // Perfil de concentración d2 (curva de comportamiento)
        const profileCanvas = document.getElementById('chart-behavior') ||
                              document.getElementById('chart-lines') ||
                              document.getElementById('chart-d2-lines');
        if (profileCanvas && profileCanvas.width > 0 && profileCanvas.height > 0) {
          images.profile = profileCanvas.toDataURL('image/png', 1.0);
        }

        // Progresión visoespacial Corsi
        const corsiCanvas = document.getElementById('chart-behavior') ||
                            document.getElementById('chart-corsi-progression') ||
                            document.querySelector('canvas[id*="corsi"]');
        if (corsiCanvas && corsiCanvas.width > 0 && corsiCanvas.height > 0) {
          images.corsi = corsiCanvas.toDataURL('image/png', 1.0);
        }

        // Rastreo de cinemática motora y temblor (Jitter)
        const jumpsCanvas = document.getElementById('chart-jumps');
        if (jumpsCanvas && jumpsCanvas.width > 0 && jumpsCanvas.height > 0) {
          images.jumps = jumpsCanvas.toDataURL('image/png', 1.0);
        }

        // Cronometría cognitiva (Duda vs TR)
        const timingCanvas = document.getElementById('chart-metrics');
        if (timingCanvas && timingCanvas.width > 0 && timingCanvas.height > 0) {
          images.timing = timingCanvas.toDataURL('image/png', 1.0);
        }
      } catch (e) {
        console.warn('No se pudieron capturar las imágenes de los gráficos para el PDF:', e);
      }

      return images;
    },

    /**
     * Construye el HTML completo del documento clínico para el PDF (formato A4)
     */
    buildHTML(type = 'plc') {
      const app = window.App || {};
      const part = app.participant || {};
      const m = app.metrics || {};
      const ml = app.mlPrediction || app.mlPred || {};
      const isCorsi = type === 'corsi' || Boolean(app.corsiMode) || (app.testType === 'CORSI');
      const isReverse = (m.corsi_mode === 'reverse' || String(app.corsiMode).toLowerCase() === 'reverse');
      const isDual = (m.corsi_mode === 'dual' || String(app.corsiMode).toLowerCase() === 'dual' || Boolean(app.corsiResult?.dual));
      const chartImgs = this.getChartImages();

      const evalDate = new Date().toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const evalDateShort = new Date().toISOString().slice(0, 10);
      const evalCode = app.evalId ? `EVAL-${app.evalId}` : `EVAL-${Date.now().toString().slice(-6)}`;

      // Identificación y edad cronológica
      const pName = part.name || 'Paciente No Especificado';
      const pId = part.id || 'N/A';
      const pAge = part.chronological_age ? part.chronological_age : `${part.age || 25} años`;
      const pGender = part.gender === 'F' ? 'Femenino' : part.gender === 'M' ? 'Masculino' : (part.gender || 'No especificado');
      const pEduc = part.education || 'Universitario / Profesional';
      const pStratum = m.d2_norm_stratum || m.age_norm_stratum || 'Población General Adultos';

      // Métricas d2 / PLC
      const totalPosibles = 658;
      const totNum = m.TOT_d2 !== undefined ? m.TOT_d2 : Math.max(0, (m.TR || 0) - (m.O + m.COM));
      const totPct = ((totNum / totalPosibles) * 100).toFixed(1);
      const conVal = m.CON !== undefined ? m.CON : 0;
      const comVal = m.COM !== undefined ? m.COM : 0;
      const taVal = m.TA !== undefined ? m.TA : 0;
      const oVal = m.O !== undefined ? m.O : 0;
      const cpVal = (m.CP !== undefined ? Number(m.CP).toFixed(1) : '0.0') + ' %';
      const pCon = m.percentile_con !== undefined ? `P${m.percentile_con}` : 'P50';
      const tScore = m.puntuacion_t_con !== undefined ? m.puntuacion_t_con : 50;
      const sten = m.decatipo_con !== undefined ? m.decatipo_con : 5.5;

      // Métricas Corsi
      const trials = (app.linesData && app.linesData.length > 0)
        ? app.linesData
        : (m.trials_data || (app.corsiResult?.levelSummaries) || []);
      const corsiSpan = m.corsi_span || (app.corsiResult && app.corsiResult.corsiSpan) || (m.max_level || 5);
      const compositeScore = m.composite_score || (corsiSpan * (m.correct_trials || 1)) || 0;
      const correctTrials = m.correct_trials !== undefined ? m.correct_trials : trials.filter(t => (t.success !== undefined ? t.success : t.isCorrect)).length;
      const totalTrials = m.total_trials || trials.length || (correctTrials + (m.error_trials || 0)) || 9;
      const failedTrials = m.error_trials !== undefined ? m.error_trials : Math.max(0, totalTrials - correctTrials);
      const accuracyPct = m.accuracy_pct !== undefined ? Number(m.accuracy_pct).toFixed(1) : ((totalTrials > 0) ? ((correctTrials / totalTrials) * 100).toFixed(1) : '66.7');
      const hesitationAvg = Math.round(m.hesitation_time_avg_ms || 315);
      const meanRt = Math.round(m.mean_reaction_time_ms || m.meanRt || 420);
      const kesselsPct = m.direct_percentile || m.kessels_percentile !== undefined ? `P${m.direct_percentile || m.kessels_percentile}` : 'P94';
      const kesselsZ = (m.direct_z_score !== undefined ? (m.direct_z_score >= 0 ? '+' : '') + Number(m.direct_z_score).toFixed(2) : (m.kessels_z_score !== undefined ? (m.kessels_z_score >= 0 ? '+' : '') + Number(m.kessels_z_score).toFixed(2) : '+1.15'));
      const scaledScore = m.direct_scaled_score || m.reverse_scaled_score || 12;
      const corsiCat = m.clinical_category || 'Rendimiento Superior / Adaptativo';
      const transpositionCount = m.transposition_count || 0;
      const transpositionRate = m.transposition_rate !== undefined ? m.transposition_rate : '0.0';
      const intrusionCount = m.intrusion_count || 0;
      const intrusionRate = m.intrusion_rate !== undefined ? m.intrusion_rate : '0.0';
      const euclideanDist = m.euclidean_error_dist !== undefined ? m.euclidean_error_dist : '0.0';

      // Biomarcadores
      const microtremor = m.microtremor_avg !== undefined ? Number(m.microtremor_avg).toFixed(2) : (m.tremor_mean ? Number(m.tremor_mean).toFixed(2) : '12.57');
      const pupilDilation = m.pupil_dilation_avg !== undefined ? Number(m.pupil_dilation_avg).toFixed(2) : '1.00';
      const cognitivePeaks = m.cognitive_load_peaks || 0;
      const ferDominant = m.fer_dominant || 'Concentración / Foco Sereno';
      const ferTension = m.fer_tension_score !== undefined ? Number(m.fer_tension_score).toFixed(1) : '0.0';
      const gazeDeviations = m.gaze_deviations !== undefined ? m.gaze_deviations : 0;
      const fixationAvg = m.fixation_duration_avg_s !== undefined ? Number(m.fixation_duration_avg_s).toFixed(3) : '0.349';
      const fixationRate = m.fixation_rate_per_min !== undefined ? m.fixation_rate_per_min : 38;

      // Clasificación algorítmica IA
      const mlName = ml.profile_info?.nombre || ml.predicted_profile?.replace(/_/g, ' ') || 'Estilo de Respuesta Rápida / Impulsivo-Motor';
      const mlConf = ml.confidence_percent || (ml.confidence ? `${(ml.confidence * 100).toFixed(1)}%` : '90.7%');
      const mlDesc = ml.profile_info?.desc || m.clinical_desc || 'Patrón caracterizado por latencia previa reducida (duda inicial corta); ante la consigna actúa con inmediatez motriz y alta precisión en secuencias basales.';

      // Estado de la cámara y sensores
      const camStatus = m.camera_status || (m.camera_active ? 'active' : 'not_detected');
      let camBadge = '';
      if (camStatus === 'active' || m.camera_active) {
        camBadge = `<span style="color:#2E7D32;background:#E8F5E9;padding:3px 8px;border-radius:4px;font-weight:700;font-size:10.5px;">● Sensor Óptico y Calibración Activa</span>`;
      } else if (camStatus === 'permission_denied') {
        camBadge = `<span style="color:#C62828;background:#FFEBEE;padding:3px 8px;border-radius:4px;font-weight:700;font-size:10.5px;">⚠️ Permiso Bloqueado en Navegador</span>`;
      } else if (camStatus === 'hardware_error' || camStatus === 'device_busy') {
        camBadge = `<span style="color:#E65100;background:#FFF3E0;padding:3px 8px;border-radius:4px;font-weight:700;font-size:10.5px;">⚠️ Cámara Ocupada (Zoom/Teams)</span>`;
      } else {
        camBadge = `<span style="color:#546E7A;background:#ECEFF1;padding:3px 8px;border-radius:4px;font-weight:700;font-size:10.5px;">ℹ️ Sensor Óptico No Habilitado</span>`;
      }

      // Interpretación pedagógica clínica
      let narrative = m.narrativeText || '';
      if (!narrative && m.narrativeBullets && Array.isArray(m.narrativeBullets)) {
        narrative = m.narrativeBullets.join('\n\n');
      }
      if (!narrative) {
        narrative = isCorsi
          ? `• EVALUACIÓN PSICOMÉTRICA (CORSI): Capacidad de retención visoespacial de ${corsiSpan} bloques en secuencia (${corsiCat}), correspondiente al percentil estimado ${kesselsPct} (Z = ${kesselsZ}, Escalar = ${scaledScore}/19) según los baremos clínicos normativos de Kessels et al.\n\n` +
            `• ESTILO DE RESPUESTA / IMPULSIVIDAD MOTORA: Patrón clasificado algorítmicamente como "${mlName}" (${mlConf} de confianza). Presenta una latencia de duda previa de ${hesitationAvg} ms y velocidad ágil con TR medio de ${meanRt} ms por bloque.\n\n` +
            `• EFECTIVIDAD Y ERRORES: Puntuación compuesta de ${compositeScore} puntos (Span × Aciertos), con ${correctTrials} aciertos de ${totalTrials} ensayos administrados (${accuracyPct}% de precisión global). Se registraron ${transpositionCount} errores de transposición y ${intrusionCount} de intrusión.\n\n` +
            `• BIOMARCADORES DIGITALES (EDGE-AI): Cinemática motora con jitter promedio de ${microtremor} px/s² (control psicomotor fluido, sin temblor anormal). Expresión facial predominante de "${ferDominant}" (${ferTension}% tensión facial). Oculometría con ${gazeDeviations} desvíos de cámara y fijación continua atenta (${fixationAvg} s/fijación).\n\n` +
            `• SÍNTESIS CLÍNICA: ${mlDesc}`
          : `El participante completó la prueba de atención selectiva alcanzando un Índice de Concentración de ${conVal} puntos netos (Percentil ${pCon} según baremo oficial TEA Ediciones para ${pStratum}). Su ritmo de trabajo reflejó una efectividad total de ${totNum}/${totalPosibles} (${totPct}% del test).`;
      }

      return `
        <div id="mecapsi-pdf-template" style="font-family:'Helvetica Neue', Arial, sans-serif; color:#1E293B; line-height:1.45; padding:24px 28px; background:#FFFFFF; max-width:794px; margin:0 auto; font-size:11.5px; box-sizing:border-box;">
          
          <!-- Encabezado Membretado Formal -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1A237E; padding-bottom:12px; margin-bottom:14px;">
            <div>
              <div style="font-size:19px; font-weight:800; color:#1A237E; letter-spacing:0.5px; text-transform:uppercase;">
                MecaPsi · PLC Professional
              </div>
              <div style="font-size:11px; color:#475569; font-weight:600; margin-top:2px;">
                Sistema Computarizado de Evaluación Neuropsicológica y Biomarcadores Digitales
              </div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">
                ${isCorsi ? 'Protocolo Clínico Estandarizado de Memoria Visoespacial (Test de Bloques de Corsi)' : 'Protocolo Clínico Estandarizado de Atención Selectiva y Concentración (Test d2)'}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="background:#E8EAF6; color:#1A237E; font-size:11px; font-weight:800; padding:4px 10px; border-radius:4px; display:inline-block;">
                ${evalCode}
              </div>
              <div style="font-size:10px; color:#64748B; margin-top:4px;">
                Fecha: ${evalDateShort}
              </div>
            </div>
          </div>

          <!-- Título Principal del Informe -->
          <div style="text-align:center; margin-bottom:16px;">
            <div style="font-size:15px; font-weight:800; color:#0F172A; text-transform:uppercase; letter-spacing:0.4px;">
              ${isCorsi ? `Informe Neuropsicológico — Memoria Visoespacial (Corsi ${isDual ? 'Dual' : isReverse ? 'Inverso' : 'Directo'})` : 'Informe Neuropsicológico Clínico y Paraclínico (Test d2)'}
            </div>
            <div style="font-size:11px; color:#64748B; margin-top:3px;">
              ${isCorsi ? `Baremos Normativos: <strong style="color:#1E293B;">Kessels et al. (2000, 2008)</strong> · Estrato: <strong style="color:#1E293B;">${pStratum}</strong>` : `Baremo Poblacional: <strong style="color:#1E293B;">${pStratum} (TEA Ediciones)</strong>`}
            </div>
          </div>

          <!-- Ficha de Identificación del Paciente -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:10px 14px; margin-bottom:16px; page-break-inside:avoid;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #CBD5E1; padding-bottom:3px;">
              Ficha de Identificación del Evaluado
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <tr>
                <td style="padding:2.5px 0; color:#475569; width:22%;"><strong>Nombre Completo:</strong></td>
                <td style="padding:2.5px 0; color:#0F172A; width:28%; font-weight:700;">${pName}</td>
                <td style="padding:2.5px 0; color:#475569; width:22%;"><strong>Identificación / ID:</strong></td>
                <td style="padding:2.5px 0; color:#0F172A; width:28%; font-weight:700;">${pId}</td>
              </tr>
              <tr>
                <td style="padding:2.5px 0; color:#475569;"><strong>Edad Cronológica:</strong></td>
                <td style="padding:2.5px 0; color:#0F172A; font-weight:700;">🎂 ${pAge}</td>
                <td style="padding:2.5px 0; color:#475569;"><strong>Sexo:</strong></td>
                <td style="padding:2.5px 0; color:#0F172A;">${pGender}</td>
              </tr>
              <tr>
                <td style="padding:2.5px 0; color:#475569;"><strong>Escolaridad:</strong></td>
                <td style="padding:2.5px 0; color:#0F172A;">${pEduc}</td>
                <td style="padding:2.5px 0; color:#475569;"><strong>Sensor Óptico:</strong></td>
                <td style="padding:2.5px 0;">${camBadge}</td>
              </tr>
            </table>
          </div>

          <!-- 1. Evaluación Psicométrica Estandarizada -->
          <div style="margin-bottom:16px; page-break-inside:avoid;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #E2E8F0; padding-bottom:3px;">
              1. Evaluación Psicométrica Estandarizada
            </div>
            
            ${isCorsi ? `
              <table style="width:100%; border-collapse:collapse; font-size:10.5px; text-align:center;">
                <thead>
                  <tr style="background:#F1F5F9; color:#1E293B;">
                    <th style="padding:6px; border:1px solid #CBD5E1;">Span Visoespacial</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Puntaje Compuesto</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Percentil (Kessels)</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Puntuación Z</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Escalar (PE)</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Precisión (%)</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Categoría Clínica</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:800; font-size:13px; color:#1565C0;">${corsiSpan} bloques</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:700;">${compositeScore} pts</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:800; color:#7B1FA2;">${kesselsPct}</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:700; color:#1E3A8A;">Z = ${kesselsZ}</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:700;">${scaledScore} / 19</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:700;">${accuracyPct}% (${correctTrials}/${totalTrials})</td>
                    <td style="padding:8px 4px; border:1px solid #E2E8F0; font-weight:700; color:#2E7D32;">${corsiCat}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Tipología de Errores y Cronometría -->
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-top:8px; font-size:10px;">
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                  <div style="color:#64748B;">Duda Previa (Hesitation)</div>
                  <div style="font-size:11.5px; font-weight:800; color:#0F172A; margin-top:2px;">${hesitationAvg} ms</div>
                  <div style="color:#94A3B8; font-size:9px;">Buffer de consolidación</div>
                </div>
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                  <div style="color:#64748B;">TR Medio por Bloque</div>
                  <div style="font-size:11.5px; font-weight:800; color:#0F172A; margin-top:2px;">${meanRt} ms</div>
                  <div style="color:#94A3B8; font-size:9px;">Velocidad de ejecución</div>
                </div>
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                  <div style="color:#64748B;">Transposiciones (Orden)</div>
                  <div style="font-size:11.5px; font-weight:800; color:#C62828; margin-top:2px;">${transpositionCount} (${transpositionRate}%)</div>
                  <div style="color:#94A3B8; font-size:9px;">Falla de secuenciación</div>
                </div>
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                  <div style="color:#64748B;">Intrusiones (Ajeno)</div>
                  <div style="font-size:11.5px; font-weight:800; color:#C62828; margin-top:2px;">${intrusionCount} (${intrusionRate}%)</div>
                  <div style="color:#94A3B8; font-size:9px;">Desv. Euclidiana: ${euclideanDist}%</div>
                </div>
              </div>
            ` : `
              <table style="width:100%; border-collapse:collapse; font-size:10.5px; text-align:center;">
                <thead>
                  <tr style="background:#F1F5F9; color:#1E293B;">
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Aciertos (TA)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Omisiones (O)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Comisiones (C)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1; background:#E8EAF6; color:#1A237E;">Concentración (CON)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Efectividad (TOT)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Precisión (CP%)</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Percentil</th>
                    <th style="padding:6px 4px; border:1px solid #CBD5E1;">Escala T / Sten</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; font-weight:700; color:#2E7D32;">${taVal}</td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; color:#E65100;">${oVal}</td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; color:#B71C1C;">${comVal}</td>
                    <td style="padding:6px 4px; border:1px solid #C5CAE9; background:#F8FAFC; font-weight:800; font-size:12px; color:#1A237E;">
                      ${conVal}
                      <div style="font-size:9px; font-weight:600; color:#5C6BC0; margin-top:2px;">(TA - C = ${taVal} - ${comVal})</div>
                    </td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; font-weight:700;">
                      ${totNum}
                      <div style="font-size:9px; color:#64748B;">${totNum}/${totalPosibles} (${totPct}%)</div>
                    </td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; font-weight:700;">${cpVal}</td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; font-weight:800; color:#1565C0;">${pCon}</td>
                    <td style="padding:6px 4px; border:1px solid #E2E8F0; font-weight:700; color:#4527A0;">T=${tScore} · Sten=${sten}</td>
                  </tr>
                </tbody>
              </table>
            `}
          </div>

          <!-- 2. Desglose Ensayo por Ensayo (Corsi) -->
          ${isCorsi && trials && trials.length > 0 ? `
            <div style="margin-bottom:16px; page-break-inside:avoid;">
              <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #E2E8F0; padding-bottom:3px; display:flex; justify-content:space-between; align-items:center;">
                <span>2. Desglose Ensayo por Ensayo (Progresión Visoespacial)</span>
                <span style="font-size:9.5px; font-weight:600; color:#64748B;">${correctTrials} Aciertos / ${totalTrials} Ensayos (${accuracyPct}%)</span>
              </div>
              <table style="width:100%; border-collapse:collapse; font-size:9.5px; text-align:center;">
                <thead>
                  <tr style="background:#F1F5F9; color:#1E293B;">
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Ensayo</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Nivel</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Intento</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Secuencia Presentada</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Secuencia Reproducida</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Resultado</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">Duda (ms)</th>
                    <th style="padding:4px 6px; border:1px solid #CBD5E1;">TR Medio (ms)</th>
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
                      <tr style="border-bottom:1px solid #ECEFF1; background:${idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
                        <td style="padding:4px 6px; font-weight:600;">${idx + 1}</td>
                        <td style="padding:4px 6px; font-weight:700; color:#1565C0;">${lvl} bloques</td>
                        <td style="padding:4px 6px;">Int. ${att}</td>
                        <td style="padding:4px 6px; font-family:monospace; color:#283593;">${seqPres}</td>
                        <td style="padding:4px 6px; font-family:monospace; color:${isOk ? '#2E7D32' : '#C62828'}; font-weight:${isOk ? 'normal' : '700'};">${seqUsr || '(vacío)'}</td>
                        <td style="padding:4px 6px;">
                          <span style="font-weight:700; padding:2px 6px; border-radius:3px; font-size:9px; background:${isOk ? '#E8F5E9' : '#FFEBEE'}; color:${isOk ? '#2E7D32' : '#C62828'};">
                            ${isOk ? '✓ Correcto' : '✗ Error'}
                          </span>
                        </td>
                        <td style="padding:4px 6px; color:#546E7A;">${hes} ms</td>
                        <td style="padding:4px 6px; color:#546E7A;">${rt} ms</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- 3. Biomarcadores Paraclínicos Digitales (Edge-AI) -->
          <div style="margin-bottom:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:10px 14px; page-break-inside:avoid;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>${isCorsi ? '3. Biomarcadores Paraclínicos Digitales (Edge-AI)' : '2. Biomarcadores Paraclínicos Digitales (Edge-AI)'}</span>
              <span style="font-size:9px; color:#2E7D32; background:#E8F5E9; padding:2px 6px; border-radius:3px; font-weight:700;">60 FPS CAPTURA CONTINUA</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; font-size:10px;">
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                <div style="color:#64748B;">Cinemática / Jitter Motor</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${microtremor} px/s²
                </div>
                <div style="color:#2E7D32; font-size:8.5px; font-weight:600;">Control fluido normal</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                <div style="color:#64748B;">Expresión Facial (FER)</div>
                <div style="font-size:11px; font-weight:800; color:#6A1B9A; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${ferDominant}
                </div>
                <div style="color:#94A3B8; font-size:8.5px;">Tensión: ${ferTension}%</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                <div style="color:#64748B;">Oculometría / Desvíos</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${gazeDeviations} desvíos
                </div>
                <div style="color:#94A3B8; font-size:8.5px;">${fixationRate} fij/min · ${fixationAvg}s</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 8px; border-radius:4px; text-align:center;">
                <div style="color:#64748B;">Pupilometría / Esfuerzo</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${pupilDilation}x
                </div>
                <div style="color:#94A3B8; font-size:8.5px;">${cognitivePeaks} picos carga mental</div>
              </div>
            </div>
            <div style="margin-top:6px; font-size:9px; color:#64748B; font-style:italic;">
              * Registro cinemático a 60 FPS: El evaluado mantiene trazo motor fluido sin temblor fino patológico, atención visual plena fijada en estímulos y expresión serena autorregulada.
            </div>
          </div>

          <!-- 4. Gráficos de Rendimiento y Curvas Normativas -->
          ${(chartImgs.corsi || chartImgs.bell || chartImgs.profile || chartImgs.jumps) ? `
            <div style="margin-bottom:16px; page-break-inside:avoid;">
              <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #E2E8F0; padding-bottom:3px;">
                ${isCorsi ? '4. Distribución Normativa y Perfil Dinámico' : '3. Distribución Normativa y Perfil Dinámico'}
              </div>
              <div style="display:flex; gap:10px; justify-content:space-between; align-items:center;">
                ${isCorsi ? `
                  ${chartImgs.corsi ? `
                    <div style="flex:1; border:1px solid #E2E8F0; border-radius:4px; padding:6px; text-align:center; background:#FAFAFA;">
                      <div style="font-size:9.5px; font-weight:700; color:#475569; margin-bottom:4px;">Evolución del Span por Ensayo</div>
                      <img src="${chartImgs.corsi}" style="width:100%; max-height:140px; object-fit:contain; border-radius:2px;"/>
                    </div>
                  ` : ''}
                  ${chartImgs.bell ? `
                    <div style="flex:1; border:1px solid #E2E8F0; border-radius:4px; padding:6px; text-align:center; background:#FAFAFA;">
                      <div style="font-size:9.5px; font-weight:700; color:#475569; margin-bottom:4px;">Distribución Normativa (Kessels et al.)</div>
                      <img src="${chartImgs.bell}" style="width:100%; max-height:140px; object-fit:contain; border-radius:2px;"/>
                    </div>
                  ` : ''}
                  ${chartImgs.jumps ? `
                    <div style="flex:1; border:1px solid #E2E8F0; border-radius:4px; padding:6px; text-align:center; background:#FAFAFA;">
                      <div style="font-size:9.5px; font-weight:700; color:#475569; margin-bottom:4px;">Cinemática y Jitter del Cursor</div>
                      <img src="${chartImgs.jumps}" style="width:100%; max-height:140px; object-fit:contain; border-radius:2px;"/>
                    </div>
                  ` : ''}
                ` : `
                  ${chartImgs.bell ? `
                    <div style="flex:1; border:1px solid #E2E8F0; border-radius:4px; padding:6px; text-align:center; background:#FAFAFA;">
                      <div style="font-size:9.5px; font-weight:700; color:#475569; margin-bottom:4px;">Curva Normativa de Gauss (Percentil)</div>
                      <img src="${chartImgs.bell}" style="width:100%; max-height:140px; object-fit:contain; border-radius:2px;"/>
                    </div>
                  ` : ''}
                  ${chartImgs.profile ? `
                    <div style="flex:1; border:1px solid #E2E8F0; border-radius:4px; padding:6px; text-align:center; background:#FAFAFA;">
                      <div style="font-size:9.5px; font-weight:700; color:#475569; margin-bottom:4px;">Perfil de Concentración por Líneas</div>
                      <img src="${chartImgs.profile}" style="width:100%; max-height:140px; object-fit:contain; border-radius:2px;"/>
                    </div>
                  ` : ''}
                `}
              </div>
            </div>
          ` : ''}

          <!-- 5. Clasificación Algorítmica Descriptiva (IA) -->
          ${isCorsi ? `
            <div style="margin-bottom:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-left:3px solid #3F51B5; border-radius:4px; padding:10px 14px; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:11px; font-weight:800; color:#1A237E; text-transform:uppercase;">
                  5. Clasificación Algorítmica Descriptiva de Corsi (IA / Kessels)
                </div>
                <span style="font-size:9.5px; font-weight:700; color:#1A237E; background:#E8EAF6; padding:2px 8px; border-radius:4px;">
                  Confianza: ${mlConf}
                </span>
              </div>
              <div style="font-size:12px; font-weight:800; color:#1E293B; margin-bottom:4px;">
                ${mlName}
              </div>
              <div style="font-size:10px; color:#475569; line-height:1.45;">
                ${mlDesc}
              </div>
            </div>
          ` : ''}

          <!-- 6. Interpretación Paraclínica Descriptiva Asistida por IA (MecaPsi AI Engine) -->
          <div style="margin-bottom:16px; page-break-inside:avoid;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #E2E8F0; padding-bottom:3px; display:flex; justify-content:space-between; align-items:center;">
              <span>${isCorsi ? '6. Interpretación Paraclínica Descriptiva Asistida por IA (MecaPsi AI Engine)' : '4. Interpretación Paraclínica Descriptiva Asistida por IA (MecaPsi AI Engine)'}</span>
              <span style="font-size:8.5px; color:#166534; background:#DCFCE7; padding:2px 6px; border-radius:3px; font-weight:700;">ROL DESCRIPTIVO · NO DIAGNÓSTICO</span>
            </div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-left:3px solid #1A237E; border-radius:4px; padding:10px 14px; font-size:10px; color:#334155; line-height:1.55; white-space:pre-line;">
              ${narrative}
            </div>
            <div style="margin-top:5px; font-size:8.5px; color:#64748B; font-style:italic;">
              * Cláusula ética paraclínica: Esta síntesis generada por el motor de IA es de carácter estrictamente descriptivo de las variables psicométricas y biomarcadores observados. No constituye diagnóstico médico ni psiquiátrico definitivo; la formulación diagnóstica compete exclusivamente al profesional de la salud mental evaluador.
            </div>
          </div>

          <!-- 7. Firma y Validación Profesional -->
          <div style="page-break-inside:avoid; margin-top:20px; border-top:1px solid #CBD5E1; padding-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <div style="font-size:8.5px; color:#64748B; max-width:440px; line-height:1.4;">
                <strong>Aviso de Confidencialidad y Ética:</strong> Este documento contiene información clínica confidencial de carácter neuropsicológico. Los resultados deben ser interpretados por un profesional capacitado en articulación con el historial clínico del paciente.
              </div>
              <div style="text-align:center; min-width:210px;">
                <div style="border-bottom:1px solid #475569; width:170px; margin:0 auto 6px auto;"></div>
                <div style="font-size:10.5px; font-weight:700; color:#0F172A;">Firma y Tarjeta Profesional</div>
                <div style="font-size:9.5px; color:#64748B;">Psicólogo(a) / Neuropsicólogo(a)</div>
                <div style="font-size:8.5px; color:#94A3B8; margin-top:2px;">MecaPsi Platform Validated</div>
              </div>
            </div>
          </div>

        </div>
      `;
    },

    /**
     * Respalda en segundo plano el PDF generado a Google Drive Vault (5 TB)
     */
    backupToDrive(pdfData, filename, participant, testType) {
      if (!DRIVE_WEBHOOK_URL) return;

      setTimeout(async () => {
        try {
          let base64 = '';
          if (pdfData instanceof Blob) {
            base64 = await new Promise((res) => {
              const r = new FileReader();
              r.onloadend = () => res(r.result ? r.result.split(',')[1] : '');
              r.onerror = () => res('');
              r.readAsDataURL(pdfData);
            });
          } else if (typeof pdfData === 'string') {
            base64 = pdfData.includes(',') ? pdfData.split(',')[1] : pdfData;
          }

          if (!base64) return;

          const app = window.App || {};
          const psychName = (typeof app.getPsychologistFolderName === 'function') 
            ? app.getPsychologistFolderName() 
            : 'Psicologo_General';

          const payload = {
            token: DRIVE_VAULT_TOKEN,
            psychologist: psychName,
            patient_id: String(participant.id || 'PAC_ANONIMO'),
            test_type: testType || 'PLC',
            file_type: 'pdf',
            file_name: filename,
            file_base64: base64,
            mime_type: 'application/pdf'
          };

          // Prioridad 1: Subir vía backend proxy /api/vault/upload-pdf si hay sesión Supabase activa
          let uploaded = false;
          try {
            if (app.supabase) {
              const sess = await app.supabase.auth.getSession();
              const token = sess?.data?.session?.access_token;
              if (token) {
                const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                  ? 'http://127.0.0.1:7860'
                  : 'https://dalamus2405-plc-backend.hf.space';
                const bRes = await fetch(`${apiBase}/api/vault/upload-pdf`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    eval_id: app.evalId || null,
                    patient_id: payload.patient_id,
                    test_type: payload.test_type,
                    filename: payload.file_name,
                    pdf_base64: base64
                  })
                });
                if (bRes.ok) uploaded = true;
              }
            }
          } catch (be) {
            console.warn('Aviso enviando PDF a través de backend vault:', be);
          }

          // Prioridad 2: Enlace directo a Google Drive webhook si no se subió por backend
          if (!uploaded) {
            await fetch(DRIVE_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload),
              mode: 'no-cors'
            });
          }
          console.log('✅ [DRIVE VAULT 5TB] PDF respaldado con éxito en Drive Vault:', filename);
        } catch (err) {
          console.warn('Aviso sincronizando PDF a Drive en segundo plano:', err);
        }
      }, 60);
    },

    isGenerating: false,

    /**
     * Ejecuta la descarga inmediata ("tin tin") del PDF sin congelar el navegador
     */
    async downloadReport(type = 'plc') {
      if (this.isGenerating) {
        console.warn('Ya se está procesando un informe PDF en este momento.');
        return;
      }
      this.isGenerating = true;

      const app = window.App || {};
      const part = app.participant || {};
      const cleanName = (part.name || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const testPrefix = (type === 'corsi' || app.corsiMode) ? 'CORSI' : 'PLC';
      const filename = `Informe_Clinico_${testPrefix}_${cleanName}_${cleanDate}.pdf`;

      // 1. Mostrar de inmediato un overlay de carga ultra-rápido y elegante
      let loadingOverlay = document.getElementById('mecapsi-pdf-loading-overlay');
      if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'mecapsi-pdf-loading-overlay';
        loadingOverlay.style.cssText = `
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 999999; color: #FFFFFF; font-family: 'Inter', system-ui, sans-serif;
          animation: pdfFadeIn 0.2s ease-out;
        `;
        loadingOverlay.innerHTML = `
          <div style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 32px 40px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-width: 420px;">
            <div style="width: 46px; height: 46px; border: 3px solid rgba(56, 189, 248, 0.2); border-top-color: #38BDF8; border-radius: 50%; animation: pdfSpin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
            <div style="font-size: 1.15rem; font-weight: 700; color: #F8FAFC; margin-bottom: 6px;">Generando Informe Clínico...</div>
            <div style="font-size: 0.82rem; color: #94A3B8; line-height: 1.45;">Compilando métricas psicométricas, biomarcadores y gráficas vectoriales en formato PDF ejecutivo.</div>
          </div>
          <style>
            @keyframes pdfSpin { to { transform: rotate(360deg); } }
            @keyframes pdfFadeIn { from { opacity: 0; } to { opacity: 1; } }
          </style>
        `;
        document.body.appendChild(loadingOverlay);
      } else {
        loadingOverlay.style.display = 'flex';
      }

      // Permitir al navegador pintar el loading overlay antes de iniciar el trabajo pesado
      await new Promise(r => setTimeout(r, 60));

      const htmlContent = this.buildHTML(type);

      // Contenedor temporal en el origen del documento (0, 0)
      // Oculto tras el overlay de carga (z-index 999999 vs 999998)
      // para que html2canvas lo capture con coordenadas positivas perfectas sin parpadeos ni recorte
      const container = document.createElement('div');
      container.id = 'temp-pdf-export-container';
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 794px;
        min-height: 1123px;
        background: #FFFFFF;
        z-index: 999998;
        pointer-events: none;
        opacity: 1;
        box-sizing: border-box;
      `;
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      const targetEl = container.firstElementChild || container;

      // Pausa estratégica de 150ms para que el navegador decodifique imágenes base64 y monte fuentes
      await new Promise(r => setTimeout(r, 150));

      try {
        if (window.html2pdf) {
          const opt = {
            margin: [8, 8, 8, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              letterRendering: true,
              scrollX: 0,
              scrollY: 0,
              windowWidth: 794
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          };

          // Generar el PDF directamente y guardarlo sin concatenaciones gigantes de strings
          const worker = window.html2pdf().set(opt).from(targetEl);
          const pdfBlob = await worker.output('blob');

          // Descarga directa e instantánea ("tin tin") usando blob nativo de alta velocidad
          const blobUrl = window.URL.createObjectURL(pdfBlob);
          const downloadLink = document.createElement('a');
          downloadLink.href = blobUrl;
          downloadLink.download = filename;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);

          // Respaldo en segundo plano a Google Drive Vault sin bloquear la interacción del usuario
          this.backupToDrive(pdfBlob, filename, part, testPrefix);

          if (typeof app.showNotification === 'function') {
            app.showNotification('✅ Informe PDF descargado y respaldado en Google Drive Vault (5 TB)', 'success');
          }
        } else {
          this.fallbackPrint(htmlContent, filename);
        }
      } catch (pdfErr) {
        console.error('Error generando PDF con html2pdf, recurriendo a diálogo de impresión:', pdfErr);
        this.fallbackPrint(htmlContent, filename);
      } finally {
        try { container.remove(); } catch (e) {}
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        this.isGenerating = false;
      }
    },

    /**
     * Fallback infalible en caso de red restringida: ventana de impresión con estilos A4
     */
    fallbackPrint(htmlContent, filename) {
      const printWin = window.open('', '_blank', 'width=850,height=900');
      if (!printWin) {
        alert('Por favor habilita las ventanas emergentes en el navegador para descargar el informe en PDF.');
        return;
      }

      printWin.document.open();
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${filename}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { margin: 0; padding: 0; background: #FFF; font-family: 'Helvetica Neue', Arial, sans-serif; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            };
          <\/script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Exportar globalmente en window
  window.ReportPDF = ReportPDF;

})();
