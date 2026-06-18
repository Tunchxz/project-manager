export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  isEmailVerified: boolean;
  updatedAt: Date;
  profilePicture?: string;
}

export interface Workspace {
  _id: string;
  name: string;
  description?: string;
  owner: User | string;
  color: string;
  // Mongo subdocuments carry their own _id
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}
export enum ProjectStatus {
  PLANNING = "Planning",
  IN_PROGRESS = "In Progress",
  ON_HOLD = "On Hold",
  COMPLETED = "Completed",
  CANCELLED = "Cancelled",
}

export interface WorkspaceMember {
  _id: string;
  user: User;
  role: "admin" | "member" | "owner" | "viewer";
  joinedAt: Date;
}

export interface Project {
  _id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  workspace: Workspace;
  startDate: Date;
  dueDate: Date;
  progress: number;
  tasks: Task[];
  members: ProjectMember[];
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}
export interface ProjectMember {
  _id: string;
  user: User;
  role: "manager" | "contributor" | "viewer";
}

export type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
export type TaskPriority = "High" | "Medium" | "Low";
export enum ProjectMemberRole {
  MANAGER = "manager",
  CONTRIBUTOR = "contributor",
  VIEWER = "viewer",
}

export interface Subtask {
  _id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  project: Project;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  dueDate: Date;
  priority: TaskPriority;
  assignee: User | string;
  createdBy: User | string;
  assignees: User[];
  subtasks?: Subtask[];
  watchers?: User[];
  attachments?: Attachment[];
}

export interface Attachment {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  _id: string;
}

export interface MemberProps {
  _id: string;
  user: User;
  role: "admin" | "member" | "owner" | "viewer";
  joinedAt: Date;
}

export type ResourceType =
  "Task" | "Project" | "Workspace" | "Comment" | "User";

export type ActionType =
  | "created_task"
  | "updated_task"
  | "created_subtask"
  | "updated_subtask"
  | "completed_task"
  | "created_project"
  | "updated_project"
  | "completed_project"
  | "created_workspace"
  | "updated_workspace"
  | "added_comment"
  | "added_member"
  | "removed_member"
  | "joined_workspace"
  | "transferred_workspace_ownership"
  | "added_attachment"
  | "deleted_task"
  | "deleted_project"
  | "deleted_workspace";

/** Free-form metadata attached to an activity entry by the API. */
export interface ActivityDetails {
  description?: string;
  [key: string]: unknown;
}

export interface ActivityLog {
  _id: string;
  user: User;
  action: ActionType;
  resourceType: ResourceType;
  resourceId: string;
  details: ActivityDetails;
  createdAt: Date;
}

export interface CommentReaction {
  emoji: string;
  user: User;
}

export interface Comment {
  _id: string;
  author: User;
  text: string;
  createdAt: Date;
  reactions?: CommentReaction[];
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }[];
}

export interface StatsCardProps {
  totalProjects: number;
  totalTasks: number;
  totalProjectInProgress: number;
  totalTaskCompleted: number;
  totalTaskToDo: number;
  totalTaskInProgress: number;
}

export interface TaskTrendsData {
  name: string;
  completed: number;
  inProgress: number;
  toDo: number;
}

export interface TaskPriorityData {
  name: string;
  value: number;
}

export interface ProjectStatusData {
  name: string;
  value: number;
}

export interface WorkspaceProductivityData {
  name: string;
  completed: number;
  total: number;
}

/* ------------------------------------------------------------------ *
 * API response shapes
 *
 * Every hook in app/hooks is typed against these, so `fetchData<T>` is
 * given a real T instead of components re-declaring shapes with `as`.
 * ------------------------------------------------------------------ */

export interface WorkspaceProjectsResponse {
  workspace: Workspace;
  projects: Project[];
}

export interface ProjectTasksResponse {
  project: Project;
  tasks: Task[];
}

export interface TaskDetailsResponse {
  task: Task;
  project: Project;
}

export interface WorkspaceStatsResponse {
  stats: StatsCardProps;
  taskTrendsData: TaskTrendsData[];
  projectStatusData: ProjectStatusData[];
  taskPriorityData: TaskPriorityData[];
  workspaceProductivityData: WorkspaceProductivityData[];
  upcomingTasks: Task[];
  recentProjects: Project[];
}

export interface MessageResponse {
  message: string;
}
