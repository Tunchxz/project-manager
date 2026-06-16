import asyncHandler from "../libs/async-handler.js";
import { recordActivity } from "../libs/index.js";
import { BadRequestError, ForbiddenError } from "../libs/errors.js";
import Comment from "../models/comment.js";
import Project from "../models/project.js";
import Task from "../models/task.js";

/**
 * Membership and role checks are handled by middleware/authorize.js, which
 * attaches req.workspace / req.project.
 */

const createProject = asyncHandler(async (req, res) => {
  const { workspace } = req;
  const { title, description, status, startDate, dueDate, tags, members } =
    req.body;

  // Members may only be drawn from the parent workspace.
  const workspaceMemberIds = new Set(
    workspace.members.map((m) => m.user.toString())
  );

  const requestedMembers = members ?? [];
  const invalid = requestedMembers.filter(
    (m) => !workspaceMemberIds.has(m.user.toString())
  );

  if (invalid.length > 0) {
    throw new BadRequestError(
      "All project members must belong to the workspace"
    );
  }

  // The creator is automatically added as a manager if not already
  // included in the request.
  const projectMembers = requestedMembers.some(
    (m) => m.user.toString() === req.user._id.toString()
  )
    ? requestedMembers
    : [...requestedMembers, { user: req.user._id, role: "manager" }];

  const newProject = await Project.create({
    title,
    description,
    status,
    startDate,
    dueDate,
    tags: tags
      ? tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      : [],
    workspace: workspace._id,
    members: projectMembers,
    createdBy: req.user._id,
  });

  workspace.projects.push(newProject._id);
  await workspace.save();

  await recordActivity(
    req.user._id,
    "created_project",
    "Project",
    newProject._id,
    { description: `created project ${title}` }
  );

  res.status(201).json(newProject);
});

const getProjectDetails = asyncHandler(async (req, res) => {
  res.status(200).json(req.project);
});

const getProjectTasks = asyncHandler(async (req, res) => {
  const project = await req.project.populate(
    "members.user",
    "name email profilePicture"
  );

  const tasks = await Task.find({ project: project._id, isArchived: false })
    .populate("assignees", "name profilePicture")
    .sort({ createdAt: -1 });

  res.status(200).json({ project, tasks });
});

const deleteProject = asyncHandler(async (req, res) => {
  const { project, workspace } = req;

  if (
    project.createdBy.toString() !== req.user._id.toString() &&
    !["owner", "admin"].includes(req.workspaceRole)
  ) {
    throw new ForbiddenError(
      "Only the project creator or a workspace admin can delete it"
    );
  }

  const tasks = await Task.find({ project: project._id }).select("_id");
  const taskIds = tasks.map((t) => t._id);

  await Promise.all([
    Comment.deleteMany({ task: { $in: taskIds } }),
    Task.deleteMany({ project: project._id }),
  ]);

  workspace.projects = workspace.projects.filter(
    (id) => id.toString() !== project._id.toString()
  );
  await workspace.save();

  await project.deleteOne();

  await recordActivity(
    req.user._id,
    "deleted_project",
    "Workspace",
    workspace._id,
    { description: `deleted project ${project.title}` }
  );

  res.status(200).json({ message: "Project deleted" });
});

export { createProject, deleteProject, getProjectDetails, getProjectTasks };
