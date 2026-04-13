# slim over alpine: avoids C-extension build failures if deps grow (e.g. psycopg2, pandas)
FROM python:3.11-slim

# Non-root user; principle of least privilege even for short-lived job containers
RUN groupadd -g 1001 appgroup && \
    useradd  -u 1001 -g appgroup -s /bin/sh -M appuser

WORKDIR /app

# Install deps before copying source — layer cache stays valid on code-only changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup ETL.py .

USER appuser

# No EXPOSE or HEALTHCHECK — this is a one-shot job, not a long-running service
CMD ["python", "ETL.py"]
