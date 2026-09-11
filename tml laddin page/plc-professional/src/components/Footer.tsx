import React from 'react';
import { Activity, ShieldCheck, Lock, Mail, Phone, MapPin, Globe, ExternalLink, FileText } from 'lucide-react';

interface FooterProps {
  onOpenLegalModal: (type: 'terms' | 'privacy' | 'hipaa') => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegalModal }) => {
  return (
    <footer id="main-footer" className="bg-slate-950 text-slate-300 border-t border-slate-850 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 4-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
          
          {/* Brand Info - 4 cols */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                PLC <span className="text-blue-500">Professional</span>
              </span>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Plataforma SaaS HealthTech especializada en evaluación neuropsicológica digital. Precisión sub-milisegundo en Canvas, telemetría de temblor motor y reportes clínicos en Excel para profesionales e instituciones.
            </p>

            <div className="pt-2 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Cumplimiento Estándar HIPAA Safe Harbor y RGPD Salud</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Base de Datos PostgreSQL con Row-Level Security (RLS)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Infraestructura Médica en Cloud con Cifrado AES-256</span>
              </div>
            </div>
          </div>

          {/* Column 2: Producto - 2 cols */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Producto
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#features" className="hover:text-white transition-colors">Cronometría Canvas</a>
              </li>
              <li>
                <a href="#biomarkers" className="hover:text-white transition-colors">Biomarcadores Temblor</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">Reportes Excel</a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition-colors">Seguridad RLS</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">Planes y Precios</a>
              </li>
              <li>
                <a href="#demo-interactive" className="hover:text-white transition-colors">Simulador en Vivo</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Cumplimiento Médico - 3 cols (Crucial) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Legal y Privacidad Médica</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onOpenLegalModal('privacy')}
                  className="hover:text-blue-400 text-left transition-colors cursor-pointer"
                >
                  Política de Privacidad de Datos de Salud (ePHI)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegalModal('terms')}
                  className="hover:text-blue-400 text-left transition-colors cursor-pointer"
                >
                  Términos y Condiciones del Servicio
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegalModal('hipaa')}
                  className="hover:text-blue-400 text-left transition-colors cursor-pointer"
                >
                  Acuerdo de Asociación Comercial (BAA / HIPAA)
                </button>
              </li>
              <li>
                <span className="text-slate-500">Consentimiento Informado Digital para Pacientes</span>
              </li>
              <li>
                <span className="text-slate-500">Protocolo de Gestión y Custodia de Historias Clínicas</span>
              </li>
              <li>
                <span className="text-slate-500">Política de Retención y Supresión de Datos</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contacto & Instituciones - 3 cols */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Contacto y Soporte
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>contacto@plcprofessional.health</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>+1 (800) 412-NEURO (Soporte Especialistas)</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>HealthTech Innovation Hub, Edificio Biociencias, Nivel 4</span>
              </div>
            </div>

            <div className="pt-3">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-200 block">SLA de Servicio y Disponibilidad</span>
                <span>99.98% de tiempo operativo garantizado. Servidores dedicados con respaldos horarios redundantes.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Clinical Disclaimer Box (Essential for Medical SaaS) */}
        <div className="my-8 p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 text-xs leading-relaxed">
          <p>
            <strong className="text-slate-200 font-semibold">Descargo de Responsabilidad Clínica:</strong> PLC Professional es un software de telemetría psicométrica y soporte a la decisión diagnóstica diseñado exclusivamente para su uso por o bajo la supervisión de profesionales de la salud debidamente cualificados y titulados (psicólogos, neuropsicólogos, neurólogos, psiquiatras). Los biomarcadores cinemáticos y tiempos de reacción constituyen datos complementarios que no reemplazan el juicio clínico exhaustivo del facultativo ni constituyen por sí solos un diagnóstico definitivo.
          </p>
        </div>

        {/* Bottom Bar: Copyright & Compliance Seals */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} PLC Professional HealthTech Systems Inc. Todos los derechos reservados.
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="hover:text-slate-400 transition-colors cursor-pointer" onClick={() => onOpenLegalModal('terms')}>Términos</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer" onClick={() => onOpenLegalModal('privacy')}>Privacidad</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer" onClick={() => onOpenLegalModal('hipaa')}>Seguridad RLS / HIPAA</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
