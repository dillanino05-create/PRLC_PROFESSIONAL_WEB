import React from 'react';
import { Star, ShieldCheck, Quote } from 'lucide-react';
import { Testimonial } from '../types';

export const Testimonials: React.FC = () => {
  const testimonials: Testimonial[] = [
    {
      id: '1',
      quote: 'PLC Professional redujo el tiempo de pase del TMT de 25 minutos a solo 8 minutos por paciente, incluyendo la corrección automática de baremos. La detección del temblor motor mediante la cinemática del cursor nos permitió sospechar un caso precoz de parkinsonismo que luego confirmamos con DAT-Scan.',
      author: 'Dra. Carmen Valenzuela',
      role: 'Neuropsicóloga Clínica & Docente Universitaria',
      institution: 'Hospital Clínico Universitario',
      rating: 5,
      avatar: 'CV',
      verifiedDoctor: true,
    },
    {
      id: '2',
      quote: 'El error humano del cronómetro en papel siempre fue un dolor de cabeza en nuestro laboratorio de investigación. Con la precisión de milisegundos en Canvas y la exportación limpia a Excel, ahorramos más de 40 horas de trabajo manual en cada estudio multicéntrico.',
      author: 'Dr. Alejandro Ríos',
      role: 'Director del Laboratorio de Neurociencias',
      institution: 'Instituto de Neurociencias Aplicadas',
      rating: 5,
      avatar: 'AR',
      verifiedDoctor: true,
    },
    {
      id: '3',
      quote: 'La seguridad RLS nos brindó la tranquilidad jurídica que exige el comité de ética y la ley de protección de datos de salud. Cada especialista solo visualiza a sus pacientes asignados y las hojas de Excel se generan sin fricción.',
      author: 'Dra. Sofía Mendoza',
      role: 'Neuróloga & Coordinadora de Unidad de Memoria',
      institution: 'Centro Médico San Rafael',
      rating: 5,
      avatar: 'SM',
      verifiedDoctor: true,
    }
  ];

  return (
    <section id="testimonials" className="py-20 bg-slate-50 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-blue-800 text-xs font-bold border border-blue-200">
            <span>Validación por Pares Clínicos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Respaldado por especialistas en salud cerebral
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Conoce cómo neuropsicólogos y neurólogos han transformado su práctica clínica diaria.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative"
            >
              <Quote className="w-8 h-8 text-blue-100 absolute top-6 right-6 pointer-events-none" />

              <div className="space-y-4">
                {/* Rating stars */}
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm text-slate-700 leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>

              {/* Author */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {t.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {t.author}
                    </span>
                    {t.verifiedDoctor && (
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" title="Especialista Clínico Verificado" />
                    )}
                  </div>
                  <span className="text-xs text-slate-500 block truncate">{t.role}</span>
                  <span className="text-[11px] text-blue-600 block font-medium truncate">{t.institution}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
