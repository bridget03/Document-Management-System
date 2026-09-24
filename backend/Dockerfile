FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x /app/start.sh
ENV STORAGE_PATH=/data/storage
VOLUME ["/data/storage"]
EXPOSE 8000
CMD ["./start.sh"]
