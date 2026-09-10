# 🤖 Reglas del Proyecto — PLC Professional (MecaPsi)

## ⚠️ REGLA PERMANENTE Y OBLIGATORIA: AHORRO DE TOKENS MEDIANTE OBSIDIAN VAULT

1. **PROHIBIDO LEER ARCHIVOS COMPLETOS DE ENTRADA:**
   Los archivos principales del proyecto (`web/frontend/js/app.js`, `web/backend/main.py`, `web/backend/excel_export.py`) contienen miles de líneas.
   **NUNCA** ejecutes `view_file` sobre estos archivos completos sin especificar `StartLine` y `EndLine`.

2. **CONSULTAR PRIMERO LA BÓVEDA DE CONOCIMIENTO (OBSIDIAN):**
   Antes de buscar o razonar a ciegas sobre la arquitectura, debes leer la nota conceptual correspondiente en la carpeta `obsidian_vault/`:
   - `obsidian_vault/00 - INDICE GENERAL DEL SISTEMA.md` (Índice Maestro de la Arquitectura)
   - `obsidian_vault/01 - Arquitectura de Despliegue.md` (GitHub vs Vercel vs Hugging Face vs Supabase)
   - `obsidian_vault/02 - Frontend y Experiencia de Usuario.md` (Flujos de pantalla y estado de `app.js`)
   - `obsidian_vault/03 - Backend y Modelos de Inteligencia Artificial.md` (FastAPI y modelo MLP Keras)
   - `obsidian_vault/04 - Base de Datos y Supabase.md` (Tabla `evaluations` y políticas RLS)
   - `obsidian_vault/05 - Test d2 y Metricas Clinicas.md` (Fórmulas psicométricas exactas)
   - `obsidian_vault/06 - Biomarcadores Digitales y Tremor.md` (Cinemática del mouse y umbrales)
   - `obsidian_vault/07 - SuperAdmin Dashboard.md` (Panel administrativo de Dilan)
   - `obsidian_vault/08 - Exportacion y Reportes Excel.md` (Estructura de reportes `openpyxl`)
   - `obsidian_vault/09 - Protocolo de Ahorro de Tokens para LLMs.md` (Guía de lectura quirúrgica)

3. **MODIFICACIONES QUIRÚRGICAS:**
   Utiliza `grep_search` para encontrar el número de línea exacto de la función a modificar, lee solo esa sección y aplica `replace_file_content` o `multi_replace_file_content` de forma precisa.

4. **SINCRONIZACIÓN DE DESPLIEGUE:**
   - Todo cambio en el Frontend debe enviarse a **GitHub** (`git push origin main`), lo que dispara el despliegue automático en **Vercel**.
   - Todo cambio en el Backend/IA o APIs debe enviarse a **Hugging Face Spaces** (`git push hf main`), además de GitHub.
