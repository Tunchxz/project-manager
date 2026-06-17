import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import createApp from "../app.js";
import { authHeader, seedScenario } from "./helpers/factories.js";

const app = createApp();

describe("task authorization", () => {
  let scenario;

  beforeEach(async () => {
    scenario = await seedScenario();
  });

  it("lets a project member read a task", async () => {
    const res = await request(app)
      .get(`/api-v1/tasks/${scenario.task._id}`)
      .set(authHeader(scenario.owner));

    expect(res.status).toBe(200);
  });

  it("does NOT let a non-member read a task", async () => {
    const res = await request(app)
      .get(`/api-v1/tasks/${scenario.task._id}`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT let a non-member read a task's comments", async () => {
    const res = await request(app)
      .get(`/api-v1/tasks/${scenario.task._id}/comments`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT let a non-member read a task's activity log", async () => {
    const res = await request(app)
      .get(`/api-v1/tasks/${scenario.task._id}/activity`)
      .set(authHeader(scenario.outsider));

    expect(res.status).toBe(403);
  });

  it("does NOT let a viewer change a task's status", async () => {
    const res = await request(app)
      .put(`/api-v1/tasks/${scenario.task._id}/status`)
      .set(authHeader(scenario.viewer))
      .send({ status: "Done" });

    expect(res.status).toBe(403);
  });

  it("returns 400 (not 500) for a status outside the allowed enum", async () => {
    const res = await request(app)
      .put(`/api-v1/tasks/${scenario.task._id}/status`)
      .set(authHeader(scenario.owner))
      .send({ status: "Not A Real Status" });

    expect(res.status).toBe(400);
  });

  it("updates the description of a task that has none, without erroring", async () => {
    const res = await request(app)
      .put(`/api-v1/tasks/${scenario.task._id}/description`)
      .set(authHeader(scenario.owner))
      .send({ description: "a new description" });

    expect(res.status).toBe(200);
  });
});
