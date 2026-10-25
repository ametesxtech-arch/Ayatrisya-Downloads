@echo off
REM Launch Ayatrisya Chat Model Server locally
set PORT=8000
set HOST=127.0.0.1
set AYATRISYA_MODEL_API_KEY=test-model-api-key
set MODEL_ID=Qwen/Qwen2.5-0.5B-Instruct
set DEVICE=cpu

echo Starting Ayatrisya Chat Model Server on http://127.0.0.1:8000 ...
python app.py
