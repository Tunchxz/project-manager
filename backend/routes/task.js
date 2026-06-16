import express from "express";
import { z } from "zod";
import { validateRequest } from "zod-express-middleware";

import {
  archiveTask,
  addComment,
  addSubTask,
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
} from "../controllers/task.js";
import {
  objectId,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
} from "../libs/validate-schema.js";
import authMiddleware from "../middleware/auth-middleware.js";
import {
  PROJECT_WRITE_ROLES,
  requireProjectMember,
  requireTaskAccess,
} from "../middleware/authorize.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/my-tasks", getMyTasks);

router.post(
  "/:projectId/create-task",
  validateRequest({
    params: z.object({ projectId: objectId }),
    body: taskSchema,
  }),
  requireProjectMember("projectId", PROJECT_WRITE_ROLES),
  createTask
);

router.post(
  "/:taskId/add-subtask",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ title: z.string().min(1) }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  addSubTask
);

router.post(
  "/:taskId/add-comment",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ text: z.string().min(1).max(5000) }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  addComment
);

router.post(
  "/:taskId/watch",
  validateRequest({ params: z.object({ taskId: objectId }) }),
  requireTaskAccess("taskId"),
  watchTask
);

router.post(
  "/:taskId/archived",
  validateRequest({ params: z.object({ taskId: objectId }) }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  archiveTask
);

router.put(
  "/:taskId/update-subtask/:subTaskId",
  validateRequest({
    params: z.object({ taskId: objectId, subTaskId: objectId }),
    body: z.object({ completed: z.boolean() }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateSubTask
);

router.put(
  "/:taskId/title",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ title: z.string().min(1).max(200) }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateTaskTitle
);

router.put(
  "/:taskId/description",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ description: z.string().max(5000) }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateTaskDescription
);

router.put(
  "/:taskId/status",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ status: taskStatusSchema }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateTaskStatus
);

router.put(
  "/:taskId/priority",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ priority: taskPrioritySchema }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateTaskPriority
);

router.put(
  "/:taskId/assignees",
  validateRequest({
    params: z.object({ taskId: objectId }),
    body: z.object({ assignees: z.array(objectId) }),
  }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  updateTaskAssignees
);

router.get(
  "/:taskId",
  validateRequest({ params: z.object({ taskId: objectId }) }),
  requireTaskAccess("taskId"),
  getTaskById
);

router.get(
  "/:resourceId/activity",
  validateRequest({ params: z.object({ resourceId: objectId }) }),
  requireTaskAccess("resourceId"),
  getActivityByResourceId
);

router.get(
  "/:taskId/comments",
  validateRequest({ params: z.object({ taskId: objectId }) }),
  requireTaskAccess("taskId"),
  getCommentsByTaskId
);

router.delete(
  "/:taskId",
  validateRequest({ params: z.object({ taskId: objectId }) }),
  requireTaskAccess("taskId", PROJECT_WRITE_ROLES),
  deleteTask
);

export default router;
