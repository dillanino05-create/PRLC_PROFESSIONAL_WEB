"""
excel_export.py — Exportación Excel enriquecida con imágenes de todas las gráficas.
5 hojas de datos + 1 hoja de gráficas visuales (PNG embebido).
"""
import os
import io
import math
from datetime import datetime
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
from matplotlib.figure import Figure

import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.drawing.image import Image as XLImage
from openpyxl.chart import LineChart, BarChart, Reference
from openpyxl.utils import get_column_letter

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exports')
os.makedirs(EXPORTS_DIR, exist_ok=True)

# ── Estilos compartidos ────────────────────────────────────────────────────────
H_FILL  = PatternFill('solid', fgColor='1A237E')
H_FONT  = Font(color='FFFFFF', bold=True, name='Calibri', size=11)
H_ALIGN = Alignment(horizontal='center', vertical='center', wrap_text=True)
W_ALIGN = Alignment(wrap_text=True, vertical='top')

def _style_hdr(ws, row=1):
    for cell in ws[row]:
        if cell.value is not None:
            cell.fill = H_FILL; cell.font = H_FONT; cell.alignment = H_ALIGN

def _set_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

# ── Generación de imagen con las 4 gráficas ────────────────────────────────────
def _charts_png(lines_data: List[Dict], metrics: Dict, age_v: int,
                ml_pred: Optional[Dict]) -> io.BytesIO:
    """Reproduce las 4 gráficas del panel de resultados + distribución MLP."""
    lineas = [l['linea']     for l in lines_data]
    hits   = [l['aciertos']  for l in lines_data]
    oms    = [l['omisiones'] for l in lines_data]
    coms   = [l['comisiones']for l in lines_data]

    n_rows = 3 if (ml_pred and ml_pred.get('model_used')) else 2
    fig = Figure(figsize=(14, n_rows * 4.5), facecolor='white', dpi=110)
    fig.subplots_adjust(hspace=0.52, wspace=0.36)

    # ── Gráfica 1: Curva de comportamiento ────────────────────────────────
    ax1 = fig.add_subplot(n_rows, 2, 1)
    ax1.plot(lineas, hits, color='#1565C0', lw=2.2, marker='o', ms=5, label='Aciertos')
    ax1.fill_between(lineas, hits, alpha=0.12, color='#1565C0')
    if len(lineas) > 2:
        z = np.polyfit(lineas, hits, 1)
        ax1.plot(lineas, np.poly1d(z)(lineas), '--', color='#E53935', lw=1.4, label='Tendencia')
    ax1.set_title('Curva de Comportamiento', fontweight='bold', fontsize=11)
    ax1.set_xlabel('Línea'); ax1.set_ylabel('Aciertos')
    ax1.set_xticks(lineas); ax1.grid(alpha=0.3); ax1.legend(fontsize=8)

    # ── Gráfica 2: Métricas de atención ─────────────────────────────────
    ax2 = fig.add_subplot(n_rows, 2, 2)
    labels2 = ['Aciertos\n(TA)', 'Omisiones\n(O)', 'Comisiones\n(C)', 'Índice\nConc. CP%']
    values2 = [metrics['TA'], metrics['O'], metrics['COM'], round(metrics['CP'], 1)]
    colors2 = ['#1565C0', '#E65100', '#B71C1C', '#2E7D32']
    bars = ax2.bar(labels2, values2, color=colors2, width=0.55, edgecolor='white', lw=1.2)
    for bar, val in zip(bars, values2):
        ax2.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3, str(val),
                 ha='center', va='bottom', fontsize=9, fontweight='bold')
    ax2.set_title('Métricas de Atención', fontweight='bold', fontsize=11)
    ax2.set_ylabel('Valor'); ax2.grid(axis='y', alpha=0.3)

    # ── Gráfica 3: Errores por línea ──────────────────────────────────────
    ax3 = fig.add_subplot(n_rows, 2, 3)
    x = np.array(lineas)
    ax3.bar(x - 0.2, oms,  0.35, label='Omisiones',  color='#E65100', alpha=0.85)
    ax3.bar(x + 0.2, coms, 0.35, label='Comisiones', color='#B71C1C', alpha=0.85)
    ax3.set_title('Errores por Línea', fontweight='bold', fontsize=11)
    ax3.set_xlabel('Línea'); ax3.set_ylabel('Errores')
    ax3.set_xticks(lineas); ax3.legend(fontsize=8); ax3.grid(axis='y', alpha=0.3)

    # ── Gráfica 4: Curva de normalidad ───────────────────────────────────
    ax4 = fig.add_subplot(n_rows, 2, 4)
    if age_v <= 18:   mu, sigma = 68, 14
    elif age_v <= 35: mu, sigma = 75, 12
    elif age_v <= 50: mu, sigma = 70, 13
    else:             mu, sigma = 62, 15

    x_n = np.linspace(mu - 4 * sigma, mu + 4 * sigma, 300)
    y_n = (1 / (sigma * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x_n - mu) / sigma) ** 2)
    ax4.plot(x_n, y_n, color='#1565C0', lw=2.2, label='Distribución normativa')
    ax4.fill_between(x_n, y_n, alpha=0.10, color='#1565C0')

    score = metrics.get('adjScore', metrics.get('CP', 0))
    y_ev  = (1 / (sigma * np.sqrt(2 * np.pi))) * math.exp(-0.5 * ((score - mu) / sigma) ** 2)
    ax4.axvline(x=score, color='#E53935', lw=2, ls='--', label=f'Evaluado: {score:.1f}')
    ax4.scatter([score], [y_ev], color='#E53935', s=60, zorder=5)
    pct = (1 + math.erf((score - mu) / (sigma * math.sqrt(2)))) / 2
    x_fill = x_n[x_n <= score]
    y_fill = (1 / (sigma * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x_fill - mu) / sigma) ** 2)
    ax4.fill_between(x_fill, y_fill, alpha=0.25, color='#E53935')
    ax4.set_title(f'Curva Normativa  (Percentil ≈ {pct*100:.0f})', fontweight='bold', fontsize=11)
    ax4.set_xlabel('CP % ajustado'); ax4.set_ylabel('Densidad')
    ax4.legend(fontsize=8); ax4.grid(alpha=0.3)
    ax4.text(0.02, 0.92, f'Media: {mu}  |  σ: {sigma}\n(Edad: {age_v} años)',
             transform=ax4.transAxes, fontsize=7, color='#546E7A')

    # ── Gráfica 5 (condicional): Distribución MLP ─────────────────────────
    if ml_pred and ml_pred.get('model_used') and 'all_probs' in ml_pred:
        ax5 = fig.add_subplot(n_rows, 2, (5, 6))
        probs_sorted = sorted(ml_pred['all_probs'].items(), key=lambda x: x[1], reverse=True)
        prof_labels  = [k.replace('_', ' ') for k, _ in probs_sorted]
        prof_vals    = [v * 100 for _, v in probs_sorted]
        pred_key     = ml_pred.get('predicted_profile', '')
        bar_colors   = ['#3949AB' if k.replace(' ', '_') == pred_key else '#C5CAE9'
                        for k, _ in probs_sorted]
        bars5 = ax5.barh(prof_labels[::-1], prof_vals[::-1], color=bar_colors[::-1],
                         edgecolor='white', height=0.6)
        for bar, val in zip(bars5, prof_vals[::-1]):
            ax5.text(val + 0.3, bar.get_y() + bar.get_height() / 2,
                     f'{val:.1f}%', va='center', fontsize=9, fontweight='bold', color='#1A1A2E')
        conf_txt = ml_pred.get('confidence_percent', '')
        ax5.set_title(f'Distribución de Perfiles Cognitivos (Confianza: {conf_txt})',
                      fontweight='bold', fontsize=11)
        ax5.set_xlabel('Probabilidad (%)'); ax5.grid(axis='x', alpha=0.3)
        ax5.set_xlim(0, max(prof_vals) * 1.18)

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=110, bbox_inches='tight', facecolor='white')
    buf.seek(0)
    return buf


