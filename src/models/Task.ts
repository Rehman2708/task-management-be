import mongoose from "mongoose";
import {
  AssignedTo,
  Frequency,
  Priority,
  Recurrence,
  SubtaskStatus,
  TaskStatus,
} from "../enum/task.js";

// Task-level Comment Schema
export const CommentSchema = new mongoose.Schema(
  {
    by: { type: String, required: false }, // userId
    createdBy: { type: String, required: false }, // userId
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
    image: { type: String, required: false },
    text: { type: String, required: false },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Subtask Schema
const SubtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SubtaskStatus),
      default: SubtaskStatus.Pending,
    },
    assignedTo: {
      type: String,
      enum: Object.values(AssignedTo),
      required: false, // No default - allows inheritance from task level
    },
    completedBy: {
      type: [String], // Array of userIds who completed this subtask
      default: [],
    },
    remindersSent: {
      type: Map,
      of: Boolean,
      default: {},
    },
    dueDateTime: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null }, // userId who last updated this subtask
    totalComments: { type: Number, default: 0 },
    comments: { type: [CommentSchema], default: [] },
  },
  { _id: true }
);

// Instance Schema (optional for cron/templates)
const InstanceSchema = new mongoose.Schema(
  {
    dueDateTime: Date,
    status: {
      type: String,
      enum: [SubtaskStatus.Pending, SubtaskStatus.Completed, "Not Done"],
      default: SubtaskStatus.Pending,
    },
    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Template Schema
const TemplateSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    recurrence: {
      type: String,
      enum: Object.values(Recurrence),
      default: Recurrence.OneTime,
    },
    defaultTimeHHMM: { type: String, default: "09:00" },
    active: { type: Boolean, default: true },
    subtasks: { type: [SubtaskSchema], default: [] },
  },
  { _id: false }
);

// Main Task Schema
const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, required: false },
    description: { type: String, default: "" },

    ownerUserId: { type: String, required: true }, // creator/owner
    createdBy: { type: String, default: null },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.Low,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.Active,
    },
    frequency: {
      type: String,
      enum: Object.values(Frequency),
      default: Frequency.Once,
    },
    // Task-level assignment for legacy support
    assignedTo: {
      type: String,
      enum: Object.values(AssignedTo),
      required: false,
    },

    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },

    template: TemplateSchema,
    instances: { type: [InstanceSchema], default: [] },
    nextDue: Date,
  },
  { timestamps: true }
);

// Recompute status/progress
TaskSchema.methods.updateProgress = function updateProgress() {
  if (!this.subtasks || this.subtasks.length === 0) {
    this.status = TaskStatus.Active;
    return;
  }

  let allCompleted = true;
  let allFinal = true; // completed or expired
  let hasExpired = false;

  for (const s of this.subtasks) {
    if (s.status === SubtaskStatus.Pending) {
      allCompleted = false;
      allFinal = false;
    } else if (s.status === SubtaskStatus.PartiallyComplete) {
      allCompleted = false;
      allFinal = false;
    } else if (s.status === SubtaskStatus.Expired) {
      allCompleted = false;
      hasExpired = true;
    }
    // SubtaskStatus.Completed doesn't change any flags (counts as completed)
  }

  if (allCompleted) this.status = TaskStatus.Completed;
  else if (allFinal && hasExpired) this.status = TaskStatus.Expired;
  else this.status = TaskStatus.Active;
};

export default mongoose.model("Task", TaskSchema);
