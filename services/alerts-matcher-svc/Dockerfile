FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN apt-get update && apt-get install -y g++ libgeos-dev && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8007

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8007"]
