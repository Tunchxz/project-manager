import express from "express";
import { z } from "zod";
import { validateRequest } from "zod-express-middleware";

import {
  acceptGenerateInvite,
  acceptInviteByToken,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceDetails,
  getWorkspaceProjects,
  getWorkspaces,
  getWorkspaceStats,
  inviteUserToWorkspace,
} from "../controllers/workspace.js";
import {
  inviteMemberSchema,
  objectId,
  tokenSchema,
  workspaceSchema,
} from "../libs/validate-schema.js";
import authMiddleware from "../middleware/auth-middleware.js";
import {
  requireWorkspaceMember,
  WORKSPACE_ADMIN_ROLES,
} from "../middleware/authorize.js";

const router = express.Router();

router.use(authMiddleware);

const workspaceParam = validateRequest({
  params: z.object({ workspaceId: objectId }),
});

router.post("/", validateRequest({ body: workspaceSchema }), createWorkspace);

router.post(
  "/accept-invite-token",
  validateRequest({ body: tokenSchema }),
  acceptInviteByToken
);

router.post(
  "/:workspaceId/invite-member",
  workspaceParam,
  validateRequest({ body: inviteMemberSchema }),
  requireWorkspaceMember("workspaceId", WORKSPACE_ADMIN_ROLES),
  inviteUserToWorkspace
);

// Deliberately NOT uses requireWorkspaceMember since the caller is by
// definition not yet a member. The controller requires a pending invite.
router.post(
  "/:workspaceId/accept-generate-invite",
  workspaceParam,
  acceptGenerateInvite
);

router.get("/", getWorkspaces);

router.get(
  "/:workspaceId",
  workspaceParam,
  requireWorkspaceMember("workspaceId"),
  getWorkspaceDetails
);

router.get(
  "/:workspaceId/projects",
  workspaceParam,
  requireWorkspaceMember("workspaceId"),
  getWorkspaceProjects
);

router.get(
  "/:workspaceId/stats",
  workspaceParam,
  requireWorkspaceMember("workspaceId"),
  getWorkspaceStats
);

router.delete(
  "/:workspaceId",
  workspaceParam,
  requireWorkspaceMember("workspaceId", ["owner"]),
  deleteWorkspace
);

export default router;
