# Usar una imagen oficial de Python ligera
FROM python:3.10-slim

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar el archivo de requerimientos e instalarlos
COPY web/requirements_web.txt .
RUN pip install --no-cache-dir -r requirements_web.txt

# Copiar TODO el repositorio (incluyendo Modelos Keras en la raíz y la carpeta web)
COPY . .

ENV PORT=7860
EXPOSE 7860

# Comando para arrancar el servidor con Uvicorn (desde la carpeta web)
CMD ["uvicorn", "web.backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
