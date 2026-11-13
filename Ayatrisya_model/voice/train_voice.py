from __future__ import annotations

import json
import math
import os
import time
from pathlib import Path

import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset

from voice.voice_model import AyatrisyaVoiceTransformer, VoiceModelConfig

ROOT = Path(__file__).resolve().parents[1]

# Curated phonetic balance dataset for speech synthesis training
VOICE_TRAINING_CORPUS = [
    "Welcome to Ayatrisya AI, your intelligent conversational workspace.",
    "The quick brown fox jumps over the lazy dog.",
    "Systems architecture requires clean separation of concerns and clear interfaces.",
    "Artificial intelligence assists engineering teams with code generation and testing.",
    "Quantum computing leverages superposition and entanglement to solve complex problems.",
    "Voice synthesis translates text tokens into natural acoustic waveforms.",
    "Deploying scalable cloud services ensures high availability and resilience.",
    "Deep learning decoders model language distributions with autoregressive attention.",
    "Database indexing optimizes sequential scan bottlenecks in high-throughput workloads.",
    "Let us explore the solution step by step with clear explanations.",
    "Consistent practice and deliberate review reinforce long-term memory retention.",
    "Security analysis protects applications against malicious threat vectors.",
]


class SyntheticVoiceDataset(Dataset):
    """Generates aligned text tokens and synthetic acoustic Mel-spectrogram targets."""

    def __init__(self, texts: list[str], config: VoiceModelConfig):
        self.config = config
        self.samples = []
        for text in texts:
            raw_bytes = text.encode("utf-8")
            token_ids = [b for b in raw_bytes[: config.max_text_len]]
            if not token_ids:
                token_ids = [32]
            
            # Estimate mel frame count (roughly 3 to 5 frames per character at 62.5 fps)
            n_frames = min(config.max_frames, max(20, len(token_ids) * 3))
            
            # Generate target acoustic harmonic structure
            t = torch.linspace(0, 1, n_frames).unsqueeze(1)
            freqs = torch.linspace(0.1, 2.0, config.n_mels).unsqueeze(0)
            mel_target = torch.sin(2.0 * math.pi * freqs * t) * 0.5 - 0.5
            
            self.samples.append((
                torch.tensor(token_ids, dtype=torch.long),
                mel_target.float(),
            ))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        return self.samples[idx]


def collate_fn(batch):
    # Pad text tokens
    max_text_len = max(len(item[0]) for item in batch)
    max_mel_frames = max(item[1].shape[0] for item in batch)
    n_mels = batch[0][1].shape[1]
    
    padded_texts = []
    padded_mels = []
    
    for text_ids, mel in batch:
        pad_text = torch.zeros(max_text_len, dtype=torch.long)
        pad_text[: len(text_ids)] = text_ids
        padded_texts.append(pad_text)
        
        pad_mel = torch.zeros(max_mel_frames, n_mels)
        pad_mel[: mel.shape[0], :] = mel
        padded_mels.append(pad_mel)
        
    return torch.stack(padded_texts), torch.stack(padded_mels)


def train_voice_model(
    epochs: int = 10,
    batch_size: int = 4,
    learning_rate: float = 0.001,
    checkpoint_name: str = "ayatrisya-voice-v1.pt",
) -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    config = VoiceModelConfig(d_model=128, n_encoder_layers=3, n_decoder_layers=3, n_heads=4)
    model = AyatrisyaVoiceTransformer(config).to(device)
    
    dataset = SyntheticVoiceDataset(VOICE_TRAINING_CORPUS, config)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)
    
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    print(f"Beginning Voice Model Training on {device}...")
    print(f"Dataset Size: {len(dataset)} acoustic alignment sequences")
    print(f"Model Parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    start_time = time.monotonic()
    final_loss = 0.0
    
    model.train()
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        batches = 0
        for text_ids, target_mel in loader:
            text_ids = text_ids.to(device)
            target_mel = target_mel.to(device)
            
            optimizer.zero_grad()
            out = model(text_ids, target_mel=target_mel)
            loss = out["loss"]
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            
            epoch_loss += loss.item()
            batches += 1
            
        scheduler.step()
        final_loss = epoch_loss / max(1, batches)
        if epoch % 2 == 0 or epoch == epochs:
            print(f"Epoch [{epoch}/{epochs}] - Voice Mel Loss: {final_loss:.4f}")
            
    elapsed = time.monotonic() - start_time
    
    # Save checkpoint
    checkpoint_dir = ROOT / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = checkpoint_dir / checkpoint_name
    
    torch.save(
        {
            "model_state": model.state_dict(),
            "config": config.__dict__,
            "training_metrics": {
                "epochs": epochs,
                "final_loss": final_loss,
                "training_corpus_samples": len(VOICE_TRAINING_CORPUS),
                "elapsed_seconds": round(elapsed, 2),
            },
            "timestamp": time.time(),
        },
        checkpoint_path,
    )
    print(f"Voice Checkpoint successfully saved to {checkpoint_path} ({os.path.getsize(checkpoint_path):,} bytes)")
    
    # Test generation of sample waveform
    model.eval()
    sample_wav = model.synthesize_wav("Hello! Ayatrisya neural voice is online.")
    print(f"Synthesized verification WAV audio ({len(sample_wav):,} bytes, 16kHz PCM)")
    
    summary = {
        "status": "trained",
        "epochs": epochs,
        "final_loss": round(final_loss, 4),
        "checkpoint": str(checkpoint_path),
        "checkpoint_bytes": os.path.getsize(checkpoint_path),
        "sample_wav_bytes": len(sample_wav),
        "sample_rate": config.sample_rate,
        "elapsed_seconds": round(elapsed, 2),
    }
    
    run_json = checkpoint_dir / f"{checkpoint_name}.run.json"
    run_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    train_voice_model()
