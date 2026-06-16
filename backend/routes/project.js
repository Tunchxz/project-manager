import express from "express";
import { z } from "zod";
import { validateRequest } from "zod-express-middleware";

import {
  createProject,
  deleteProject,
  getProjectDetails,
  getProjectTasks,
} from "../controllers/project.js";
import { objectId, projectSchema } from "../libs/validate-schema.js";
import authMiddleware from "../middleware/auth-middleware.js";
import {
  PROJECT_WRITE_ROLES,
  requireProjectMember,
  requireWorkspaceMember,
  WORKSPACE_WRITE_ROLES,
} from "../middleware/authorize.js";

const router = express.Router();

router.use(authMiddleware);

const projectParam = validateRequest({
  params: z.object({ projectId: objectId }),
});

router.post(
  "/:workspaceId/create-project",
  validateRequest({
    params: z.object({ workspaceId: objectId }),
    body: projectSchema,
  }),
  requireWorkspaceMember("workspaceId", WORKSPACE_WRITE_ROLES),
  createProject
);

router.get(
  "/:projectId",
  projectParam,
  requireProjectMember("projectId"),
  getProjectDetails
);

router.get(
  "/:projectId/tasks",
  projectParam,
  requireProjectMember("projectId"),
  getProjectTasks
);

router.delete(
  "/:projectId",
  projectParam,
  requireProjectMember("projectId", PROJECT_WRITE_ROLES),
  deleteProject
);

export default router;
