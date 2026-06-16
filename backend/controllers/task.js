import { recordActivity } from "../libs/index.js";
import asyncHandler from "../libs/async-handler.js";
import { NotFoundError } from "../libs/errors.js";
import ActivityLog from "../models/activity.js";
import Comment from "../models/comment.js";
import Task from "../models/task.js";

/**
 * Handlers in this file rely on middleware/authorize.js having already
 * loaded and access-checked the resource, so `req.task` / `req.project`
 * are guaranteed present and permitted.
 */

/** Cuts free text for the activity feed. */
const summarize = (value, length = 50) => {
  const text = value ?? "";
  return text.length > length ? `${text.substring(0, length)}...` : text;
};

const createTask = asyncHandler(async (req, res) => {
  const { project } = req;
  const { title, description, status, priority, dueDate, assignees } = req.body;

  const newTask = await Task.create({
    title,
    description,
    status,
    priority,
    dueDate,
    assignees,
    project: project._id,
    createdBy: req.user._id,
  });

  project.tasks.push(newTask._id);
  await project.save();

  await recordActivity(req.user._id, "created_task", "Task", newTask._id, {
    description: `created task ${title}`,
  });

  res.status(201).json(newTask);
});

const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.task._id)
    .populate("assignees", "name profilePicture")
    .populate("watchers", "name profilePicture");

  const project = await req.project.populate(
    "members.user",
    "name profilePicture"
  );

  res.status(200).json({ task, project });
});

const updateTaskTitle = asyncHandler(async (req, res) => {
  const { task } = req;
  const { title } = req.body;
  const oldTitle = task.title;

  task.title = title;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `updated task title from ${oldTitle} to ${title}`,
  });

  res.status(200).json(task);
});

const updateTaskDescription = asyncHandler(async (req, res) => {
  const { task } = req;
  const { description } = req.body;

  const oldDescription = summarize(task.description);
  const newDescription = summarize(description);

  task.description = description;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `updated task description from ${oldDescription} to ${newDescription}`,
  });

  res.status(200).json(task);
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const { task } = req;
  const { status } = req.body;
  const oldStatus = task.status;

  task.status = status;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `updated task status from ${oldStatus} to ${status}`,
  });

  res.status(200).json(task);
});

const updateTaskAssignees = asyncHandler(async (req, res) => {
  const { task } = req;
  const { assignees } = req.body;
  const oldCount = task.assignees.length;

  task.assignees = assignees;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `updated task assignees from ${oldCount} to ${assignees.length}`,
  });

  res.status(200).json(task);
});

const updateTaskPriority = asyncHandler(async (req, res) => {
  const { task } = req;
  const { priority } = req.body;
  const oldPriority = task.priority;

  task.priority = priority;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `updated task priority from ${oldPriority} to ${priority}`,
  });

  res.status(200).json(task);
});

const addSubTask = asyncHandler(async (req, res) => {
  const { task } = req;
  const { title } = req.body;

  task.subtasks.push({ title, completed: false });
  await task.save();

  await recordActivity(req.user._id, "created_subtask", "Task", task._id, {
    description: `created subtask ${title}`,
  });

  res.status(201).json(task);
});

const updateSubTask = asyncHandler(async (req, res) => {
  const { task } = req;
  const { subTaskId } = req.params;
  const { completed } = req.body;

  const subTask = task.subtasks.id(subTaskId);

  if (!subTask) {
    throw new NotFoundError("Subtask not found");
  }

  subTask.completed = completed;
  await task.save();

  await recordActivity(req.user._id, "updated_subtask", "Task", task._id, {
    description: `updated subtask ${subTask.title}`,
  });

  res.status(200).json(task);
});

const getActivityByResourceId = asyncHandler(async (req, res) => {
  const activity = await ActivityLog.find({ resourceId: req.task._id })
    .populate("user", "name profilePicture")
    .sort({ createdAt: -1 });

  res.status(200).json(activity);
});

const getCommentsByTaskId = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ task: req.task._id })
    .populate("author", "name profilePicture")
    .sort({ createdAt: -1 });

  res.status(200).json(comments);
});

const addComment = asyncHandler(async (req, res) => {
  const { task } = req;
  const { text } = req.body;

  const newComment = await Comment.create({
    text,
    task: task._id,
    author: req.user._id,
  });

  task.comments.push(newComment._id);
  await task.save();

  await recordActivity(req.user._id, "added_comment", "Task", task._id, {
    description: `added comment ${summarize(text)}`,
  });

  res.status(201).json(newComment);
});

const watchTask = asyncHandler(async (req, res) => {
  const { task } = req;
  const isWatching = task.watchers.some(
    (watcher) => watcher.toString() === req.user._id.toString()
  );

  if (isWatching) {
    task.watchers = task.watchers.filter(
      (watcher) => watcher.toString() !== req.user._id.toString()
    );
  } else {
    task.watchers.push(req.user._id);
  }

  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `${isWatching ? "stopped watching" : "started watching"} task ${task.title}`,
  });

  res.status(200).json(task);
});

const archiveTask = asyncHandler(async (req, res) => {
  const { task } = req;
  const wasArchived = task.isArchived;

  task.isArchived = !wasArchived;
  await task.save();

  await recordActivity(req.user._id, "updated_task", "Task", task._id, {
    description: `${wasArchived ? "unarchived" : "archived"} task ${task.title}`,
  });

  res.status(200).json(task);
});

const deleteTask = asyncHandler(async (req, res) => {
  const { task, project } = req;

  await Comment.deleteMany({ task: task._id });
  await ActivityLog.deleteMany({ resourceId: task._id, resourceType: "Task" });

  project.tasks = project.tasks.filter(
    (id) => id.toString() !== task._id.toString()
  );
  await project.save();

  await task.deleteOne();

  await recordActivity(req.user._id, "deleted_task", "Project", project._id, {
    description: `deleted task ${task.title}`,
  });

  res.status(200).json({ message: "Task deleted" });
});

const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ assignees: { $in: [req.user._id] } })
    .populate("project", "title workspace")
    .sort({ createdAt: -1 });

  res.status(200).json(tasks);
});

export {
  addComment,
  addSubTask,
  archiveTask,
  createTask,
  deleteTask,
  getActivityByResourceId,
  getCommentsByTaskId,
  getMyTasks,
  getTaskById,
  updateSubTask,
  updateTaskAssignees,
  updateTaskDescription,
  updateTaskPriority,
  updateTaskStatus,
  updateTaskTitle,
  watchTask,
};
