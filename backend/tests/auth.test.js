import request from "supertest";
import { describe, expect, it } from "vitest";

import createApp from "../app.js";
import { authHeader, createUser } from "./helpers/factories.js";

const app = createApp();

describe("authentication", () => {
  it("rejects a request with no Authorization header as 401", async () => {
    const res = await request(app).get("/api-v1/workspaces");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed Authorization header as 401", async () => {
    const res = await request(app)
      .get("/api-v1/workspaces")
      .set({ Authorization: "NotEvenBearer" });
    expect(res.status).toBe(401);
  });

  it("rejects a garbage bearer token as 401", async () => {
    const res = await request(app)
      .get("/api-v1/workspaces")
      .set({ Authorization: "Bearer not.a.real.token" });
    expect(res.status).toBe(401);
  });

  it("accepts a valid token", async () => {
    const { user } = await createUser();
    const res = await request(app)
      .get("/api-v1/workspaces")
      .set(authHeader(user));
    expect(res.status).toBe(200);
  });

  it("logs in a verified user and returns a token", async () => {
    const { user, password } = await createUser({ isEmailVerified: true });
    const res = await request(app)
      .post("/api-v1/auth/login")
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("does not reveal whether an email is registered on password reset", async () => {
    const { user } = await createUser();

    const known = await request(app)
      .post("/api-v1/auth/reset-password-request")
      .send({ email: user.email });
    const unknown = await request(app)
      .post("/api-v1/auth/reset-password-request")
      .send({ email: "definitely-not-registered@example.com" });

    expect(unknown.status).toBe(known.status);
  });
});