# ── Función principal ──────────────────────────────────────────────────────────
def save_excel(participant: Dict, lines_data: List[Dict], click_log: List[Dict],
               metrics: Dict, ml_pred: Optional[Dict], narrative: str) -> str:
    ts  = datetime.now().strftime('%Y%m%d_%H%M%S')
    fn  = f"PLC_{participant['id']}_{ts}.xlsx"
    fp  = os.path.join(EXPORTS_DIR, fn)

    from openpyxl.chart import LineChart, BarChart, Reference

    with pd.ExcelWriter(fp, engine='openpyxl') as writer:

        # ── Hoja 1: Resumen ────────────────────────────────────────────────
        ml_nombre = ml_pred['profile_info']['nombre'] if (ml_pred and ml_pred.get('model_used')) else 'N/A'
        ml_conf   = ml_pred.get('confidence_percent', 'N/A') if (ml_pred and ml_pred.get('model_used')) else 'N/A'
        ml_desc   = ml_pred['profile_info']['desc'] if (ml_pred and ml_pred.get('model_used')) else 'N/A'

        d1 = {
            'Campo': [
                '─ IDENTIFICACIÓN ─','ID','Nombre','Edad','Género','Educación','Lateralidad','Ocupación','Fecha',
                '','─ MÉTRICAS ESTÁNDAR ─','TN','TA','O','C','TOT','CON','CP %',
                '','─ MÉTRICAS EXTENDIDAS ─',
                'Velocidad (estím/min)','Eficiencia (aciert/min)','FA','GQ',
                'Variabilidad (VAR %)','Estabilidad %','TRM %','IVR',
                'Patrón de error','Score ajust. edad',
                '','─ TIEMPO DE REACCIÓN ─','TR medio (ms)','TR mediana (ms)',
                '','─ ESTILO ATENCIONAL ─','Estilo dominante','Descripción estilo',
                '','─ PERFIL COGNITIVO IA ─','Perfil detectado','Confianza','Descripción perfil',
            ],
            'Valor': [
                '',participant['id'],participant['name'],participant['age'],participant['gender'],
                participant['education'],participant['hand'],participant.get('occupation',''),
                datetime.now().strftime('%Y-%m-%d %H:%M'),
                '','',
                metrics['TN'],metrics['TA'],metrics['O'],metrics['COM'],
                metrics['TOT'],metrics['CON'],round(metrics['CP'],2),
                '','',
                round(metrics['procSpeed'],1),round(metrics['efficiency'],1),
                round(metrics['FA'],4),round(metrics['GQ'],5),
                round(metrics['VAR'],2),round(metrics['estabilidad'],1),
                round(metrics['TRM'],2),round(metrics['IVR'],3),
                metrics.get('errorPat',''),round(metrics['adjScore'],2),
                '','',
                round(metrics['meanRt'],1),round(metrics['medRt'],1),
                '','',
                metrics['attnStyle'],metrics['attnDesc'],
                '','',
                ml_nombre,ml_conf,ml_desc,
            ]
        }
        pd.DataFrame(d1).to_excel(writer, sheet_name='01_Resumen', index=False)
        ws1 = writer.sheets['01_Resumen']
        _style_hdr(ws1); _set_widths(ws1, [38, 60])
        for row in ws1.iter_rows(min_row=2, max_col=2):
            for cell in row:
                cell.alignment = W_ALIGN

        # ── Hoja 2: Análisis por Línea ────────────────────────────────────
        df2 = pd.DataFrame(lines_data)
        if not df2.empty:
            df2['precision_%']  = (df2['aciertos'] / df2['targets_total'].replace(0,1) * 100).round(1)
            df2['tasa_om_%']    = (df2['omisiones'] / df2['targets_total'].replace(0,1) * 100).round(1)
            df2['tasa_com_%']   = (df2['comisiones']/ df2['targets_total'].replace(0,1) * 100).round(1)
        df2.to_excel(writer, sheet_name='02_Analisis_Lineas', index=False)
        ws2 = writer.sheets['02_Analisis_Lineas']
        _style_hdr(ws2); _set_widths(ws2, [8,14,10,11,11,10,12,10,10,10])

        # ── Hoja 3: Micro-Tendencia (click log) ──────────────────────────
        df3 = pd.DataFrame(click_log) if click_log else \
              pd.DataFrame(columns=['line','stim_idx','is_target','stim_key','action','elapsed_ms'])
        df3.to_excel(writer, sheet_name='03_Micro_Tendencia', index=False)
        ws3 = writer.sheets['03_Micro_Tendencia']
        _style_hdr(ws3); _set_widths(ws3, [8,10,10,10,8,12])

        # ── Hoja 4: Perfil de Rasgos ──────────────────────────────────────
        if ml_pred and ml_pred.get('model_used'):
            pi    = ml_pred['profile_info']
            p_ras = '\n'.join(f'• {r}' for r in pi['rasgos'])
            p_top = '  |  '.join(
                f"{k.replace('_',' ')}: {v*100:.1f}%"
                for k, v in sorted(ml_pred['all_probs'].items(), key=lambda x: x[1], reverse=True)[:3])
        else:
            pi = {}; p_ras = p_top = 'No disponible'

        d4 = {
            'Dimensión': [
                '─ NARRATIVA TÉCNICA ─','Descripción integrada','',
                '─ ESTILO ATENCIONAL ─','Estilo dominante','Descripción','',
                '─ PERFIL COGNITIVO (IA) ─','Perfil','Confianza','Descripción','Rasgos','Perfiles top-3','',
                '─ ALCANCE ─','Nota para el evaluador'
            ],
            'Contenido': [
                '',narrative,'',
                '',metrics['attnStyle'],metrics['attnDesc'],'',
                '',ml_nombre,ml_conf,ml_desc,p_ras,p_top,'',
                '','Este informe describe indicadores del rendimiento cognitivo durante la prueba PLC. '
                   'No constituye un diagnóstico clínico. El evaluador debe integrar estos datos con historia '
                   'clínica, entrevista y otros instrumentos.'
            ]
        }
        pd.DataFrame(d4).to_excel(writer, sheet_name='04_Perfil_Rasgos', index=False)
        ws4 = writer.sheets['04_Perfil_Rasgos']
        _style_hdr(ws4); _set_widths(ws4, [30, 95])
        for row in ws4.iter_rows(min_row=2, min_col=2, max_col=2):
            for cell in row:
                cell.alignment = W_ALIGN

        # ── Hoja 5: Datos para gráficas ───────────────────────────────────
        if lines_data:
            gd = {
                'Linea':      [l['linea']     for l in lines_data],
                'Aciertos':   [l['aciertos']  for l in lines_data],
                'Omisiones':  [l['omisiones'] for l in lines_data],
                'Comisiones': [l['comisiones']for l in lines_data],
                'Tiempo_s':   [round(l['tiempo_s'], 2) for l in lines_data],
            }
            pd.DataFrame(gd).to_excel(writer, sheet_name='05_Datos_Graficas', index=False)
            ws5 = writer.sheets['05_Datos_Graficas']
            _style_hdr(ws5); _set_widths(ws5, [8,11,11,12,10])
            # Gráficas nativas de openpyxl (adicionales)
            try:
                n_rows_data = len(lines_data) + 1
                lc = LineChart(); lc.title = 'Curva de Aciertos'; lc.style = 10; lc.height = 12; lc.width = 22
                dr = Reference(ws5, min_col=2, min_row=1, max_row=n_rows_data)
                lc.add_data(dr, titles_from_data=True)
                lc.set_categories(Reference(ws5, min_col=1, min_row=2, max_row=n_rows_data))
                ws5.add_chart(lc, 'G2')
                bc = BarChart(); bc.type = 'col'; bc.title = 'Errores por Línea'
                bc.style = 10; bc.height = 12; bc.width = 22
                er = Reference(ws5, min_col=3, min_row=1, max_col=4, max_row=n_rows_data)
                bc.add_data(er, titles_from_data=True)
                bc.set_categories(Reference(ws5, min_col=1, min_row=2, max_row=n_rows_data))
                ws5.add_chart(bc, 'G22')
            except Exception:
                pass

    # ── Hoja 6: Gráficas Visuales (PNG) ─────────────────────────────────
    # Reabrir para añadir la hoja de imágenes
    try:
        wb  = openpyxl.load_workbook(fp)
        ws6 = wb.create_sheet('06_Graficas_Visuales')
        ws6.sheet_view.showGridLines = False

        age_v = participant.get('age', 25)
        chart_buf = _charts_png(lines_data, metrics, age_v, ml_pred)

        img = XLImage(chart_buf)
        img.anchor = 'A1'
        ws6.add_image(img)

        # Cabecera informativa
        ws6['A1'].value = None   # imagen ya ocupa A1
        # Añadir fila de título encima de la imagen
        ws6.insert_rows(1)
        ws6['A1'] = (f"PLC Professional — Gráficas de Resultados  |  "
                     f"Evaluado: {participant['name']}  |  "
                     f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        ws6['A1'].font   = Font(bold=True, color='1A237E', size=13, name='Calibri')
        ws6['A1'].fill   = PatternFill('solid', fgColor='E8EAF6')
        ws6.row_dimensions[1].height = 24
        ws6.column_dimensions['A'].width = 120

        wb.save(fp)
        print(f'✅ Excel guardado: {fp}')
    except Exception as e:
        print(f'⚠️ Error añadiendo gráficas: {e}')

    return fp
