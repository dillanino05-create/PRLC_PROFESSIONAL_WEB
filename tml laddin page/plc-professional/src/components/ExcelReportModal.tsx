import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Check, Copy, Table, BarChart2, ShieldCheck } from 'lucide-react';

interface ExcelReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelReportModal: React.FC<ExcelReportModalProps> = ({ isOpen, onClose }) => {
  const [activeSheet, setActiveSheet] = useState<'summary' | 'telemetry' | 'kinematics'>('summary');
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloaded(true);
    // Trigger simulated download
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Prueba,PuntuacionDirecta_ms,MediaPoblacional_ms,DesvEst,PuntuacionZ,Percentil,DiagnosticoOperativo\n"
      + "TMT Parte A,24812,29400,6800,-0.67,Pc 75,Adecuado\n"
      + "TMT Parte B,58120,72300,14200,-1.00,Pc 65,Adecuado\n"
      + "Indice Alternancia B/A,2.34,2.45,0.40,-0.27,Pc 60,Flexibilidad Normal\n"
      + "Frecuencia Pico Temblor,1.8 Hz,< 3.5 Hz,0.8,0.0,Pc 50,Normal (Fisiologico)\n"
      + "Indice Jerk Cinemático,0.14 m/s3,< 0.35,0.05,0.0,Pc 55,Trayectoria Suave\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "PLC_Reporte_Clinico_Elena_Morales.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setDownloaded(false), 2500);
  };

  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard?.writeText(
      "Prueba\tPuntuación Directa\tMedia\tPercentil\tDiagnóstico\n" +
      "TMT Parte A\t24.812 s\t29.40 s\tPc 75\tAdecuado\n" +
      "TMT Parte B\t58.120 s\t72.30 s\tPc 65\tAdecuado\n" +
      "Temblor Motor\t1.8 Hz\t<3.5 Hz\tPc 50\tFisiológico Normal"
    );
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Excel Green Bar */}
        <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base block font-mono">
                PLC_Reporte_Clinico_#NP-8842.xlsx
              </span>
              <span className="text-[11px] text-emerald-200">
                Generado automáticamente • Baremos ajustados por Edad y Escolaridad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              {downloaded ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloaded ? '¡Descargado!' : 'Descargar .XLSX / .CSV'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Patient header card inside Excel preview */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Paciente</span>
            <span className="font-bold text-slate-900">Elena Morales (ID: #NP-8842)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Edad / Escolaridad</span>
            <span className="font-semibold text-slate-900">68 años • 12 años (Secundaria)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Especialista Evaluador</span>
            <span className="font-semibold text-slate-900">Dra. Carmen Valenzuela (Colegiada)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Precisión Cronometría</span>
            <span className="font-bold text-emerald-700 font-mono">&plusmn;0.3ms (Canvas Engine)</span>
          </div>
        </div>

        {/* Excel Sheets Navigation Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-100 px-4 pt-2 gap-1 text-xs">
          <button
            onClick={() => setActiveSheet('summary')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeSheet === 'summary'
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Hoja 1: Resumen Clínico Baremado</span>
          </button>

          <button
            onClick={() => setActiveSheet('telemetry')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeSheet === 'telemetry'
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Hoja 2: Telemetría Latencias (ms)</span>
          </button>

          <button
            onClick={() => setActiveSheet('kinematics')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeSheet === 'kinematics'
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hoja 3: Cinemática Temblor Motor</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="p-5 overflow-auto flex-1 text-xs">
          {activeSheet === 'summary' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Variable Clínica / Batería</th>
                      <th className="p-3">Tiempo Directo</th>
                      <th className="p-3">Media Poblacional (65-70a)</th>
                      <th className="p-3">Puntuación Z</th>
                      <th className="p-3">Percentil (Pc)</th>
                      <th className="p-3">Interpretación Clínica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">Trail Making Test - Parte A</td>
                      <td className="p-3 text-blue-700 font-bold">24.812 s (24,812 ms)</td>
                      <td className="p-3 text-slate-600">29.400 s (DE: 6.8s)</td>
                      <td className="p-3 text-slate-800">-0.67</td>
                      <td className="p-3 font-bold text-emerald-700 font-sans">Pc 75</td>
                      <td className="p-3 font-sans text-emerald-700 font-semibold">Rango Normal Adecuado</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/40">
                      <td className="p-3 font-sans font-semibold text-slate-900">Trail Making Test - Parte B</td>
                      <td className="p-3 text-blue-700 font-bold">58.120 s (58,120 ms)</td>
                      <td className="p-3 text-slate-600">72.300 s (DE: 14.2s)</td>
                      <td className="p-3 text-slate-800">-1.00</td>
                      <td className="p-3 font-bold text-emerald-700 font-sans">Pc 65</td>
                      <td className="p-3 font-sans text-emerald-700 font-semibold">Flexibilidad Preservada</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">Índice de Costo Alternante (B - A)</td>
                      <td className="p-3 text-slate-800 font-bold">33.308 s</td>
                      <td className="p-3 text-slate-600">42.900 s</td>
                      <td className="p-3 text-slate-800">-0.72</td>
                      <td className="p-3 font-bold text-emerald-700 font-sans">Pc 70</td>
                      <td className="p-3 font-sans text-emerald-700 font-semibold">Velocidad Ejecutiva Óptima</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/40">
                      <td className="p-3 font-sans font-semibold text-slate-900">Biomarcador Temblor Espectral</td>
                      <td className="p-3 text-purple-700 font-bold">1.8 Hz (Baja oscilación)</td>
                      <td className="p-3 text-slate-600">&lt; 3.5 Hz</td>
                      <td className="p-3 text-slate-800">0.0</td>
                      <td className="p-3 font-bold text-emerald-700 font-sans">Pc 50</td>
                      <td className="p-3 font-sans text-emerald-700 font-semibold">Temblor Fisiológico Normal</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSheet === 'telemetry' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Nodo Origen &rarr; Destino</th>
                      <th className="p-3">Latencia de Reacción (RT)</th>
                      <th className="p-3">Tiempo de Movimiento (MT)</th>
                      <th className="p-3">Distancia Euclídea</th>
                      <th className="p-3">Velocidad Media</th>
                      <th className="p-3">Errores de Selección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">1 &rarr; A</td>
                      <td className="p-3 text-blue-600 font-bold">342 ms</td>
                      <td className="p-3">890 ms</td>
                      <td className="p-3">218 px</td>
                      <td className="p-3">245 px/s</td>
                      <td className="p-3 text-emerald-700 font-bold">0</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/40">
                      <td className="p-3 font-sans font-semibold text-slate-900">A &rarr; 2</td>
                      <td className="p-3 text-blue-600 font-bold">410 ms</td>
                      <td className="p-3">940 ms</td>
                      <td className="p-3">305 px</td>
                      <td className="p-3">324 px/s</td>
                      <td className="p-3 text-emerald-700 font-bold">0</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">2 &rarr; B</td>
                      <td className="p-3 text-blue-600 font-bold">385 ms</td>
                      <td className="p-3">820 ms</td>
                      <td className="p-3">195 px</td>
                      <td className="p-3">238 px/s</td>
                      <td className="p-3 text-emerald-700 font-bold">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSheet === 'kinematics' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Parámetro Cinemático</th>
                      <th className="p-3">Valor Estimado</th>
                      <th className="p-3">Límite de Alerta Clínica</th>
                      <th className="p-3">Observaciones de Integridad Motora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">Índice de Jerk Normalizado</td>
                      <td className="p-3 text-emerald-700 font-bold">0.14 m/s³</td>
                      <td className="p-3">&gt; 0.45 m/s³</td>
                      <td className="p-3 font-sans text-slate-600">Curvatura motora armónica y continua sin dismetría.</td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/40">
                      <td className="p-3 font-sans font-semibold text-slate-900">Frecuencia Pico Espectral</td>
                      <td className="p-3 text-emerald-700 font-bold">1.8 Hz</td>
                      <td className="p-3">&gt; 4.0 Hz (Sospecha temblor)</td>
                      <td className="p-3 font-sans text-slate-600">Ausencia de componentes oscilatorios rítmicos en banda patológica.</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">Entropía de Trayectoria</td>
                      <td className="p-3 text-emerald-700 font-bold">0.82 bits</td>
                      <td className="p-3">&gt; 1.40 bits</td>
                      <td className="p-3 font-sans text-slate-600">Trazado directo hacia los objetivos con mínima vacilación espacial.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            onClick={handleCopy}
            className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar Tabla para SPSS / R'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Archivo (.XLSX)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
