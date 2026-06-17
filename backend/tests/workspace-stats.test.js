import request from "supertest";
import { describe, expect, it } from "vitest";

import createApp from "../app.js";
import {
  authHeader,
  createProject,
  createTask,
  createUser,
  createWorkspace,
} from "./helpers/factories.js";

const app = createApp();

describe("workspace stats", () => {
  it("reports non-zero task trends for tasks touched today", async () => {
    const { user: owner } = await createUser();
    const workspace = await createWorkspace(owner);
    const project = await createProject(workspace, owner);

    await createTask(project, owner, { status: "Done" });
    await createTask(project, owner, { status: "In Progress" });
    await createTask(project, owner, { status: "To Do" });

    const res = await request(app)
      .get(`/api-v1/workspaces/${workspace._id}/stats`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);

    // Pins the `for (const task in project.tasks)` bug, which bound `task`
    // to the array index and left every bucket at zero.
    const total = res.body.taskTrendsData.reduce(
      (sum, day) => sum + day.completed + day.inProgress + day.toDo,
      0
    );
    expect(total).toBe(3);
  });

  it("counts tasks and projects correctly", async () => {
    const { user: owner } = await createUser();
    const workspace = await createWorkspace(owner);
    const project = await createProject(workspace, owner);
    await createTask(project, owner, { status: "Done" });
    await createTask(project, owner, { status: "To Do" });

    const res = await request(app)
      .get(`/api-v1/workspaces/${workspace._id}/stats`)
      .set(authHeader(owner));

    expect(res.body.stats.totalProjects).toBe(1);
    expect(res.body.stats.totalTasks).toBe(2);
    expect(res.body.stats.totalTaskCompleted).toBe(1);
    expect(res.body.stats.totalTaskToDo).toBe(1);
  });
});
