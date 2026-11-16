import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./shared/errors/error-handler.js";
import { csrfProtection } from "./shared/middleware/csrf.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): express.Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URLS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Global light rate limit; stricter limits are applied on auth routes.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => env.IS_TEST,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

  app.use("/api", csrfProtection, apiRouter);

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } });
  });

  app.use(errorHandler);
  return app;
}
