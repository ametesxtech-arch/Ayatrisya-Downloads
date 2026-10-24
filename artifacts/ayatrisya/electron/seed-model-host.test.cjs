const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createSeedModelHost, validateCheckpoint, PORT } = require("./seed-model-host.cjs");

async function makeModelProject(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ayatrisya-seed-host-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of [
    "inference/server.py",
    "inference/loader.py",
    "model/generation.py",
    "model/tokenizer.py",
    "model/transformer.py",
    "training/checkpoint.py",
  ]) {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "# trusted fixture\n");
  }
  const checkpoint = path.join(root, "checkpoints", "seed-test.pt");
  await fs.mkdir(path.dirname(checkpoint), { recursive: true });
  await fs.writeFile(checkpoint, "test checkpoint");
  return { root, checkpoint, userDataDir: path.join(root, "user-data") };
}

function createChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return true;
  };
  setImmediate(() => child.stdout.write("Ayatrisya Seed API binds only to 127.0.0.1:49382.\n"));
  return child;
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readyHealth() {
  return response({
    status: "ready",
    model: "Ayatrisya Seed",
    readiness: "experimental_checkpoint_loaded",
    parameter_count: 20_000,
    training_steps: 1720,
    device: "cpu",
  });
}

test("accepts only a checkpoint inside a complete local Ayatrisya Seed project", async (t) => {
  const fixture = await makeModelProject(t);
  const result = await validateCheckpoint(fixture.checkpoint);
  assert.deepEqual(result, {
    checkpointPath: fixture.checkpoint,
    modelRoot: fixture.root,
    checkpointName: "seed-test.pt",
  });
  const outside = path.join(fixture.root, "outside.pt");
  await fs.writeFile(outside, "not a checkpoint");
  await assert.rejects(validateCheckpoint(outside), /checkpoints folder/);
});

test("starts and stops a loopback-only runner without passing secret environment variables", async (t) => {
  const fixture = await makeModelProject(t);
  let spawned;
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    processEnv: { PATH: "/usr/bin", PYTHONPATH: "/local/python", GH_TOKEN: "never forward" },
    spawnProcess(command, args, options) {
      spawned = { command, args, options };
      return createChild();
    },
    fetchImpl: async (url) => {
      assert.equal(String(url), `http://127.0.0.1:${PORT}/health`);
      return readyHealth();
    },
  });
  await host.configureCheckpoint(fixture.checkpoint);
  const status = await host.start();
  assert.equal(status.state, "READY");
  assert.equal(status.model.name, "Ayatrisya Seed");
  assert.equal(status.checkpointName, "seed-test.pt");
  assert.equal(spawned.command, "python3");
  assert.deepEqual(spawned.args.slice(0, 5), [
    "-u", "-m", "inference.server", "--checkpoint", fixture.checkpoint,
  ]);
  assert.equal(spawned.args.at(-1), "cpu");
  assert.equal(spawned.options.shell, false);
  assert.equal(spawned.options.env.GH_TOKEN, undefined);
  assert.equal(spawned.options.env.PATH, "/usr/bin");
  assert.equal(spawned.options.env.PYTHONPATH, "/local/python");
  assert.equal(spawned.options.env.PYTHONNOUSERSITE, "1");
  assert.equal(spawned.options.env.OMP_NUM_THREADS, "2");
  const stopped = await host.stop();
  assert.equal(stopped.state, "STOPPED");
  assert.equal(host.getStatus().configured, true);
});

test("automatic startup is opt-in and persists across desktop launches", async (t) => {
  const fixture = await makeModelProject(t);
  let spawnCount = 0;
  const dependencies = {
    userDataDir: fixture.userDataDir,
    platform: "linux",
    spawnProcess() {
      spawnCount += 1;
      return createChild();
    },
    fetchImpl: async (url) => String(url).endsWith("/health") ? readyHealth() : response({}),
  };
  const initial = createSeedModelHost(dependencies);
  await initial.configureCheckpoint(fixture.checkpoint);
  assert.equal(initial.getStatus().autoStart, false);

  const secondLaunch = createSeedModelHost(dependencies);
  await secondLaunch.load();
  await secondLaunch.startSaved();
  assert.equal(spawnCount, 0);
  await secondLaunch.setAutoStart(true);

  const thirdLaunch = createSeedModelHost(dependencies);
  await thirdLaunch.load();
  const status = await thirdLaunch.startSaved();
  assert.equal(status.state, "READY");
  assert.equal(status.autoStart, true);
  assert.equal(spawnCount, 1);
  await thirdLaunch.stop();
});

