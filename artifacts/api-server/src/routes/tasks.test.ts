import { once } from "node:events";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskStore } from "../lib/task-store";
import { TaskScheduler } from "../lib/task-scheduler";
import tasksRouter from "./tasks";

vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string) => {
    if (token === "valid-user-1") {
      return { payload: { sub: "user-123" } };
    }
    if (token === "valid-user-2") {
      return { payload: { sub: "user-456" } };
    }
    throw new Error("Invalid token");
  },
}));

describe("Scheduled Tasks Control Plane API", () => {
  let server: Server | undefined;
  let origin = "";

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIREBASE_PROJECT_ID", "ayatrisya-test");
    vi.stubEnv("SESSION_SECRET", "super-secure-secret-key-for-jwt-testing-32-bytes");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (server?.listening) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
    server = undefined;
  });

  async function startApi() {
    const app = express();
    app.use(express.json());
    app.use("/api", tasksRouter);
    server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address.");
    origin = `http://127.0.0.1:${address.port}`;

    return async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer valid-user-1");
      }
      return fetch(`${origin}${path}`, {
        ...init,
        headers,
      });
    };
  }

  it("requires authentication for task operations", async () => {
    const request = await startApi();
    const res = await request("/api/tasks", {
      headers: { Authorization: "Bearer bad-token" },
    });
    expect(res.status).toBe(401);
  });

  it("creates, retrieves, and updates a scheduled task", async () => {
    const request = await startApi();

    // 1. Create
    const createRes = await request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Study Maths tomorrow at 6 PM",
        recurrence: "daily",
        time: "18:00",
        timezone: "Asia/Kolkata",
        actionType: "study_reminder",
        executionTarget: "cloud",
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { task: { id: string; title: string; nextRunAt: string } };
    expect(createBody.task.title).toBe("Study Maths tomorrow at 6 PM");
    expect(createBody.task.nextRunAt).toBeDefined();

    const taskId = createBody.task.id;

    // 2. Retrieve
    const getRes = await request(`/api/tasks/${taskId}`);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { task: { id: string; status: string } };
    expect(getBody.task.id).toBe(taskId);
    expect(getBody.task.status).toBe("active");

    // 3. Pause
    const patchRes = await request(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { task: { status: string } };
    expect(patchBody.task.status).toBe("paused");
  });

  it("enforces user isolation (users cannot access or delete other users' tasks)", async () => {
    const request = await startApi();

    // Create as user 1
    const createRes = await request("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-user-1",
      },
      body: JSON.stringify({
        title: "User 1 Private Task",
        recurrence: "one-time",
        timezone: "UTC",
        actionType: "notification",
        executionTarget: "cloud",
      }),
    });
    const { task } = (await createRes.json()) as { task: { id: string } };

    // Try accessing as user 2
    const getRes = await request(`/api/tasks/${task.id}`, {
      headers: { Authorization: "Bearer valid-user-2" },
    });
    expect(getRes.status).toBe(404);

    // Try deleting as user 2
    const deleteRes = await request(`/api/tasks/${task.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-user-2" },
    });
    expect(deleteRes.status).toBe(404);
  });

  it("executes manual 'Run now' and appends execution audit log", async () => {
    const request = await startApi();

    const createRes = await request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Daily Tasks Summary",
        recurrence: "weekdays",
        time: "07:00",
        timezone: "UTC",
        actionType: "task_summary",
        executionTarget: "cloud",
      }),
    });
    const { task } = (await createRes.json()) as { task: { id: string } };

    // Run now
    const runRes = await request(`/api/tasks/${task.id}/run`, {
      method: "POST",
    });
    expect(runRes.status).toBe(200);
    const runBody = (await runRes.json()) as { execution: { status: string; taskId: string } };
    expect(runBody.execution.status).toBe("success");
    expect(runBody.execution.taskId).toBe(task.id);

    // Check history
    const historyRes = await request(`/api/tasks/${task.id}/history`);
    expect(historyRes.status).toBe(200);
    const histBody = (await historyRes.json()) as { history: Array<{ id: string; status: string }> };
    expect(histBody.history.length).toBeGreaterThanOrEqual(1);
    expect(histBody.history[0].status).toBe("success");
  });

  it("records missed execution when desktop runner is offline", async () => {
    const store = new TaskStore();
    const scheduler = new TaskScheduler(store);

    const task = store.saveTask({
      id: "desktop-offline-task",
      ownerId: "user-offline",
      title: "Local Code Build Check",
      status: "active",
      recurrence: "one-time",
      time: "10:00",
      timezone: "UTC",
      actionType: "code_review",
      executionTarget: "desktop",
      retriesRemaining: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Make sure desktop is offline (no recent heartbeat)
    const result = await scheduler.executeTask(task);
    expect(result.status).toBe("missed");
    expect(result.error).toContain("offline");

    // Verify task status was updated to missed
    const updated = store.getTaskById("desktop-offline-task");
    expect(updated?.lastExecution?.status).toBe("missed");
  });

  it("provides health and external webhook tick endpoints for Render free tier", async () => {
    const request = await startApi();

    const healthRes = await request("/api/tasks/health", {
      headers: {}, // no auth needed
    });
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { status: string; renderNote: string };
    expect(health.status).toBe("healthy");
    expect(health.renderNote).toContain("Render free instances");

    const tickRes = await request("/api/tasks/tick", {
      method: "POST",
      headers: {},
    });
    expect(tickRes.status).toBe(200);
    const tickBody = (await tickRes.json()) as { ok: boolean; executedCount: number };
    expect(tickBody.ok).toBe(true);
  });
});
