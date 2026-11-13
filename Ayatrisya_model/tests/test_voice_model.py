from __future__ import annotations

import io
import unittest
import wave
from pathlib import Path

import torch

from voice.voice_model import AyatrisyaVoiceTransformer, VoiceModelConfig


class VoiceModelTests(unittest.TestCase):
    def setUp(self):
        self.config = VoiceModelConfig(d_model=64, n_encoder_layers=2, n_decoder_layers=2, n_heads=2)
        self.model = AyatrisyaVoiceTransformer(self.config)

    def test_voice_mel_synthesis(self):
        text = "Ayatrisya voice synthesis test."
        mel = self.model.synthesize_mel(text)
        self.assertEqual(mel.shape[-1], self.config.n_mels)
        self.assertGreater(mel.shape[0], 0)

    def test_wav_audio_container_validity(self):
        text = "Hello world!"
        wav_bytes = self.model.synthesize_wav(text)
        self.assertGreater(len(wav_bytes), 44)  # WAV header is 44 bytes
        
        # Verify valid WAV format using Python standard wave module
        buffer = io.BytesIO(wav_bytes)
        with wave.open(buffer, "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2)  # 16-bit
            self.assertEqual(wf.getframerate(), self.config.sample_rate)
            n_frames = wf.getnframes()
            self.assertGreater(n_frames, 0)

    def test_checkpoint_exists_and_loads(self):
        ckpt_path = Path(__file__).resolve().parents[1] / "checkpoints" / "ayatrisya-voice-v1.pt"
        self.assertTrue(ckpt_path.exists())
        payload = torch.load(ckpt_path, map_location="cpu")
        self.assertIn("model_state", payload)
        self.assertIn("config", payload)


if __name__ == "__main__":
    unittest.main()
