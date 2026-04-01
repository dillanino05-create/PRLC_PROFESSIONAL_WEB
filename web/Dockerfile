# Usar una imagen oficial de Python ligera
FROM python:3.10-slim

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar el archivo de requerimientos e instalarlos
COPY requirements_web.txt .
RUN pip install --no-cache-dir -r requirements_web.txt

# Copiar el resto del código del backend web
COPY . .

# Hugging Face Spaces por defecto escucha en el puerto 7860.
# Render o Koyeb pueden sobreescribir esta variable $PORT en tiempo de ejecución.
ENV PORT=7860

# Comando para arrancar el servidor con Uvicorn
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
