import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Must be set before config/env.js is imported anywhere in the graph.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||=
  "test-jwt-secret-value-that-is-long-enough-for-validation";
process.env.FRONTEND_URL ||= "http://localhost:5173";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/taskhub-test";
process.env.ENABLE_DEMO ||= "true";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
