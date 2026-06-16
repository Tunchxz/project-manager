import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import asyncHandler from "../libs/async-handler.js";
import { recordActivity } from "../libs/index.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../libs/errors.js";
import { sendEmail } from "../libs/send-email.js";
import Project from "../models/project.js";
import User from "../models/user.js";
import Workspace from "../models/workspace.js";
import WorkspaceInvite from "../models/workspace-invite.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;

  const workspace = await Workspace.create({
    name,
    description,
    color,
    owner: req.user._id,
    members: [{ user: req.user._id, role: "owner", joinedAt: new Date() }],
  });

  await recordActivity(
    req.user._id,
    "created_workspace",
    "Workspace",
    workspace._id,
    { description: `created workspace ${name}` }
  );

  res.status(201).json(workspace);
});

const getWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({
    "members.user": req.user._id,
  }).sort({ createdAt: -1 });

  res.status(200).json(workspaces);
});

const getWorkspaceDetails = asyncHandler(async (req, res) => {
  // Membership is enforced by the authorization middleware.
  const workspace = await req.workspace.populate(
    "members.user",
    "name email profilePicture"
  );

  res.status(200).json(workspace);
});

const getWorkspaceProjects = asyncHandler(async (req, res) => {
  const workspace = await req.workspace.populate(
    "members.user",
    "name email profilePicture"
  );

  // Workspace owners and admins oversee every project; everyone else only
  // sees the projects they belong to.
  const seesAllProjects = ["owner", "admin"].includes(req.workspaceRole);

  const projects = await Project.find({
    workspace: workspace._id,
    isArchived: false,
    ...(seesAllProjects
      ? {}
      : { members: { $elemMatch: { user: req.user._id } } }),
  })
    .populate("tasks", "status")
    .sort({ createdAt: -1 });

  res.status(200).json({ projects, workspace });
});

const getWorkspaceStats = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  const [totalProjects, projects] = await Promise.all([
    Project.countDocuments({ workspace: workspaceId }),
    Project.find({ workspace: workspaceId })
      .populate(
        "tasks",
        "title status dueDate project updatedAt isArchived priority"
      )
      .sort({ createdAt: -1 }),
  ]);

  const tasks = projects.flatMap((project) => project.tasks);
  const countByStatus = (status) =>
    tasks.filter((task) => task.status === status).length;

  const stats = {
    totalProjects,
    totalTasks: tasks.length,
    totalProjectInProgress: projects.filter((p) => p.status === "In Progress")
      .length,
    totalTaskCompleted: countByStatus("Done"),
    totalTaskToDo: countByStatus("To Do"),
    totalTaskInProgress: countByStatus("In Progress"),
  };

  const now = Date.now();
  const upcomingTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate).getTime();
    return due > now && due <= now + UPCOMING_WINDOW_MS;
  });

  const taskTrendsData = [
    { name: "Sun", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Mon", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Tue", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Wed", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Thu", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Fri", completed: 0, inProgress: 0, toDo: 0 },
    { name: "Sat", completed: 0, inProgress: 0, toDo: 0 },
  ];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  // Iterates the task objects and counts the number of tasks completed,
  // in progress, and to do for each day in the last 7 days.
  for (const task of tasks) {
    const taskDate = new Date(task.updatedAt);
    const day = last7Days.find((date) => isSameDay(date, taskDate));

    if (!day) continue;

    const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
    const dayData = taskTrendsData.find((d) => d.name === dayName);

    if (!dayData) continue;

    if (task.status === "Done") dayData.completed++;
    else if (task.status === "In Progress") dayData.inProgress++;
    else if (task.status === "To Do") dayData.toDo++;
  }

  const countProjectsByStatus = (status) =>
    projects.filter((p) => p.status === status).length;

  const projectStatusData = [
    { name: "Completed", value: countProjectsByStatus("Completed") },
    { name: "In Progress", value: countProjectsByStatus("In Progress") },
    { name: "Planning", value: countProjectsByStatus("Planning") },
  ];

  const countByPriority = (priority) =>
    tasks.filter((task) => task.priority === priority).length;

  const taskPriorityData = [
    { name: "High", value: countByPriority("High") },
    { name: "Medium", value: countByPriority("Medium") },
    { name: "Low", value: countByPriority("Low") },
  ];

  const workspaceProductivityData = projects.map((project) => {
    const projectTasks = project.tasks;
    return {
      name: project.title,
      completed: projectTasks.filter(
        (task) => task.status === "Done" && !task.isArchived
      ).length,
      total: projectTasks.length,
    };
  });

  res.status(200).json({
    stats,
    taskTrendsData,
    projectStatusData,
    taskPriorityData,
    workspaceProductivityData,
    upcomingTasks,
    recentProjects: projects.slice(0, 5),
  });
});

