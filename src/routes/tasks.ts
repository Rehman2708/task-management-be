import { Router } from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { getOwnerAndPartner } from "../helper.js";
import { sendExpoPush } from "./notifications.js";
import { TaskStatus } from "../enum/task.js";

const router = Router();

/**
 * Utility: resolve display name
 */
async function getDisplayName(userId: string): Promise<string> {
  if (!userId) return "Someone";
  const u = await User.findOne({ userId }).lean();
  return u?.name?.trim() || userId;
}

/**
 * Utility: refresh createdByDetails on comments/subtask comments
 */
async function enrichCreatedByDetails(item: any) {
  if (!item) return item;
  const userId = item.by || item.createdBy;
  if (!userId) return item;

  const user = await User.findOne({ userId }).lean();
  if (!user) return item;

  item.createdByDetails = {
    name: user.name,
    image: user?.image,
  };

  return item;
}

/**
 * Utility: refresh all comments of a task
 */
/**
 * Utility: refresh task + comments/subtask comments
 */
async function enrichTask(task: any) {
  if (!task) return task;

  // Refresh task.createdByDetails
  if (task.createdBy) {
    const user = await User.findOne({ userId: task.createdBy }).lean();
    if (user) {
      task.createdByDetails = {
        name: user.name,
        image: user.image,
      };
    }
  }

  // Refresh task.comments
  if (Array.isArray(task.comments)) {
    task.comments = await Promise.all(
      task.comments.map(enrichCreatedByDetails)
    );
  }

  // Refresh subtasks.comments
  if (Array.isArray(task.subtasks)) {
    for (const subtask of task.subtasks) {
      if (Array.isArray(subtask.comments)) {
        subtask.comments = await Promise.all(
          subtask.comments.map(enrichCreatedByDetails)
        );
      }
    }
  }

  return task;
}

/**
 * Get active tasks
 */
router.get("/:ownerUserId", async (req, res) => {
  try {
    const { ownerUserId } = req.params;
    const filter: any = { status: "Active" };

    if (ownerUserId) {
      const owner = await User.findOne({ userId: ownerUserId }).lean();
      const partnerUserId = owner?.partnerUserId;
      filter.ownerUserId = {
        $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
      };
    }

    let list = await Task.find(filter)
      .sort({ nextDue: 1, updatedAt: -1 })
      .lean();

    list = await Promise.all(list.map(enrichTask));

    res.json(list);
  } catch (err: any) {
    console.error("Error fetching active tasks:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tasks" });
  }
});

/**
 * Get task history
 */
router.get("/history/:ownerUserId", async (req, res) => {
  try {
    const { ownerUserId } = req.params;

    const filter: any = { status: { $in: ["Completed", "Expired"] } };

    if (ownerUserId) {
      const owner = await User.findOne({ userId: ownerUserId }).lean();
      const partnerUserId = owner?.partnerUserId;
      filter.ownerUserId = {
        $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
      };
    }

    let list = await Task.find(filter).sort({ updatedAt: -1 }).lean();
    list = await Promise.all(list.map(enrichTask));

    res.json(list);
  } catch (err: any) {
    console.error("Error fetching task history:", err);
    res.status(500).json({ error: err.message || "Failed to fetch history" });
  }
});

/**
 * Create task
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.ownerUserId)
      return res.status(400).json({ error: "ownerUserId is required" });
    if (!payload.title)
      return res.status(400).json({ error: "title is required" });

    const subtasks = (payload.subtasks || []).map((s: any) => ({
      title: s.title || "Untitled",
      dueDateTime: s.dueDateTime ? new Date(s.dueDateTime) : null,
      status: "Pending",
      updatedBy: null,
      completedAt: null,
      comments: [],
    }));

    const { owner, partner } = await getOwnerAndPartner(payload.createdBy);
    const t = await Task.create({
      title: payload.title,
      image: payload.image || "",
      description: payload.description || "",
      ownerUserId: payload.ownerUserId,
      createdBy: payload.createdBy || payload.ownerUserId,
      assignedTo: payload.assignedTo || "Both",
      priority: payload.priority || "Medium",
      frequency: payload.frequency || "Once",
      subtasks,
      status: "Active",
    });

    const creatorName = await getDisplayName(t.createdBy);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${t.title.trim()}`,
        `${creatorName} created a new task ${
          t.assignedTo !== "Me" ? "for you" : ""
        }`,
        {
          type: "task",
          taskId: t._id,
          isActive: t.status === TaskStatus.Active,
        }
      );
    }

    res.status(201).json(t);
  } catch (err: any) {
    console.error("Create task error:", err);
    res.status(500).json({ error: err.message || "Failed to create task" });
  }
});

/**
 * Get task by ID
 */
