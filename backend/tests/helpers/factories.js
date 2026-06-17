import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import Project from "../../models/project.js";
import Task from "../../models/task.js";
import User from "../../models/user.js";
import Workspace from "../../models/workspace.js";

let counter = 0;
const uniq = () => `${Date.now()}-${++counter}`;

export const createUser = async (overrides = {}) => {
  const password = overrides.password ?? "password123";
  const user = await User.create({
    name: overrides.name ?? `User ${uniq()}`,
    email: overrides.email ?? `user-${uniq()}@example.com`,
    password: await bcrypt.hash(password, 10),
    isEmailVerified: overrides.isEmailVerified ?? true,
  });
  return { user, password };
};

export const tokenFor = (user) =>
  jwt.sign({ userId: user._id, purpose: "login" }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

export const authHeader = (user) => ({
  Authorization: `Bearer ${tokenFor(user)}`,
});

export const createWorkspace = async (owner, members = []) =>
  Workspace.create({
    name: `Workspace ${uniq()}`,
    color: "#FF5733",
    owner: owner._id,
    members: [
      { user: owner._id, role: "owner" },
      ...members.map((m) => ({
        user: m.user._id,
        role: m.role ?? "member",
      })),
    ],
  });

export const createProject = async (workspace, creator, members = []) =>
  Project.create({
    title: `Project ${uniq()}`,
    workspace: workspace._id,
    status: "Planning",
    startDate: new Date(),
    createdBy: creator._id,
    members: [
      { user: creator._id, role: "manager" },
      ...members.map((m) => ({
        user: m.user._id,
        role: m.role ?? "contributor",
      })),
    ],
  });

export const createTask = async (project, creator, overrides = {}) => {
  const task = await Task.create({
    title: overrides.title ?? `Task ${uniq()}`,
    description: overrides.description,
    project: project._id,
    status: overrides.status ?? "To Do",
    priority: overrides.priority ?? "Medium",
    dueDate: overrides.dueDate ?? new Date(),
    assignees: overrides.assignees ?? [creator._id],
    createdBy: creator._id,
  });
  project.tasks.push(task._id);
  await project.save();
  return task;
};

/**
 * Builds the common fixture: an owner with a workspace + project + task,
 * and a completely unrelated "outsider" user who is a member of nothing.
 */
export const seedScenario = async () => {
  const { user: owner } = await createUser({ name: "Owner" });
  const { user: outsider } = await createUser({ name: "Outsider" });
  const { user: viewer } = await createUser({ name: "Viewer" });

  const workspace = await createWorkspace(owner, [
    { user: viewer, role: "viewer" },
  ]);
  const project = await createProject(workspace, owner, [
    { user: viewer, role: "viewer" },
  ]);
  const task = await createTask(project, owner);

  return { owner, outsider, viewer, workspace, project, task };
};
