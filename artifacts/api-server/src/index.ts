try {
  process.loadEnvFile();
} catch {}
try {
  process.loadEnvFile("../../.env");
} catch {}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  process.env.SESSION_SECRET = "ayatrisya_super_secret_session_key_32bytes_min_length_secure";
}

import app from "./app";
import { logger } from "./lib/logger";
import { defaultTaskScheduler } from "./lib/task-scheduler";

const rawPort = process.env["PORT"] || "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  defaultTaskScheduler.start();
  logger.info({ port, host: "0.0.0.0" }, `Ayatrisya API Server listening on 0.0.0.0:${port} with Scheduled Task control plane active`);
});
