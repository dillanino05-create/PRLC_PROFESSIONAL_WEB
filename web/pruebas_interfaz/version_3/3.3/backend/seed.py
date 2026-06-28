# ═══════════════════════════════════════════════════════
#  MecaPsi v3.3 — seed.py
#  Poblar la base de datos con datos simulados iniciales
# ═══════════════════════════════════════════════════════
from models import (
    create_tables, engine, hash_password,
    Usuario, Paciente, Nota, CitaAgenda, EvaluacionPLC, TokenConsumo
)
from sqlmodel import Session, select

def seed():
    create_tables()
    with Session(engine) as session:

        # Verificar si ya fue sembrado
        existing = session.exec(select(Usuario)).first()
        if existing:
            print("✅ Base de datos ya tiene datos. Omitiendo seed.")
            return

        # ─── Usuarios ───────────────────────────────
        dilan = Usuario(
            username="dilan",
            password_hash=hash_password("123"),
            role="admin",
            name="Dilan Guerrero",
            initials="DG",
            org="MecaPsi Corp.",
            org_code="MC",
            cargo="Administrador del Sistema",
            tokens_disponibles=9999,
            tokens_mes=9999
        )
        pepito = Usuario(
            username="pepito",
            password_hash=hash_password("123"),
            role="psicologo",
            name="Dr. Pepito López",
            initials="PL",
            org="Clínica Los Andes",
            org_code="CLA",
            cargo="Psicólogo Evaluador",
            plan="oro",
            plan_vence="15 May, 2026",
            tokens_disponibles=42,
            tokens_mes=50
        )
        session.add(dilan)
        session.add(pepito)
        session.commit()
        session.refresh(dilan)
        session.refresh(pepito)

        # ─── Pacientes ──────────────────────────────
        pacientes_data = [
            {"codigo": "PAC-0041", "nombre": "Ramírez, C. A.", "edad": 28, "genero": "M", "motivo": "Evaluación de atención y concentración laboral.", "estado": "Activo"},
            {"codigo": "PAC-0127", "nombre": "López, M. F.",   "edad": 34, "genero": "F", "motivo": "Seguimiento por dificultades de procesamiento.", "estado": "Activo"},
            {"codigo": "PAC-0088", "nombre": "Hernández, J. L.","edad": 22, "genero": "M", "motivo": "Tamizaje cognitivo rutinario universitario.", "estado": "Activo"},
            {"codigo": "PAC-0203", "nombre": "Torres, A. P.",  "edad": 41, "genero": "F", "motivo": "Asimetría hemisférica sospechada.", "estado": "Seguimiento"},
            {"codigo": "PAC-0019", "nombre": "Gómez, P. R.",   "edad": 19, "genero": "M", "motivo": "Latencia alta recurrente. Primera evaluación.", "estado": "Prioritario"},
        ]
        pacs = []
        for pd in pacientes_data:
            p = Paciente(psicologo_id=pepito.id, **pd)
            session.add(p)
            pacs.append(p)
        session.commit()
        for p in pacs:
            session.refresh(p)

        # ─── Notas ──────────────────────────────────
        notas_data = [
            (0, "Rendimiento dentro del rango normativo. Latencia consistente a lo largo de todos los ítems.", "Evaluación"),
            (0, "Paciente colaborador. Sin alteraciones conductuales durante la prueba.", "Observación"),
            (1, "Variabilidad inter-ítem elevada. Sugiere seguimiento en velocidad de procesamiento.", "Evaluación"),
            (2, "Perfil de alta eficiencia cognitiva. Latencias mínimas en todos los ítems.", "Evaluación"),
            (3, "Asimetría hemisférica detectada. Se recomienda reevaluación en 30 días.", "Seguimiento"),
            (4, "Latencia consistentemente alta. Revisar condiciones de evaluación y re-aplicar.", "Evaluación"),
        ]
        for (pac_idx, texto, tipo) in notas_data:
            n = Nota(
                paciente_id=pacs[pac_idx].id,
                psicologo_id=pepito.id,
                texto=texto,
                tipo=tipo
            )
            session.add(n)

        # ─── Agenda ─────────────────────────────────
        agenda_data = [
            {"paciente_nombre": "Ramírez, C. A.", "fecha": "2026-04-25", "hora": "09:00", "tipo": "PLC v3 — Evaluación",      "estado": "Confirmada", "color": "#16a34a"},
            {"paciente_nombre": "López, M. F.",   "fecha": "2026-04-25", "hora": "10:30", "tipo": "PLC v3 + Entrevista",       "estado": "Confirmada", "color": "#2563eb"},
            {"paciente_nombre": "Vargas, S. T.",  "fecha": "2026-04-25", "hora": "12:00", "tipo": "Devolución de resultados",  "estado": "Pendiente",  "color": "#d97706"},
            {"paciente_nombre": "Hernández, J. L.","fecha": "2026-04-25","hora": "14:00", "tipo": "Devolución PLC",            "estado": "Confirmada", "color": "#7c3aed"},
            {"paciente_nombre": "Torres, A. P.",  "fecha": "2026-04-25", "hora": "16:30", "tipo": "PLC v3 — Evaluación",       "estado": "Confirmada", "color": "#ea580c"},
        ]
        for ad in agenda_data:
            c = CitaAgenda(psicologo_id=pepito.id, **ad)
            session.add(c)

        # ─── Evaluaciones históricas ─────────────────
        eval_data = [
            (0, "dss-p0", "Base Normativa",    98.5),
            (1, "dss-p2", "Alta Reactividad",  91.2),
            (2, "dss-p6", "Alta Eficiencia",   99.1),
            (3, "dss-p3", "Varianza Bilateral", 83.7),
            (4, "dss-p1", "Latencia Sostenida", 74.3),
        ]
        for (pac_idx, perfil, label, conf) in eval_data:
            e = EvaluacionPLC(
                paciente_id=pacs[pac_idx].id,
                psicologo_id=pepito.id,
                perfil_dss=perfil,
                perfil_label=label,
                confianza=conf
            )
            session.add(e)

        # ─── Consumo de tokens histórico ────────────
        for i in range(8):
            t = TokenConsumo(user_id=pepito.id, prueba="PLC v3")
            session.add(t)

        session.commit()
        print("🌱 Seed completado. Base de datos lista con datos simulados.")

if __name__ == "__main__":
    seed()