test("validates prompts and returns only experimental output from the local model server", async (t) => {
  const fixture = await makeModelProject(t);
  const requests = [];
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    spawnProcess: () => createChild(),
    fetchImpl: async (url, init = {}) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/health")) return readyHealth();
      if (String(url).endsWith("/v1/generate")) {
        return response({
          request_id: JSON.parse(init.body).request_id,
          generated_text: " experimental local bytes",
          model_status: "experimental",
          prompt_truncated_to_context: false,
        });
      }
      throw new Error("Unexpected route");
    },
  });
  await host.configureCheckpoint(fixture.checkpoint);
  await host.start();
  const result = await host.generateText("A local test prompt", "a".repeat(32));
  assert.equal(result.generatedText, " experimental local bytes");
  assert.equal(result.modelStatus, "experimental");
  const request = requests.find(({ url }) => url.endsWith("/v1/generate"));
  assert.equal(request.url, `http://127.0.0.1:${PORT}/v1/generate`);
  assert.deepEqual(JSON.parse(request.init.body), {
    request_id: "a".repeat(32),
    prompt: "A local test prompt",
    max_new_tokens: 32,
    temperature: 0.8,
    top_k: 40,
  });
  await assert.rejects(host.generateText(" ", "b".repeat(32)), /between 1 and/);
  await assert.rejects(host.generateText("valid", "not-an-id"), /request ID is invalid/);
  assert.equal(requests.filter(({ url }) => url.endsWith("/v1/generate")).length, 1);
  await host.stop();
});

test("reports a missing checkpoint as not ready instead of fabricating output", async (t) => {
  const fixture = await makeModelProject(t);
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    spawnProcess: () => createChild(),
    fetchImpl: async (url) => String(url).endsWith("/health")
      ? response({ status: "not_ready", error: "checkpoint_invalid" }, 503)
      : response({ error: "checkpoint_invalid" }, 503),
  });
  await host.configureCheckpoint(fixture.checkpoint);
  await assert.rejects(host.start(), /checkpoint_invalid/);
  assert.equal(host.getStatus().state, "ERROR");
  assert.match(host.getStatus().message, /could not load/);
});

test("reports an unavailable Python runner instead of claiming readiness", async (t) => {
  const fixture = await makeModelProject(t);
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    spawnProcess() {
      const child = createChild();
      queueMicrotask(() => child.emit("error", new Error("python3 not found")));
      return child;
    },
    fetchImpl: async () => readyHealth(),
  });
  await host.configureCheckpoint(fixture.checkpoint);
  await assert.rejects(host.start(), /Python 3\.10\+ with PyTorch 2\.6\+ is required/);
  assert.equal(host.getStatus().state, "ERROR");
});

test("sends cancellation to the local runner and reports a cancelled request", async (t) => {
  const fixture = await makeModelProject(t);
  const requestId = "d".repeat(32);
  let resolveGenerate;
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    spawnProcess: () => createChild(),
    fetchImpl: async (url) => {
      if (String(url).endsWith("/health")) return readyHealth();
      if (String(url).endsWith("/v1/generate")) {
        return new Promise((resolve) => { resolveGenerate = resolve; });
      }
      if (String(url).endsWith("/v1/cancel")) {
        queueMicrotask(() => resolveGenerate(response({ error: "cancelled" }, 409)));
        return response({ cancelled: true });
      }
      throw new Error("Unexpected route");
    },
  });
  await host.configureCheckpoint(fixture.checkpoint);
  await host.start();
  const generation = host.generateText("local cancellation test", requestId);
  const cancelled = await host.cancel(requestId);
  assert.equal(cancelled, true);
  await assert.rejects(generation, /was cancelled/);
  assert.equal(host.getStatus().activeRequests, 0);
  await host.stop();
});

test("clears the local test request on timeout and never contacts a remote endpoint", async (t) => {
  const fixture = await makeModelProject(t);
  const urls = [];
  const host = createSeedModelHost({
    userDataDir: fixture.userDataDir,
    platform: "linux",
    requestTimeoutMs: 20,
    spawnProcess: () => createChild(),
    fetchImpl: async (url, init = {}) => {
      urls.push(String(url));
      if (String(url).endsWith("/health")) return readyHealth();
      return new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    },
  });
  await host.configureCheckpoint(fixture.checkpoint);
  await host.start();
  await assert.rejects(host.generateText("local timeout test", "c".repeat(32)), /timed out or was cancelled/);
  assert(urls.every((url) => url.startsWith(`http://127.0.0.1:${PORT}/`)));
  assert.equal(host.getStatus().activeRequests, 0);
  await host.stop();
});
