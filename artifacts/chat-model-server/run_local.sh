#!/usr/bin/env bash
# Launch Ayatrisya Chat Model Server locally
export PORT=8000
export HOST=127.0.0.1
export AYATRISYA_MODEL_API_KEY=test-model-api-key
export MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct
export DEVICE=cpu

echo "Starting Ayatrisya Chat Model Server on http://127.0.0.1:8000 ..."
python app.py
