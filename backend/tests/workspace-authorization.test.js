import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import createApp from "../app.js";
import Workspace from "../models/workspace.js";
import { authHeader, seedScenario } from "./helpers/factories.js";

const app = createApp();

describe("workspace authorization", () => {
  let scenario;

  beforeEach(async () => {
    scenario = await seedScenario();
  });

  it("lets a member read workspace details", async () => {
    const res = await request(app)
      .get(`/api-v1/workspaces/${scenario.workspace._id}`)
      .set(authHeader(scenario.owner));

    expect(res.status).toBe(200);
  });

  it("does NOT let a non-member read workspace details", async () => {
    const res = await request(app)
      .get(`/api-v1/workspaces/${scenario.workspace._id}`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT leak member emails to a non-member", async () => {
    const res = await request(app)
      .get(`/api-v1/workspaces/${scenario.workspace._id}`)
      .set(authHeader(scenario.outsider));

    expect(JSON.stringify(res.body)).not.toContain(scenario.owner.email);
  });

  it("does NOT let a non-member list workspace projects", async () => {
    const res = await request(app)
      .get(`/api-v1/workspaces/${scenario.workspace._id}/projects`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT let a non-member read workspace stats", async () => {
    const res = await request(app)
      .get(`/api-v1/workspaces/${scenario.workspace._id}/stats`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT let an arbitrary user join a workspace without an invite token", async () => {
    const res = await request(app)
      .post(
        `/api-v1/workspaces/${scenario.workspace._id}/accept-generate-invite`
      )
      .set(authHeader(scenario.outsider));

    expect(res.status).toBeGreaterThanOrEqual(400);

    const after = await Workspace.findById(scenario.workspace._id);
    const joined = after.members.some(
      (m) => m.user.toString() === scenario.outsider._id.toString()
    );
    expect(joined).toBe(false);
  });

  it("does NOT let a viewer invite new members", async () => {
    const res = await request(app)
      .post(`/api-v1/workspaces/${scenario.workspace._id}/invite-member`)
      .set(authHeader(scenario.viewer))
      .send({ email: "someone@example.com", role: "member" });

    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed workspace id, not 500", async () => {
    const res = await request(app)
      .get("/api-v1/workspaces/not-a-valid-object-id")
      .set(authHeader(scenario.owner));

    expect(res.status).toBe(400);
  });
});
