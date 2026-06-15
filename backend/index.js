import mongoose from "mongoose";

import createApp from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const start = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Database connected.");
  } catch (error) {
    // Failing here lets the platform restart the instance.
    console.error("Failed to connect to the database:", error.message);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // When the platform wants to shut down the instance, it sends a SIGTERM signal.
  // We need to drain in-flight requests first.
  const shutdown = (signal) => async () => {
    console.log(`${signal} received, shutting down.`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
};

start();
