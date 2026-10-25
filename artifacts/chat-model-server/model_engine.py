# Ayatrisya Chat Model Server - Inference Engine
# Parent Company: Ametesx

import logging
import threading
import time
from typing import Generator, List, Optional
from schemas import ChatMessage, ModelChatAttachment

logger = logging.getLogger("ayatrisya.engine")

class ChatEngine:
    def __init__(
        self,
        model_id: str = "Qwen/Qwen2.5-0.5B-Instruct",
        device: str = "cpu",
        mock_inference: bool = False,
        max_input_tokens: int = 4096,
        max_new_tokens: int = 512,
        request_timeout: float = 60.0,
    ):
        self.model_id = model_id
        self.device = device
        self.mock_inference = mock_inference
        self.max_input_tokens = max_input_tokens
        self.max_new_tokens = max_new_tokens
        self.request_timeout = request_timeout

        self.tokenizer = None
        self.model = None
        self.is_loaded = False
        self.self_test_passed = False
        self.self_test_error: Optional[str] = None
        self.param_count = "490M"
        self.inference_lock = threading.Lock()

    def load(self) -> None:
        """Loads the model and performs mandatory warm-up self-test."""
        logger.info(f"Initializing ChatEngine: model={self.model_id}, device={self.device}, mock={self.mock_inference}")
        
        if self.mock_inference:
            self.tokenizer = None
            self.model = None
            self.is_loaded = True
            # Execute mandatory self-test in mock mode
            self._run_self_test()
            return

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            logger.info("Loading tokenizer from %s...", self.model_id)
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_id,
                trust_remote_code=True,
            )

            logger.info("Loading model weights onto %s (low_cpu_mem_usage=True)...", self.device)
            # Use torch.float32 for universal, stable CPU inference
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_id,
                torch_dtype=torch.float32,
                device_map=self.device,
                low_cpu_mem_usage=True,
                trust_remote_code=True,
            )
            self.model.eval()

            # Calculate parameter count
            total_params = sum(p.numel() for p in self.model.parameters())
            self.param_count = f"{total_params / 1_000_000:.1f}M"
            logger.info("Model loaded successfully (%s parameters).", self.param_count)
            self.is_loaded = True

            # Mandatory warm-up self-test
            self._run_self_test()

        except Exception as exc:
            self.is_loaded = False
            self.self_test_passed = False
            self.self_test_error = f"Model load failed: {str(exc)}"
            logger.error(self.self_test_error, exc_info=True)

    def _run_self_test(self) -> None:
        """
        Never report the model as ready until an actual inference request succeeds.
        Runs a test generation against the loaded model.
        """
        try:
            logger.info("Running mandatory warm-up self-test inference...")
            test_output = self._generate_internal("Hello! Ayatrisya warmup test.", max_tokens=8)
            if not test_output or not test_output.strip():
                raise RuntimeError("Warmup inference produced empty text output.")
            
            self.self_test_passed = True
            self.self_test_error = None
            logger.info("Warm-up self-test PASSED. Model is ready for live inference.")
        except Exception as exc:
            self.self_test_passed = False
            self.self_test_error = f"Self-test inference failed: {str(exc)}"
            logger.error(self.self_test_error, exc_info=True)

    def format_prompt(self, messages: List[ChatMessage], mode: str) -> str:
        """Constructs prompt with Ayatrisya persona, conversation history, and attachments."""
        # Persona tone selection
        if mode == "Savage":
            tone_prompt = (
                "You are Ayatrisya AI in Savage Mode. Be witty, snappy, sharp, and playfully sarcastic "
                "while ensuring technical, mathematical, and logical accuracy. Do not be offensive or harmful."
            )
        elif mode == "Joke":
            tone_prompt = (
                "You are Ayatrisya AI in Joke Mode. Be funny, lighthearted, pun-friendly, and entertaining "
                "while still giving clear answers."
            )
        else:
            tone_prompt = (
                "You are Ayatrisya AI, a premier intelligent reasoning, coding, and creative assistant created by Ametesx.\n"
                "Core Principles:\n"
                "1. Direct Answer First: Begin directly with the answer to the user's specific question.\n"
                "2. Conversational Tone: Natural, clear, engaging, and precise.\n"
                "3. Mathematical Notation: Always use standard LaTeX delimiters ($...$ for inline, $$...$$ for display equations).\n"
                "4. Code Quality: Tag code blocks with exact language identifiers (```python, ```typescript, ```rust, etc.)."
            )

        # Check if tokenizer has apply_chat_template (e.g. Qwen2.5)
        conversation_history: List[dict] = [{"role": "system", "content": tone_prompt}]

        for msg in messages:
            content = msg.content
            # Append text attachments if provided
            if msg.attachments:
                for att in msg.attachments:
                    if att.textContent:
                        content += f"\n\n[Attached File: {att.name} ({att.mimeType})]:\n{att.textContent}"
            
            conversation_history.append({"role": msg.role, "content": content})

        if self.tokenizer and hasattr(self.tokenizer, "apply_chat_template"):
            try:
                formatted = self.tokenizer.apply_chat_template(
                    conversation_history,
                    tokenize=False,
                    add_generation_prompt=True,
                )
                return formatted
            except Exception:
                pass

        # Fallback chat format (standard ChatML format supported by Qwen)
        lines: List[str] = [f"<|im_start|>system\n{tone_prompt}<|im_end|>"]
        for item in conversation_history[1:]:
            lines.append(f"<|im_start|>{item['role']}\n{item['content']}<|im_end|>")
        lines.append("<|im_start|>assistant\n")
        return "\n".join(lines)

    def _generate_internal(self, prompt: str, max_tokens: int) -> str:
        """Internal synchronous generator."""
        if self.mock_inference or not self.model or not self.tokenizer:
            return (
                "Hello! This is Ayatrisya AI (Local Inference Engine). "
                "The chat model server is online, operational, and connected to your API gateway."
            )

        import torch

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_input_tokens,
        ).to(self.device)

        input_length = inputs.input_ids.shape[1]

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        generated_tokens = outputs[0][input_length:]
        return self.tokenizer.decode(generated_tokens, skip_special_tokens=True)

    def generate(self, messages: List[ChatMessage], mode: str) -> str:
        """Public synchronous generation with timeout and concurrency guard."""
        if not self.self_test_passed:
            raise RuntimeError(self.self_test_error or "Model is not ready. Warmup self-test is pending.")

        prompt = self.format_prompt(messages, mode)

        acquired = self.inference_lock.acquire(timeout=self.request_timeout)
        if not acquired:
            raise TimeoutError("Inference engine is currently busy processing another request.")

        try:
            return self._generate_internal(prompt, max_tokens=self.max_new_tokens)
        finally:
            self.inference_lock.release()

    def generate_stream(self, messages: List[ChatMessage], mode: str) -> Generator[str, None, None]:
        """Public streaming generation yielding tokens."""
        if not self.self_test_passed:
            raise RuntimeError(self.self_test_error or "Model is not ready. Warmup self-test is pending.")

        prompt = self.format_prompt(messages, mode)

        acquired = self.inference_lock.acquire(timeout=self.request_timeout)
        if not acquired:
            raise TimeoutError("Inference engine is currently busy processing another request.")

        try:
            if self.mock_inference or not self.model or not self.tokenizer:
                chunks = [
                    "Hello! ", "I am Ayatrisya AI, ", "streaming directly ",
                    "from your dedicated CPU-optimized ", "chat model server."
                ]
                for chunk in chunks:
                    time.sleep(0.04)
                    yield chunk
                return

            import torch
            from transformers import TextIteratorStreamer

            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_input_tokens,
            ).to(self.device)

            streamer = TextIteratorStreamer(
                self.tokenizer,
                skip_prompt=True,
                skip_special_tokens=True,
            )

            generation_kwargs = dict(
                **inputs,
                streamer=streamer,
                max_new_tokens=self.max_new_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.eos_token_id,
            )

            thread = threading.Thread(target=self.model.generate, kwargs=generation_kwargs)
            thread.daemon = True
            thread.start()

            for token_text in streamer:
                yield token_text

            thread.join(timeout=10.0)

        finally:
            self.inference_lock.release()
