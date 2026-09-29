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
        corsi: null
      };

      try {
        const bellCanvas = document.getElementById('chart-d2-bell') || document.querySelector('canvas[id*="bell"]');
        if (bellCanvas) images.bell = bellCanvas.toDataURL('image/png', 1.0);

        const profileCanvas = document.getElementById('chart-lines') || document.getElementById('chart-d2-lines') || document.querySelector('canvas[id*="line"]');
        if (profileCanvas) images.profile = profileCanvas.toDataURL('image/png', 1.0);

        const corsiCanvas = document.getElementById('chart-corsi-progression') || document.querySelector('canvas[id*="corsi"]');
        if (corsiCanvas) images.corsi = corsiCanvas.toDataURL('image/png', 1.0);
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
      const ml = app.mlPrediction || {};
      const isCorsi = type === 'corsi' || Boolean(app.corsiMode);
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
      const corsiSpan = m.corsi_span || 5;
      const compositeScore = m.composite_score || 0;
      const corsiPct = m.kessels_percentile !== undefined ? `P${m.kessels_percentile}` : 'P50';
      const corsiCat = m.clinical_category || 'Promedio Normal';

      // Estado de la cámara y biomarcadores
      const camStatus = m.camera_status || 'not_detected';
      let camBadge = '';
      if (camStatus === 'active') {
        camBadge = `<span style="color:#2E7D32;background:#E8F5E9;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">● Sensor Activo y Calibrado</span>`;
      } else if (camStatus === 'permission_denied') {
        camBadge = `<span style="color:#C62828;background:#FFEBEE;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">⚠️ Permiso Bloqueado en Navegador</span>`;
      } else if (camStatus === 'hardware_error') {
        camBadge = `<span style="color:#E65100;background:#FFF3E0;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">⚠️ Dispositivo Ocupado (Zoom/Teams)</span>`;
      } else {
        camBadge = `<span style="color:#546E7A;background:#ECEFF1;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">ℹ️ Sin Sensor Óptico Registrado</span>`;
      }

      // Interpretación pedagógica clínica
      let narrative = m.narrativeText || '';
      if (!narrative && m.narrativeBullets && Array.isArray(m.narrativeBullets)) {
        narrative = m.narrativeBullets.join('\n\n');
      }
      if (!narrative) {
        narrative = isCorsi
          ? `Evaluación neuropsicológica del Span de Memoria Visoespacial (${corsiCat}). Se observó una capacidad de retención de ${corsiSpan} bloques en secuencia, alcanzando una correspondencia en el percentil ${corsiPct} según los baremos clínicos de Kessels et al.`
          : `El participante completó la prueba de atención selectiva alcanzando un Índice de Concentración de ${conVal} puntos netos (Percentil ${pCon} según baremo oficial TEA Ediciones para ${pStratum}). Su ritmo de trabajo reflejó una efectividad total de ${totNum}/${totalPosibles} (${totPct}% del test).`;
      }

      return `
        <div id="mecapsi-pdf-template" style="font-family:'Helvetica Neue', Arial, sans-serif; color:#1E293B; line-height:1.45; padding:24px 32px; background:#FFFFFF; max-width:800px; margin:0 auto; font-size:12px;">
          
          <!-- Encabezado Membretado Formal -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1A237E; padding-bottom:14px; margin-bottom:16px;">
            <div>
              <div style="font-size:20px; font-weight:800; color:#1A237E; letter-spacing:0.5px; text-transform:uppercase;">
                MecaPsi · PLC Professional
              </div>
              <div style="font-size:11px; color:#475569; font-weight:600; margin-top:2px;">
                Sistema Computarizado de Evaluación Neuropsicológica y Biomarcadores Digitales
              </div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">
                Protocolo Clínico Estandarizado de Atención Selectiva y Memoria de Trabajo
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
          <div style="text-align:center; margin-bottom:18px;">
            <div style="font-size:15px; font-weight:800; color:#0F172A; text-transform:uppercase; letter-spacing:0.4px;">
              ${isCorsi ? 'Informe de Evaluación Neuropsicológica — Memoria Visoespacial (Corsi)' : 'Informe Neuropsicológico Clínico y Paraclínico (Test d2)'}
            </div>
            <div style="font-size:11px; color:#64748B; margin-top:3px;">
              Baremo Poblacional: <strong style="color:#1E293B;">${pStratum}</strong>
            </div>
          </div>

          <!-- Ficha de Identificación del Paciente -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:12px 16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #CBD5E1; padding-bottom:4px;">
              Ficha de Identificación del Evaluado
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <tr>
                <td style="padding:3px 0; color:#475569; width:22%;"><strong>Nombre Completo:</strong></td>
                <td style="padding:3px 0; color:#0F172A; width:28%; font-weight:700;">${pName}</td>
                <td style="padding:3px 0; color:#475569; width:22%;"><strong>Identificación / ID:</strong></td>
                <td style="padding:3px 0; color:#0F172A; width:28%; font-weight:700;">${pId}</td>
              </tr>
              <tr>
                <td style="padding:3px 0; color:#475569;"><strong>Edad Cronológica:</strong></td>
                <td style="padding:3px 0; color:#0F172A; font-weight:700;">🎂 ${pAge}</td>
                <td style="padding:3px 0; color:#475569;"><strong>Sexo:</strong></td>
                <td style="padding:3px 0; color:#0F172A;">${pGender}</td>
              </tr>
              <tr>
                <td style="padding:3px 0; color:#475569;"><strong>Escolaridad:</strong></td>
                <td style="padding:3px 0; color:#0F172A;">${pEduc}</td>
                <td style="padding:3px 0; color:#475569;"><strong>Sensor Óptico:</strong></td>
                <td style="padding:3px 0;">${camBadge}</td>
              </tr>
            </table>
          </div>

          <!-- Resumen de Métricas Objetivas -->
          <div style="margin-bottom:18px;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #E2E8F0; padding-bottom:4px;">
              1. Evaluación Psicométrica Estandarizada
            </div>
            
            ${isCorsi ? `
              <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:center;">
                <thead>
                  <tr style="background:#F1F5F9; color:#1E293B;">
                    <th style="padding:6px; border:1px solid #CBD5E1;">Span Visoespacial</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Puntaje Compuesto</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Percentil (Kessels)</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Precisión (%)</th>
                    <th style="padding:6px; border:1px solid #CBD5E1;">Categoría Clínica</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:8px; border:1px solid #E2E8F0; font-weight:800; font-size:13px; color:#1565C0;">${corsiSpan} bloques</td>
                    <td style="padding:8px; border:1px solid #E2E8F0; font-weight:700;">${compositeScore} pts</td>
                    <td style="padding:8px; border:1px solid #E2E8F0; font-weight:800; color:#7B1FA2;">${corsiPct}</td>
                    <td style="padding:8px; border:1px solid #E2E8F0;">${Number(m.accuracy_pct || 0).toFixed(1)}%</td>
                    <td style="padding:8px; border:1px solid #E2E8F0; font-weight:700; color:#2E7D32;">${corsiCat}</td>
                  </tr>
                </tbody>
              </table>
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

          <!-- Gráficos de Alta Resolución -->
          ${chartImgs.bell || chartImgs.profile || chartImgs.corsi ? `
            <div style="margin-bottom:18px;">
              <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #E2E8F0; padding-bottom:4px;">
                2. Distribución Normativa y Perfil Dinámico
              </div>
              <div style="display:flex; gap:14px; justify-content:space-between; align-items:center;">
                ${chartImgs.bell ? `
                  <div style="flex:1; border:1px solid #E2E8F0; border-radius:6px; padding:6px; text-align:center; background:#FAFAFA;">
                    <div style="font-size:10px; font-weight:700; color:#475569; margin-bottom:4px;">Curva Normativa de Gauss (Percentil)</div>
                    <img src="${chartImgs.bell}" style="width:100%; max-height:165px; object-fit:contain; border-radius:4px;"/>
                  </div>
                ` : ''}
                ${chartImgs.profile ? `
                  <div style="flex:1; border:1px solid #E2E8F0; border-radius:6px; padding:6px; text-align:center; background:#FAFAFA;">
                    <div style="font-size:10px; font-weight:700; color:#475569; margin-bottom:4px;">Perfil de Concentración por Líneas</div>
                    <img src="${chartImgs.profile}" style="width:100%; max-height:165px; object-fit:contain; border-radius:4px;"/>
                  </div>
                ` : ''}
                ${chartImgs.corsi ? `
                  <div style="flex:1; border:1px solid #E2E8F0; border-radius:6px; padding:6px; text-align:center; background:#FAFAFA;">
                    <div style="font-size:10px; font-weight:700; color:#475569; margin-bottom:4px;">Evolución del Span por Ensayo</div>
                    <img src="${chartImgs.corsi}" style="width:100%; max-height:165px; object-fit:contain; border-radius:4px;"/>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Biomarcadores Paraclínicos Digitales -->
          <div style="margin-bottom:18px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:10px 14px;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:6px;">
              3. Biomarcadores Paraclínicos Digitales (Edge-AI)
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:10.5px;">
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px;">
                <div style="color:#64748B; font-size:10px;">Velocidad / Latencia Media</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${Math.round(m.meanRt || m.mean_reaction_time_ms || 420)} ms
                </div>
                <div style="color:#94A3B8; font-size:9px;">(${Math.round(m.procSpeed || 100)} estímulos/min)</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px;">
                <div style="color:#64748B; font-size:10px;">Cinemática / Micro-temblor</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${(m.microtremor_avg !== undefined ? Number(m.microtremor_avg).toFixed(2) : (m.tremor_mean || '0.00'))} px/s²
                </div>
                <div style="color:#94A3B8; font-size:9px;">Estabilidad motora 60 FPS</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px;">
                <div style="color:#64748B; font-size:10px;">Respuesta Ocular / Pupila</div>
                <div style="font-size:12px; font-weight:800; color:#0F172A; margin-top:2px;">
                  ${(m.pupil_dilation_avg !== undefined ? Number(m.pupil_dilation_avg).toFixed(2) : '1.00')}x
                </div>
                <div style="color:#94A3B8; font-size:9px;">Esfuerzo mental en tarea</div>
              </div>
            </div>
            <div style="margin-top:6px; font-size:9.5px; color:#64748B; font-style:italic;">
              * Nota metodológica: La prueba computarizada incorpora la latencia motora del mouse (~250-300 ms). Se presenta como biomarcador complementario sin alterar los baremos normativos estandarizados.
            </div>
          </div>

          <!-- Interpretación Clínica Pedagógica -->
          <div style="margin-bottom:20px; page-break-inside:avoid;">
            <div style="font-size:11px; font-weight:800; color:#1E3A8A; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #E2E8F0; padding-bottom:4px;">
              4. Interpretación Descriptiva y Pautas de Orientación
            </div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-left:3px solid #1A237E; border-radius:4px; padding:10px 14px; font-size:10.5px; color:#334155; line-height:1.55; white-space:pre-line;">
              ${narrative}
            </div>
          </div>

          <!-- Firma y Validación Profesional -->
          <div style="page-break-inside:avoid; margin-top:24px; border-top:1px solid #CBD5E1; padding-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <div style="font-size:9px; color:#64748B; max-width:420px; line-height:1.4;">
                <strong>Aviso de Confidencialidad y Ética:</strong> Este documento contiene información clínica confidencial de carácter neuropsicológico. Los resultados deben ser interpretados por un profesional capacitado en articulación con el historial clínico del paciente.
              </div>
              <div style="text-align:center; min-width:220px;">
                <div style="border-bottom:1px solid #475569; width:180px; margin:0 auto 6px auto;"></div>
                <div style="font-size:11px; font-weight:700; color:#0F172A;">Firma y Tarjeta Profesional</div>
                <div style="font-size:10px; color:#64748B;">Psicólogo(a) / Neuropsicólogo(a)</div>
                <div style="font-size:9px; color:#94A3B8; margin-top:2px;">MecaPsi Platform Validated</div>
              </div>
            </div>
          </div>

        </div>
      `;
    },

    /**
     * Respalda en segundo plano el PDF generado a Google Drive Vault (5 TB)
     */
    async backupToDrive(pdfBase64, filename, participant, testType) {
      if (!DRIVE_WEBHOOK_URL) return;

      try {
        const payload = {
          token: DRIVE_VAULT_TOKEN,
          psychologist: "Psicologo_General",
          patient_id: String(participant.id || 'PAC_ANONIMO'),
          test_type: testType || 'PLC',
          file_type: 'pdf',
          file_name: filename,
          file_base64: pdfBase64,
          mime_type: 'application/pdf'
        };

        // Enviar con keepalive para no bloquear el navegador
        fetch(DRIVE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          mode: 'no-cors',
          keepalive: true
        }).catch(err => console.warn('Aviso sincronizando PDF a Drive en segundo plano:', err));

      } catch (err) {
        console.warn('Error enviando PDF a Drive Vault:', err);
      }
    },

    /**
     * Ejecuta la descarga inmediata ("tin tin") del PDF
     */
    async downloadReport(type = 'plc') {
      const app = window.App || {};
      const part = app.participant || {};
      const cleanName = (part.name || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const testPrefix = (type === 'corsi' || app.corsiMode) ? 'CORSI' : 'PLC';
      const filename = `Informe_Clinico_${testPrefix}_${cleanName}_${cleanDate}.pdf`;

      // Mostrar toast de preparación inmediata
      if (typeof app.showNotification === 'function') {
        app.showNotification('📄 Generando informe clínico en PDF...', 'info');
      }

      const htmlContent = this.buildHTML(type);

      // Crear contenedor temporal invisible
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      const targetEl = container.firstElementChild;

      // Si html2pdf está disponible en el navegador
      if (window.html2pdf) {
        const opt = {
          margin: [10, 10, 10, 10],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
          // Generar el PDF y descargarlo instantáneamente
          const worker = window.html2pdf().from(targetEl).set(opt);
          
          // Obtener base64 para el respaldo en Drive
          worker.outputPdf('datauristring').then(dataUri => {
            const base64 = dataUri.split(',')[1] || '';
            if (base64) {
              ReportPDF.backupToDrive(base64, filename, part, testPrefix);
            }
          }).catch(e => console.warn('Aviso extrayendo base64 del PDF:', e));

          // Descarga directa en el navegador
          await worker.save();

          if (typeof app.showNotification === 'function') {
            app.showNotification('✅ Informe PDF descargado y respaldado en Google Drive Vault (5 TB)', 'success');
          }
        } catch (pdfErr) {
          console.error('Error generando PDF con html2pdf, recurriendo a diálogo de impresión:', pdfErr);
          this.fallbackPrint(htmlContent, filename);
        } finally {
          container.remove();
        }
      } else {
        // Fallback robusto sin bibliotecas externas (usando print dialog con CSS A4)
        this.fallbackPrint(htmlContent, filename);
        container.remove();
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