const inviteUserToWorkspace = asyncHandler(async (req, res) => {
  // The authorization middleware already enforced the role.
  const { workspace } = req;
  const { email, role } = req.body;

  const genericResponse = {
    message: "If that user exists, an invitation has been sent.",
  };

  const existingUser = await User.findOne({ email });

  // Do not confirm whether an address is registered.
  if (!existingUser) {
    return res.status(200).json(genericResponse);
  }

  const isMember = workspace.members.some(
    (member) => member.user.toString() === existingUser._id.toString()
  );

  if (isMember) {
    throw new BadRequestError("User is already a member of this workspace");
  }

  const existingInvite = await WorkspaceInvite.findOne({
    user: existingUser._id,
    workspaceId: workspace._id,
  });

  if (existingInvite && existingInvite.expiresAt > new Date()) {
    throw new BadRequestError("User has already been invited");
  }

  if (existingInvite) {
    await existingInvite.deleteOne();
  }

  const inviteToken = jwt.sign(
    {
      user: existingUser._id,
      workspaceId: workspace._id,
      role: role || "member",
      purpose: "workspace-invite",
    },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  await WorkspaceInvite.create({
    user: existingUser._id,
    workspaceId: workspace._id,
    token: inviteToken,
    role: role || "member",
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  const invitationLink = `${env.FRONTEND_URL}/workspace-invite/${workspace._id}?tk=${inviteToken}`;

  await sendEmail(
    email,
    "You have been invited to join a workspace",
    `<p>You have been invited to join the ${workspace.name} workspace</p>
     <p>Click here to join: <a href="${invitationLink}">${invitationLink}</a></p>`
  );

  res.status(200).json(genericResponse);
});

/**
 * Accepts a pending invitation addressed to the caller.
 */
const acceptGenerateInvite = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  const isMember = workspace.members.some(
    (member) => member.user.toString() === req.user._id.toString()
  );

  if (isMember) {
    throw new BadRequestError("You are already a member of this workspace");
  }

  const invite = await WorkspaceInvite.findOne({
    user: req.user._id,
    workspaceId,
  });

  if (!invite) {
    throw new ForbiddenError("You have not been invited to this workspace");
  }

  if (invite.expiresAt < new Date()) {
    await invite.deleteOne();
    throw new BadRequestError("Invitation has expired");
  }

  workspace.members.push({
    user: req.user._id,
    role: invite.role || "member",
    joinedAt: new Date(),
  });

  await workspace.save();

  await Promise.all([
    invite.deleteOne(),
    recordActivity(req.user._id, "joined_workspace", "Workspace", workspaceId, {
      description: `Joined ${workspace.name} workspace`,
    }),
  ]);

  res.status(200).json({ message: "Invitation accepted successfully" });
});

const acceptInviteByToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired invitation token");
  }

  if (decoded.purpose !== "workspace-invite") {
    throw new UnauthorizedError("Token is not a workspace invitation");
  }

  const { user: invitedUserId, workspaceId, role } = decoded;

  // The invitation is addressed to a specific account.
  if (invitedUserId.toString() !== req.user._id.toString()) {
    throw new ForbiddenError("This invitation was issued to another account");
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  const isMember = workspace.members.some(
    (member) => member.user.toString() === req.user._id.toString()
  );

  if (isMember) {
    throw new BadRequestError("You are already a member of this workspace");
  }

  const inviteInfo = await WorkspaceInvite.findOne({
    user: req.user._id,
    workspaceId,
  });

  if (!inviteInfo) {
    throw new NotFoundError("Invitation not found");
  }

  if (inviteInfo.expiresAt < new Date()) {
    await inviteInfo.deleteOne();
    throw new BadRequestError("Invitation has expired");
  }

  workspace.members.push({
    user: req.user._id,
    role: role || "member",
    joinedAt: new Date(),
  });

  await workspace.save();

  await Promise.all([
    inviteInfo.deleteOne(),
    recordActivity(req.user._id, "joined_workspace", "Workspace", workspaceId, {
      description: `Joined ${workspace.name} workspace`,
    }),
  ]);

  res.status(200).json({ message: "Invitation accepted successfully" });
});

const deleteWorkspace = asyncHandler(async (req, res) => {
  const { workspace } = req;

  if (workspace.owner.toString() !== req.user._id.toString()) {
    throw new ForbiddenError("Only the workspace owner can delete it");
  }

  const projects = await Project.find({ workspace: workspace._id }).select(
    "_id"
  );
  const projectIds = projects.map((p) => p._id);

  const { default: Task } = await import("../models/task.js");
  const { default: Comment } = await import("../models/comment.js");

  const tasks = await Task.find({ project: { $in: projectIds } }).select("_id");
  const taskIds = tasks.map((t) => t._id);

  await Promise.all([
    Comment.deleteMany({ task: { $in: taskIds } }),
    Task.deleteMany({ project: { $in: projectIds } }),
    Project.deleteMany({ workspace: workspace._id }),
    WorkspaceInvite.deleteMany({ workspaceId: workspace._id }),
  ]);

  await workspace.deleteOne();

  res.status(200).json({ message: "Workspace deleted" });
});

export {
  acceptGenerateInvite,
  acceptInviteByToken,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceDetails,
  getWorkspaceProjects,
  getWorkspaces,
  getWorkspaceStats,
  inviteUserToWorkspace,
};
