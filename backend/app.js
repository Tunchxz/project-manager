import cors from "cors";
import mongoose from "mongoose";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import errorHandler from "./middleware/error-handler.js";
import routes from "./routes/index.js";

/**
 * Builds the Express application.
 *
 * Kept separate from index.js so tests can mount the app with supertest
 * without opening a port or connecting to a real database.
 */
const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use(express.json({ limit: "10kb" }));

  app.get("/", (req, res) => {
    res.status(200).json({ message: "Welcome to TaskHub API" });
  });

  app.get("/health", (req, res) => {
    // 1 === connected. Render polls this to decide whether the instance is live.
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? "ok" : "degraded",
      database: dbConnected ? "connected" : "disconnected",
      uptime: process.uptime(),
    });
  });

  // Rate limiting is disabled under test so the suite is not throttled.
  if (process.env.NODE_ENV !== "test") {
    app.use(
      "/api-v1/auth",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { message: "Too many attempts, please try again later" },
      })
    );
    app.use(
      "/api-v1",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: "draft-7",
        legacyHeaders: false,
      })
    );
  }

  app.use("/api-v1", routes);

  // not found
  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // Must be registered last.
  app.use(errorHandler);

  return app;
};

export default createApp;
