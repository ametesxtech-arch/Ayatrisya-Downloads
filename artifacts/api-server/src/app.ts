try {
  process.loadEnvFile();
} catch {}
try {
  process.loadEnvFile("../../.env");
} catch {}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  process.env.SESSION_SECRET = "ayatrisya_super_secret_session_key_32bytes_min_length_secure";
}

// Proprietary notice: applies only to original material Ametesx owns or is authorized to license; third-party and prior licenses remain in force.
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { isAllowedApiOrigin } from "./lib/cors-policy";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedApiOrigin(origin));
  },
  credentials: true,
  maxAge: 600,
}));
app.use((_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  next();
});
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.get(["/health", "/healthz"], (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).set({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  }).json({ error: "The requested API endpoint was not found." });
});

app.use("/api", (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!res.headersSent) {
    res.status(500).set({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    }).json({ error: "An unexpected API error occurred." });
  }
});

export default app;
