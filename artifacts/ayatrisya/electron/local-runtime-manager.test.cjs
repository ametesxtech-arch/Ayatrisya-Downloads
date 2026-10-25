const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const {
  createLocalRuntimeManager,
  assertLoopbackAddress,
  DEFAULT_PORT,
} = require("./local-runtime-manager.cjs");

function createMockChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return true;
  };
  return child;
}

test("assertLoopbackAddress enforces loopback-only targets", () => {
  assert.doesNotThrow(() => assertLoopbackAddress("http://127.0.0.1:49384/completion"));
  assert.doesNotThrow(() => assertLoopbackAddress("http://localhost:49384/health"));
  assert.doesNotThrow(() => assertLoopbackAddress("http://[::1]:49384/completion"));

  assert.throws(
    () => assertLoopbackAddress("https://api.openai.com/v1/completions"),
    /Local runtime must bind only to loopback/
  );
  assert.throws(
    () => assertLoopbackAddress("http://192.168.1.50:8080/generate"),
    /Local runtime must bind only to loopback/
  );
});

test("detectBackend truthfully reports GPU acceleration availability", async () => {
  const manager = createLocalRuntimeManager();
  const backendInfo = await manager.detectBackend();

  assert.ok(["CUDA", "DIRECTML", "METAL", "CPU"].includes(backendInfo.backend));
  if (backendInfo.backend === "CUDA") {
    assert.equal(backendInfo.cudaAvailable, true);
    assert.ok(backendInfo.recommendedGpuLayers > 0);
  } else {
    assert.equal(backendInfo.cudaAvailable, false);
    assert.ok(backendInfo.description.length > 0);
  }
});

test("reports limitation honestly when binary is not installed", async () => {
  const manager = createLocalRuntimeManager({
    userDataDir: "/nonexistent/test/path",
  });

  const status = await manager.start("C:\\models\\test.gguf");
  assert.equal(status.state, "ERROR");
  assert.match(status.message, /Bundled llama\.cpp runtime binary not found/);
});

test("manages runtime startup, health check, generation, and graceful shutdown", async () => {
  const mockChild = createMockChild();
  const mockFetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }
    if (parsed.pathname === "/completion") {
      const body = JSON.parse(options.body || "{}");
      return new Response(JSON.stringify({
        content: `Local reply to: ${body.prompt}`,
        tokens_predicted: 12,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("Not found", { status: 404 });
  };

  const manager = createLocalRuntimeManager({
    mockProcess: mockChild,
    fetchFn: mockFetch,
  });

  // Start runtime
  const startStatus = await manager.start("C:\\models\\qwen-coder.gguf", { mockProcess: mockChild });
  assert.equal(startStatus.state, "READY");
  assert.equal(startStatus.activeModel, "qwen-coder.gguf");

  // Perform generation
  const genResult = await manager.generate("Write a hello world function", "req-123");
  assert.equal(genResult.requestId, "req-123");
  assert.equal(genResult.text, "Local reply to: Write a hello world function");
  assert.equal(genResult.tokensGenerated, 12);

  // Stop runtime
  const stopStatus = await manager.stop();
  assert.equal(stopStatus.state, "STOPPED");
  assert.equal(stopStatus.activeModel, null);
  assert.equal(mockChild.killed, true);
});

test("enforces cancellation and timeout on local requests", async () => {
  const mockChild = createMockChild();
  const mockFetch = async (url, options = {}) => {
    const signal = options.signal;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(new Response(JSON.stringify({ content: "late reply" }), { status: 200 }));
      }, 5000);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Request aborted"));
      });
    });
  };

  const manager = createLocalRuntimeManager({
    mockProcess: mockChild,
    fetchFn: mockFetch,
  });

  await manager.start("C:\\models\\test.gguf", { mockProcess: mockChild });

  const genPromise = manager.generate("Slow prompt", "req-slow", { timeoutMs: 50 });
  await assert.rejects(
    genPromise,
    /Local inference request was cancelled or timed out/
  );

  await manager.stop();
});

test("refuses generation when runtime is stopped", async () => {
  const manager = createLocalRuntimeManager();
  await assert.rejects(
    manager.generate("Hello", "req-fail"),
    /Local runtime is not ready/
  );
});