router.get("/task/:id", async (req, res) => {
  try {
    let t: any = await Task.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: "Task not found" });

    t = await enrichTask(t);

    res.json(t);
  } catch (err: any) {
    console.error("Get task error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch task" });
  }
});

/**
 * Update task
 */
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    Object.assign(task, updates);
    await task.save();

    const { owner, partner } = await getOwnerAndPartner(task.createdBy);
    const updaterName = await getDisplayName(updates.updatedBy);

    if (owner?.notificationToken || partner?.notificationToken) {
      await sendExpoPush(
        partner?.notificationToken
          ? [partner.notificationToken, owner.notificationToken!]
          : [owner.notificationToken!],
        `Task: ${task.title.trim()}`,
        `${updaterName} updated this task`,
        {
          type: "task",
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
        }
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Update task error:", err);
    res.status(500).json({ error: err.message || "Failed to update task" });
  }
});

/**
 * Delete task
 */
router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ message: "Task deleted successfully" });
  } catch (err: any) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: err.message || "Failed to delete task" });
  }
});

/**
 * Update subtask status
 */
router.patch("/:id/subtask/:subtaskId/status", async (req, res) => {
  try {
    const { userId, status } = req.body || {};
    if (!userId || !status)
      return res.status(400).json({ error: "userId and status required" });
    if (!["Pending", "Completed"].includes(status))
      return res
        .status(400)
        .json({ error: "Status must be Pending or Completed" });

    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const subtask = task.subtasks?.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    subtask.status = status;
    subtask.updatedBy = userId;
    subtask.completedAt = status === "Completed" ? new Date() : null;

    if (typeof task.updateProgress === "function") task.updateProgress();
    await task.save();

    const { owner, partner } = await getOwnerAndPartner(userId);
    const actorName = await getDisplayName(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner?.notificationToken!],
        `Task: ${task.title.trim()}`,
        `${actorName} ${status === "Completed" ? "completed" : "reopened"} "${
          subtask.title
        }"`,
        {
          type: "task",
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
        }
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Update subtask status error:", err);
    res.status(500).json({ error: err.message || "Failed to update subtask" });
  }
});

/**
 * Add task-level comment
 */
router.post("/:id/comment", async (req, res) => {
  try {
    const { by, text } = req.body || {};
    if (!by || !text)
      return res.status(400).json({ error: "by and text required" });

    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const { owner, partner } = await getOwnerAndPartner(by);
    task.comments = task.comments || [];
    task.comments.push({
      by,
      text,
    });

    await task.save();

    const commenterName = await getDisplayName(by);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()} 💬`,
        `${commenterName} commented: "${text}"`,
        {
          type: "task",
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
        }
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Add comment error:", err);
    res.status(500).json({ error: err.message || "Failed to add comment" });
  }
});

/**
 * Add subtask comment
 */
router.post("/:id/subtask/:subtaskId/comment", async (req, res) => {
  try {
    const { userId, text } = req.body || {};
    if (!userId || !text)
      return res.status(400).json({ error: "userId and text required" });

    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const subtask = task.subtasks?.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });
    const { owner, partner } = await getOwnerAndPartner(userId);
    subtask.comments = subtask.comments || [];
    subtask.comments.push({
      text,
      createdBy: userId,
      createdAt: new Date(),
    });

    await task.save();

    const commenterName = await getDisplayName(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()} 💬`,
        `${commenterName} commented on "${subtask.title}": "${text}"`,
        {
          type: "task",
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
        }
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Add subtask comment error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to add subtask comment" });
  }
});

export default router;
