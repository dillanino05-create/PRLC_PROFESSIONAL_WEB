import React from 'react';
import { ShieldCheck, Lock, Award, HeartPulse, Building2, Stethoscope, CheckCircle2 } from 'lucide-react';

export const SocialProof: React.FC = () => {
  const institutions = [
    { name: 'Hospital Universitario Clínico', subtitle: 'Servicio de Neurología', icon: Building2 },
    { name: 'Instituto NeuroCognitivo', subtitle: 'Unidad de Memoria & TMT', icon: HeartPulse },
    { name: 'Centro Clínico San Rafael', subtitle: 'Neuropsicología del Adulto', icon: Stethoscope },
    { name: 'Lab. Neurociencias Aplicadas', subtitle: 'Investigación Biomarcadores', icon: Award },
    { name: 'Fundación Memoria & Salud', subtitle: 'Red Asistencial Cognitiva', icon: ShieldCheck },
  ];

  const complianceBadges = [
    { label: 'Conformidad HIPAA', detail: 'Protección integral de ePHI en salud' },
    { label: 'Cifrado AES-256', detail: 'Datos en tránsito y en reposo' },
    { label: 'Seguridad RLS', detail: 'Aislamiento estricto fila por fila' },
    { label: 'Cumplimiento RGPD', detail: 'Tratamiento normativo de datos médicos' },
  ];

  return (
    <section id="social-proof" className="border-y border-slate-200 bg-slate-50/70 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Heading */}
        <div className="text-center space-y-2 mb-8">
          <p className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-500 font-mono">
            Confiado por clínicas, hospitales y profesionales de la salud mental
          </p>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Más de <span className="font-semibold text-slate-900">450+ especialistas</span> en neuropsicología, neurología y psiquiatría evalúan con PLC Professional.
          </p>
        </div>

        {/* Grayscale Institutional Badges (DocuSign/Slack style) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
          {institutions.map((inst, index) => {
            const Icon = inst.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/70 border border-slate-200/80 shadow-xs hover:border-blue-200 hover:bg-white transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-4 h-4 stroke-[1.8]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate group-hover:text-slate-900">
                    {inst.name}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    {inst.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compliance & Standards Strip */}
        <div className="mt-10 pt-8 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {complianceBadges.map((badge, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-left">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-800">{badge.label}</span>
                <span className="block text-[11px] text-slate-500 leading-tight mt-0.5">{badge.detail}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
