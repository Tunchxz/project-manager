import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import createApp from "../app.js";
import { authHeader, createUser, seedScenario } from "./helpers/factories.js";

const app = createApp();

describe("project authorization", () => {
  let scenario;

  beforeEach(async () => {
    scenario = await seedScenario();
  });

  it("does NOT let a non-member read a project", async () => {
    const res = await request(app)
      .get(`/api-v1/projects/${scenario.project._id}`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("adds the creator as a project member so they can read it back", async () => {
    const created = await request(app)
      .post(`/api-v1/projects/${scenario.workspace._id}/create-project`)
      .set(authHeader(scenario.owner))
      .send({
        title: "Fresh project",
        status: "Planning",
        startDate: new Date().toISOString(),
      });

    expect(created.status).toBe(201);

    const fetched = await request(app)
      .get(`/api-v1/projects/${created.body._id}`)
      .set(authHeader(scenario.owner));

    expect(fetched.status).toBe(200);
  });

  it("rejects project members who do not belong to the workspace", async () => {
    const { user: stranger } = await createUser();

    const res = await request(app)
      .post(`/api-v1/projects/${scenario.workspace._id}/create-project`)
      .set(authHeader(scenario.owner))
      .send({
        title: "Smuggled member",
        status: "Planning",
        startDate: new Date().toISOString(),
        members: [{ user: stranger._id.toString(), role: "contributor" }],
      });

    expect(res.status).toBe(400);
  });

  it("does NOT let a workspace viewer create a project", async () => {
    const res = await request(app)
      .post(`/api-v1/projects/${scenario.workspace._id}/create-project`)
      .set(authHeader(scenario.viewer))
      .send({
        title: "Not allowed",
        status: "Planning",
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(403);
  });
});
