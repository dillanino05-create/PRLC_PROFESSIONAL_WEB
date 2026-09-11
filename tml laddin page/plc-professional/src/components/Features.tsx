import React, { useState } from 'react';
import { 
  Clock, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  Lock, 
  Check, 
  TrendingUp, 
  Eye, 
  BarChart3,
  Server,
  KeyRound,
  FileCheck2
} from 'lucide-react';

export const Features: React.FC = () => {
  const [activeTremorFreq, setActiveTremorFreq] = useState<'normal' | 'tremor'>('normal');

  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/80">
            <Cpu className="w-3.5 h-3.5" />
            <span>Arquitectura Clínica de Vanguardia</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Precisión científica que supera el papel y lápiz
          </h2>
          <p className="text-lg text-slate-600">
            Diseñado con estándares psicométricos internacionales para eliminar sesgos manuales y extraer biomarcadores invisibles al ojo humano.
          </p>
        </div>

        {/* Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          
          {/* Bento Card 1: Cronometría Exacta de Milisegundos (Canvas) - 7 cols */}
          <div className="lg:col-span-7 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-7 sm:p-9 text-white shadow-xl border border-slate-700/80 flex flex-col justify-between relative overflow-hidden group">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-400 flex items-center justify-center">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                  Precisión 0.001 ms
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  1. Cronometría exacta de milisegundos (Canvas)
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  El cronómetro manual introduce un error humano de hasta 400 ms en cada ensayo. PLC Professional corre sobre un motor de renderizado HTML5 Canvas de 60 a 120 Hz impulsado por <code className="text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">performance.now()</code>.
                </p>
              </div>

              {/* Technical Comparison Graphic */}
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/80 rounded-xl p-3 border border-rose-500/20">
                  <div className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
                    <span>✕ Método Tradicional (Papel)</span>
                  </div>
                  <div className="text-lg font-bold text-slate-300 mt-1 font-mono">± 350 - 500 ms</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Latencia por reacción manual y paralaje del evaluador.</p>
                </div>

                <div className="bg-slate-800/80 rounded-xl p-3 border border-emerald-500/30">
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <span>✓ PLC Professional (Canvas)</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">&lt; 0.8 ms</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sincronización directa con el refresco de pantalla.</p>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Desglose por latencia de inicio (Reaction Time) y tiempo de ejecución (Movement Time).</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Compatibilidad con muestreo táctil de alta frecuencia en iPads y tabletas médicas.</span>
                </div>
              </div>
            </div>

            {/* Bottom canvas watermark */}
            <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Timestamp Hardware: monotonic_clock</span>
              <span className="text-cyan-400">Delta real: 16.66ms @ 60Hz</span>
            </div>
          </div>

          {/* Bento Card 2: Biomarcadores Digitales (Temblor Motor) - 5 cols */}
          <div id="biomarkers" className="lg:col-span-5 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 rounded-2xl p-7 sm:p-9 text-slate-900 shadow-xl border border-blue-200/80 flex flex-col justify-between relative overflow-hidden group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Activity className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300/60">
                  IA & Cinemática
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  2. Biomarcadores Digitales
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Detección y análisis cuantitativo del <span className="font-semibold text-slate-900">temblor motor</span> mediante el análisis de la cinemática del cursor y lápiz óptico en tiempo real.
                </p>
              </div>

              {/* Interactive Signal Toggle */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Simulación de señal cinemática:</span>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                    <button
                      onClick={() => setActiveTremorFreq('normal')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                        activeTremorFreq === 'normal'
                          ? 'bg-white text-blue-700 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Sano (1.5 Hz)
                    </button>
                    <button
                      onClick={() => setActiveTremorFreq('tremor')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                        activeTremorFreq === 'tremor'
                          ? 'bg-amber-600 text-white shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Temblor (5.8 Hz)
                    </button>
                  </div>
                </div>

                {/* SVG Visual Waveform */}
                <div className="h-20 bg-slate-950 rounded-lg p-2 flex flex-col justify-between overflow-hidden relative">
                  <div className="text-[9px] font-mono text-slate-400 flex justify-between">
                    <span>ACELERACIÓN TANGENCIAL</span>
                    <span className={activeTremorFreq === 'normal' ? 'text-emerald-400' : 'text-amber-400'}>
                      {activeTremorFreq === 'normal' ? 'Sin indicios patológicos' : 'Alerta: Micro-oscilación'}
                    </span>
                  </div>

                  <svg className="w-full h-10" viewBox="0 0 300 40" preserveAspectRatio="none">
                    {activeTremorFreq === 'normal' ? (
                      <path
                        d="M 0,20 Q 30,12 60,20 T 120,22 T 180,18 T 240,21 T 300,20"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                    ) : (
                      <path
                        d="M 0,20 Q 10,6 20,20 T 40,32 T 60,8 T 80,31 T 100,7 T 120,33 T 140,8 T 160,32 T 180,9 T 200,31 T 220,9 T 240,31 T 260,8 T 280,30 T 300,20"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                    )}
                  </svg>

                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>Frecuencia: {activeTremorFreq === 'normal' ? '1.4 Hz' : '5.8 Hz'}</span>
                    <span>Jerk: {activeTremorFreq === 'normal' ? '0.12' : '0.84 m/s³'}</span>
                  </div>
                </div>
              </div>

              {/* Sub features */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Detección de temblor esencial y temblor de acción en extremidad superior.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Cálculo automático de fluidez de trazado (Smoothness & Jerk Index).</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Registro continuo a 100 Hz</span>
              <span className="font-semibold text-blue-700">Telemetría Biométrica</span>
            </div>
          </div>

          {/* Bento Card 3: Seguridad RLS y Privacidad del Paciente - 12 cols (or 6 cols) */}
          <div id="security" className="lg:col-span-6 bg-white rounded-2xl p-7 sm:p-9 text-slate-900 shadow-xl border border-slate-200 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="w-3 h-3" />
                  RLS Hardened
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  3. Seguridad RLS y Privacidad del Paciente
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Garantía de aislamiento absoluto de datos mediante <span className="font-semibold text-slate-900">Row Level Security (RLS)</span>. Ningún evaluador ni clínica puede acceder por error o vulnerabilidad a las historias de otro profesional.
                </p>
              </div>

              {/* RLS Diagram Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-200">
                  <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    Base de Datos PostgreSQL con RLS
                  </span>
                  <span className="text-emerald-700 font-semibold">POLICY: tenant_isolation</span>
                </div>

                <div className="bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
                  <span className="text-purple-400">CREATE POLICY</span> clinical_record_isolation <br />
                  <span className="text-purple-400">ON</span> patient_evaluations <br />
                  <span className="text-purple-400">FOR ALL USING</span> ( <br />
                  &nbsp;&nbsp;auth.uid() = doctor_id <span className="text-emerald-400">/* Bloqueo estricto */</span> <br />
                  );
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 font-sans">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Anonimización de datos (HIPAA Safe Harbor)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Cifrado de grado militar AES-256</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Auditoría de accesos inmutable</span>
              <span className="font-semibold text-emerald-700">100% Confidencial</span>
            </div>
          </div>

          {/* Bento Card 4: Reportes Clínicos en Excel & Baremos - 6 cols */}
          <div className="lg:col-span-6 bg-gradient-to-br from-slate-50 to-white rounded-2xl p-7 sm:p-9 text-slate-900 shadow-xl border border-slate-200 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <FileSpreadsheet className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Formatos Médicos Estándar
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Reportes Inmediatos en Excel y PDF
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Olvídate de transcribir a mano los tiempos del cronómetro y buscar en tablas de baremos. Con un clic obtienes el informe estructurado listo para la consulta o el análisis estadístico en SPSS o R.
                </p>
              </div>

              {/* Excel Preview pill */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    Estructura de Hoja de Cálculo Generada:
                  </span>
                  <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-600">
                    .XLSX &amp; .CSV
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="p-2 rounded bg-slate-50 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-700">Pestaña 1: Resumen Clínico</span>
                    <span className="text-emerald-700 font-semibold">Percentiles &amp; Puntuación Z</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-700">Pestaña 2: Telemetría Latencias</span>
                    <span className="text-blue-700 font-semibold">Milisegundo por ítem</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-700">Pestaña 3: Cinemática Motora</span>
                    <span className="text-purple-700 font-semibold">Oscilaciones &amp; Curvatura</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Baremos estratificados por edad y escolaridad</span>
              <span className="font-semibold text-slate-800">Descarga Instantánea</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
