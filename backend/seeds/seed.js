import bcrypt from "bcrypt";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import ActivityLog from "../models/activity.js";
import Comment from "../models/comment.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import User from "../models/user.js";
import Workspace from "../models/workspace.js";
import WorkspaceInvite from "../models/workspace-invite.js";

/**
 * Seeds a demo dataset: a pre-verified demo account with enough content for
 * the dashboard charts to be meaningful. Backs both the "Try the demo"
 * button and the end-to-end test fixtures.
 *
 * Safe to re-run: it clears the collections first.
 */

const DEMO_EMAIL = "demo@taskhub.dev";
const DEMO_PASSWORD = "demo1234";

const daysFromNow = (n) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
};

const seed = async () => {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to ${env.MONGODB_URI}`);

  await Promise.all([
    User.deleteMany({}),
    Workspace.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    ActivityLog.deleteMany({}),
    WorkspaceInvite.deleteMany({}),
  ]);
  console.log("Cleared existing data.");

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [demo, alex, sam] = await User.create([
    {
      name: "Demo User",
      email: DEMO_EMAIL,
      password,
      isEmailVerified: true,
    },
    {
      name: "Alex Rivera",
      email: "alex@taskhub.dev",
      password,
      isEmailVerified: true,
    },
    {
      name: "Sam Okonkwo",
      email: "sam@taskhub.dev",
      password,
      isEmailVerified: true,
    },
  ]);

  const sideProject = await Workspace.create({
    name: "Personal",
    description: "Side projects and errands.",
    color: "#10b981",
    owner: demo._id,
    members: [{ user: demo._id, role: "owner" }],
  });

  const acme = await Workspace.create({
    name: "Acme Product Team",
    description: "Everything the product team is shipping this quarter.",
    color: "#3b82f6",
    owner: demo._id,
    members: [
      { user: demo._id, role: "owner" },
      { user: alex._id, role: "admin" },
      { user: sam._id, role: "member" },
    ],
  });

  const projectSpecs = [
    {
      workspace: acme,
      title: "Website Redesign",
      description: "Rebuild the marketing site with the new brand.",
      status: "In Progress",
      members: [
        { user: demo._id, role: "manager" },
        { user: alex._id, role: "contributor" },
        { user: sam._id, role: "contributor" },
      ],
      tasks: [
        { title: "Audit current pages", status: "Done", priority: "Medium" },
        { title: "Design system tokens", status: "Done", priority: "High" },
        {
          title: "Build the hero section",
          status: "In Progress",
          priority: "High",
        },
        {
          title: "Migrate the blog",
          status: "In Progress",
          priority: "Medium",
        },
        { title: "Set up analytics", status: "To Do", priority: "Low" },
        { title: "Accessibility pass", status: "To Do", priority: "High" },
      ],
    },
    {
      workspace: acme,
      title: "Mobile App v2",
      description: "Offline support and a faster sync engine.",
      status: "Planning",
      members: [
        { user: demo._id, role: "manager" },
        { user: sam._id, role: "contributor" },
      ],
      tasks: [
        {
          title: "Spike: local-first storage",
          status: "Done",
          priority: "High",
        },
        {
          title: "Define the sync protocol",
          status: "In Progress",
          priority: "High",
        },
        {
          title: "Conflict resolution rules",
          status: "To Do",
          priority: "Medium",
        },
        { title: "Draft the release plan", status: "To Do", priority: "Low" },
      ],
    },
    {
      workspace: acme,
      title: "Q3 Infrastructure",
      description: "Cost reduction and reliability work.",
      status: "Completed",
      members: [
        { user: demo._id, role: "manager" },
        { user: alex._id, role: "contributor" },
      ],
      tasks: [
        {
          title: "Right-size the database",
          status: "Done",
          priority: "Medium",
        },
        { title: "Add uptime monitoring", status: "Done", priority: "High" },
        { title: "Document the runbook", status: "Done", priority: "Low" },
      ],
    },
    {
      workspace: sideProject,
      title: "Home Automation",
      description: "Small weekend automation ideas.",
      status: "In Progress",
      members: [{ user: demo._id, role: "manager" }],
      tasks: [
        {
          title: "Replace the hallway sensor",
          status: "To Do",
          priority: "Low",
        },
        { title: "Back up the config", status: "Done", priority: "Medium" },
        {
          title: "Automate the porch light",
          status: "In Progress",
          priority: "Low",
        },
      ],
    },
  ];

  let taskCount = 0;

  for (const spec of projectSpecs) {
    const project = await Project.create({
      title: spec.title,
      description: spec.description,
      workspace: spec.workspace._id,
      status: spec.status,
      startDate: daysFromNow(-30),
      dueDate: daysFromNow(30),
      members: spec.members,
      createdBy: demo._id,
      tags: ["seed"],
    });

    for (const [index, taskSpec] of spec.tasks.entries()) {
      const task = await Task.create({
        title: taskSpec.title,
        description: `${taskSpec.title} — seeded demo task.`,
        project: project._id,
        status: taskSpec.status,
        priority: taskSpec.priority,
        // Spread due dates so the "upcoming" panel has content.
        dueDate: daysFromNow(index - 1),
        assignees: [spec.members[index % spec.members.length].user],
        createdBy: demo._id,
      });

      project.tasks.push(task._id);
      taskCount += 1;

      if (index === 0) {
        const comment = await Comment.create({
          text: "Kicking this off — shout if anything looks off.",
          task: task._id,
          author: alex._id,
        });
        task.comments.push(comment._id);
        await task.save();
      }

      await ActivityLog.create({
        user: demo._id,
        action: "created_task",
        resourceType: "Task",
        resourceId: task._id,
        details: { description: `created task ${task.title}` },
      });
    }

    await project.save();
    spec.workspace.projects.push(project._id);
    await spec.workspace.save();
  }

  console.log(
    `Seeded ${projectSpecs.length} projects and ${taskCount} tasks across 2 workspaces.`
  );
  console.log(`Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
