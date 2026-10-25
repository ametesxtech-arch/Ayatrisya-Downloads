# Ayatrisya Chat Model Server - Production Dockerfile
# Optimized for Hugging Face Spaces (CPU Basic) and standalone container runtimes
# Parent Company: Ametesx

FROM python:3.10-slim

# Avoid interactive prompts during package installs
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install basic system build dependencies & curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up standard non-root user (UID 1000 required by Hugging Face Spaces)
RUN useradd -m -u 1000 user
ENV HOME=/home/user
ENV PATH=/home/user/.local/bin:$PATH
ENV HF_HOME=/home/user/.cache/huggingface

WORKDIR $HOME/app

# Copy requirements and install
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application files
COPY --chown=user:user . .

# Ensure cache directories have proper permissions
RUN mkdir -p $HF_HOME && chown -R user:user $HOME

USER user

# Default Hugging Face Space port
ENV PORT=7860
ENV HOST=0.0.0.0
ENV DEVICE=cpu
ENV MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct

EXPOSE 7860

# Health check pinging /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-7860}/health || exit 1

# Start Uvicorn server
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1
