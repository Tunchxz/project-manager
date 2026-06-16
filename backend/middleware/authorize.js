import asyncHandler from "../libs/async-handler.js";
import { ForbiddenError, NotFoundError } from "../libs/errors.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import Workspace from "../models/workspace.js";

/** Roles allowed to mutate content, by scope. */
export const WORKSPACE_WRITE_ROLES = ["owner", "admin", "member"];
export const WORKSPACE_ADMIN_ROLES = ["owner", "admin"];
export const PROJECT_WRITE_ROLES = ["manager", "contributor"];

const idsMatch = (a, b) => a?.toString() === b?.toString();

const memberEntry = (doc, userId) =>
  doc.members?.find((m) => idsMatch(m.user?._id ?? m.user, userId));

/**
 * Loads the workspace named by `param` and asserts req.user belongs to it.
 * Attaches req.workspace and req.workspaceRole.
 */
export const requireWorkspaceMember = (
  param = "workspaceId",
  allowedRoles = null
) =>
  asyncHandler(async (req, res, next) => {
    const workspace = await Workspace.findById(req.params[param]);

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const entry = memberEntry(workspace, req.user._id);

    if (!entry) {
      throw new ForbiddenError("You are not a member of this workspace");
    }

    if (allowedRoles && !allowedRoles.includes(entry.role)) {
      throw new ForbiddenError(
        "You do not have permission to perform this action"
      );
    }

    req.workspace = workspace;
    req.workspaceRole = entry.role;
    next();
  });

/**
 * Loads the project named by `param`, asserts membership of the project (or
 * of its parent workspace), and attaches req.project / req.projectRole.
 */
export const requireProjectMember = (
  param = "projectId",
  allowedRoles = null
) =>
  asyncHandler(async (req, res, next) => {
    const project = await Project.findById(req.params[param]);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await attachProjectAccess(req, project, allowedRoles);
    next();
  });

/**
 * Same as requireProjectMember but resolves the project via the task named
 * by `param`. Attaches req.task as well.
 */
export const requireTaskAccess = (param = "taskId", allowedRoles = null) =>
  asyncHandler(async (req, res, next) => {
    const task = await Task.findById(req.params[param]);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const project = await Project.findById(task.project);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await attachProjectAccess(req, project, allowedRoles);
    req.task = task;
    next();
  });

/**
 * Shared Access Rule
 * A user may act on a project if they are a project member, or a
 * workspace owner/admin (who implicitly oversee every project).
 */
const attachProjectAccess = async (req, project, allowedRoles) => {
  const workspace = await Workspace.findById(project.workspace);

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  const workspaceEntry = memberEntry(workspace, req.user._id);

  if (!workspaceEntry) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  const projectEntry = memberEntry(project, req.user._id);
  const isWorkspaceAdmin = WORKSPACE_ADMIN_ROLES.includes(workspaceEntry.role);

  if (!projectEntry && !isWorkspaceAdmin) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Workspace viewers stay read-only even if listed on the project.
  const effectiveRole = isWorkspaceAdmin
    ? "manager"
    : (projectEntry?.role ?? "viewer");

  if (allowedRoles) {
    const workspaceIsReadOnly = workspaceEntry.role === "viewer";
    if (workspaceIsReadOnly || !allowedRoles.includes(effectiveRole)) {
      throw new ForbiddenError(
        "You do not have permission to perform this action"
      );
    }
  }

  req.workspace = workspace;
  req.workspaceRole = workspaceEntry.role;
  req.project = project;
  req.projectRole = effectiveRole;
};
