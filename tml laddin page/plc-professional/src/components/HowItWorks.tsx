import React from 'react';
import { UserPlus, PlayCircle, FileSpreadsheet, ArrowRight, CheckCircle2, FileCheck, Database, Laptop } from 'lucide-react';

interface HowItWorksProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenExcelPreview: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ onOpenAuth, onOpenExcelPreview }) => {
  const steps = [
    {
      number: '01',
      title: 'Registra al paciente',
      short: 'Menos de 60 segundos',
      description: 'Ingresa los datos sociodemográficos clave (edad, años de escolaridad, lateralidad) con anonimización automática (ID clínico seguro) para aislar la privacidad con RLS.',
      icon: UserPlus,
      color: 'blue',
      preview: {
        tag: 'Ficha Clínica Rápida',
        lines: [
          'ID: #NP-8842 (Hash seguro anonimizado)',
          'Edad: 68 años • Escolaridad: 12 años',
          'Motivo: Despistaje deterioro cognitivo',
        ]
      }
    },
    {
      number: '02',
      title: 'Ejecuta la prueba interactiva',
      short: 'En tablet, iPad o laptop',
      description: 'El paciente realiza la batería con instrucciones guiadas en pantalla. El motor Canvas registra latencias a nivel de milisegundo y micro-movimientos cinemáticos del cursor.',
      icon: PlayCircle,
      color: 'cyan',
      preview: {
        tag: 'Batería Digital Activa',
        lines: [
          'Calibración de pantalla completada',
          'Cronómetro de alta precisión: activo',
          'Telemetría cinemática de temblor: 100 Hz',
        ]
      }
    },
    {
      number: '03',
      title: 'Descarga el reporte en Excel',
      short: 'Generación clínica automática',
      description: 'Obtén al instante la hoja de cálculo estructurada con baremos estandarizados, percentiles automáticos, curvas cinemáticas y formato listo para tu informe o análisis en SPSS/R.',
      icon: FileSpreadsheet,
      color: 'emerald',
      preview: {
        tag: 'Archivo .XLSX Estructurado',
        lines: [
          'Puntuaciones directas y percentiles (Pc)',
          'Desglose por tiempos de reacción y motricidad',
          'Exportable con 1 clic a tu historia médica',
        ]
      }
    }
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-slate-50/70 border-t border-slate-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-blue-800 text-xs font-bold border border-blue-200">
            <span>Flujo Clínico en 3 Pasos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            De la evaluación al informe en 3 simples pasos
          </h2>
          <p className="text-lg text-slate-600">
            Sin papeles que archivar, sin cálculos manuales de baremos y sin retrasos de transcripción.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="bg-white rounded-2xl p-7 border border-slate-200 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between group hover:-translate-y-1 relative"
              >
                {/* Step number badge */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6 stroke-[2]" />
                  </div>
                  <span className="text-2xl font-black text-slate-300 font-mono group-hover:text-blue-600 transition-colors">
                    {step.number}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block">
                    {step.short}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Step mini preview box */}
                <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/80 rounded-xl p-3 text-xs space-y-1.5 font-mono text-slate-600">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase pb-1 border-b border-slate-200">
                    <span>{step.preview.tag}</span>
                    <span className="text-emerald-600">✓ Listo</span>
                  </div>
                  {step.preview.lines.map((line, lIdx) => (
                    <div key={lIdx} className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                      <span className="truncate">{line}</span>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}

        </div>

        {/* Action beneath steps */}
        <div className="mt-14 bg-white rounded-2xl p-6 sm:p-8 border border-blue-100 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg font-bold text-slate-900">
              ¿Quieres ver cómo luce un reporte real en Excel?
            </h4>
            <p className="text-sm text-slate-600">
              Explora las hojas de datos estructurados, percentiles y telemetría de latencias.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onOpenExcelPreview}
              className="px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-sm border border-emerald-200 flex items-center gap-2 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ver Ejemplo de Reporte Excel</span>
            </button>

            <button
              onClick={() => onOpenAuth('register')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <span>Comenzar Ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
