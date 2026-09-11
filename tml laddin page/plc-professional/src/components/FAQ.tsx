import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQItem } from '../types';

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: '¿Cómo garantiza PLC Professional la cronometría exacta de milisegundos en un navegador?',
      answer: 'A diferencia de aplicaciones web tradicionales que dependen de temporizadores estándar imprecisos (como setTimeout o setInterval), el motor de PLC Professional utiliza la API nativa window.performance.now() sincronizada con el bucle de renderizado requestAnimationFrame de HTML5 Canvas. Esto proporciona una precisión temporal inferior a 1 milisegundo (0.001 ms), eliminando el margen de error humano del cronómetro manual.',
      category: 'technical'
    },
    {
      question: '¿Cómo funciona la detección de temblor motor mediante la cinemática del cursor?',
      answer: 'Durante el desarrollo de la prueba interactiva, el sistema captura las coordenadas espaciales (x, y) y los deltas de tiempo a una frecuencia de hasta 120 Hz. Mediante algoritmos de procesamiento de señal, se descompone la trayectoria en velocidad tangencial, aceleración y Jerk Index, identificando micro-oscilaciones rítmicas en el rango de 4 a 12 Hz características del temblor motor postural o de acción.',
      category: 'clinical'
    },
    {
      question: '¿Qué es la Seguridad RLS y cómo protege los datos confidenciales de mis pacientes?',
      answer: 'RLS (Row Level Security) es una política de seguridad a nivel de motor de base de datos. Garantiza que cada consulta ejecutada solo pueda devolver y modificar los registros donde el ID del profesional coincida estrictamente con la sesión autenticada. Ni siquiera una consulta accidental desde el frontend puede acceder a datos de otro médico o clínica. Además, los identificadores personales se anonimizan siguiendo las directrices de HIPAA Safe Harbor y el RGPD.',
      category: 'security'
    },
    {
      question: '¿En qué dispositivos puede aplicarse la prueba?',
      answer: 'PLC Professional es 100% responsivo y compatible con tabletas (iPad, Samsung Galaxy Tab), laptops y ordenadores de sobremesa. Admite interacción táctil con los dedos, lápices ópticos de alta precisión (Apple Pencil, S-Pen) o ratón convencional.',
      category: 'technical'
    },
    {
      question: '¿Cómo son los reportes que se descargan en Excel?',
      answer: 'El reporte se genera en formato nativo Microsoft Excel (.xlsx) estructurado en pestañas profesionales: 1) Resumen de resultados con baremos poblacionales y percentiles ajustados a la edad y escolaridad del paciente, 2) Telemetría detallada ítem por ítem con latencias brutas, y 3) Métricas cinemáticas. Está listo para imprimir, adjuntar al informe clínico o exportar directamente a paquetes estadísticos como SPSS, R o Stata.',
      category: 'clinical'
    },
    {
      question: '¿La prueba gratuita de 14 días requiere tarjeta de crédito?',
      answer: 'No. Puedes registrarte y comenzar a evaluar de forma inmediata sin ingresar ningún método de pago. Al finalizar los 14 días podrás decidir si deseas continuar con el Plan Básico, Pro o Institucional.',
      category: 'billing'
    }
  ];

  return (
    <section id="faq" className="py-20 lg:py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center space-y-3 mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Resolución de Dudas Frecuentes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Preguntas Frecuentes
          </h2>
          <p className="text-base text-slate-600">
            Todo lo que necesitas saber sobre precisión métrica, seguridad clínica y exportación de datos.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-semibold text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
