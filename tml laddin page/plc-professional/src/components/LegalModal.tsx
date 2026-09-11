import React from 'react';
import { X, ShieldCheck, FileText, Lock } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  type: 'terms' | 'privacy' | 'hipaa' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, type, onClose }) => {
  if (!isOpen || !type) return null;

  const content = {
    privacy: {
      title: 'Política de Privacidad y Protección de Datos de Salud (ePHI / RGPD)',
      date: 'Última actualización: Septiembre 2026',
      icon: ShieldCheck,
      sections: [
        {
          heading: '1. Compromiso con la Confidencialidad Sanitaria',
          text: 'PLC Professional trata los datos generados durante las evaluaciones neuropsicológicas bajo la categoría especial de Datos de Salud (artículo 9 del RGPD y Health Insurance Portability and Accountability Act - HIPAA). No comercializamos, alquilamos ni transferimos registros clínicos de pacientes a terceros.'
        },
        {
          heading: '2. Arquitectura de Seguridad Row-Level Security (RLS)',
          text: 'La persistencia en base de datos implementa políticas estrictas de seguridad a nivel de fila (Row-Level Security). Toda consulta está ligada criptográficamente al identificador único del profesional o institución sanitaria autorizada, impidiendo cualquier acceso transversal o filtración entre facultativos.'
        },
        {
          heading: '3. Anonimización y Cifrado',
          text: 'Todos los identificadores directos del paciente se encriptan en reposo utilizando el algoritmo AES-256 bits y en tránsito mediante TLS 1.3. Los reportes estadísticos y telemetría cinemática aplican estándares de anonimización conforme al método Safe Harbor de HIPAA.'
        }
      ]
    },
    terms: {
      title: 'Términos y Condiciones del Servicio SaaS',
      date: 'Última actualización: Septiembre 2026',
      icon: FileText,
      sections: [
        {
          heading: '1. Destinatarios y Capacidad Profesional',
          text: 'El acceso a la plataforma PLC Professional está reservado a profesionales con titulación universitaria habilitante en Psicología, Neuropsicología, Medicina (Neurología, Psiquiatría, Geriatría) o centros sanitarios e investigadores acreditados.'
        },
        {
          heading: '2. Soporte a la Decisión Clínica',
          text: 'PLC Professional provee herramientas digitales de medición psicométrica de alta precisión. Las puntuaciones, percentiles y análisis de temblor motor generados constituyen datos auxiliares de telemetría y en ningún caso sustituyen el diagnóstico facultativo, juicio clínico ni anamnesis integral efectuada por el profesional.'
        },
        {
          heading: '3. Disponibilidad y Respaldos',
          text: 'Garantizamos una disponibilidad de servicio del 99.9% (SLA). Se efectúan respaldos automáticos cada hora con replicación geográfica cifrada.'
        }
      ]
    },
    hipaa: {
      title: 'Cumplimiento HIPAA y Acuerdo de Asociación Comercial (BAA)',
      date: 'Última actualización: Septiembre 2026',
      icon: Lock,
      sections: [
        {
          heading: '1. Calificación como Business Associate (BA)',
          text: 'Para centros médicos y entidades cubiertas por HIPAA en EE.UU. o normativas análogas de ePHI en Iberoamérica, PLC Professional formaliza un Business Associate Agreement (BAA) vinculante que regula el tratamiento seguro de la información médica protegida.'
        },
        {
          heading: '2. Medidas de Seguridad Físicas y Técnicas',
          text: 'Infraestructura certificada ISO/IEC 27001, SOC 2 Tipo II, control estricto de accesos biométricos a los centros de procesamiento de datos, auditorías inmutables de acceso a registros clínicos y registro de firmas criptográficas.'
        }
      ]
    }
  }[type];

  const Icon = content.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-['Plus_Jakarta_Sans',sans-serif]">
                {content.title}
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {content.date} • Marco Regulatorio PLC Professional
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
          {content.sections.map((sec, idx) => (
            <div key={idx} className="space-y-1.5">
              <h4 className="font-bold text-slate-900 text-base">
                {sec.heading}
              </h4>
              <p>{sec.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs text-slate-500">
          <span>PLC Professional HealthTech Systems</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
