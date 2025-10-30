import { Router } from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { getOwnerAndPartner } from "../helper.js";
import { sendExpoPush } from "./notifications.js";
import { TaskStatus } from "../enum/task.js";
import { NotificationData } from "../enum/notification.js";

const router = Router();

/* ----------------------------- Helper Functions ---------------------------- */

const getDisplayName = async (userId: string): Promise<string> => {
  if (!userId) return "Someone";
  const user = await User.findOne({ userId }).lean();
  return user?.name?.trim() || userId;
};

const getUserDetails = async (userId: string) => {
  const user = await User.findOne({ userId }).lean();
  return user ? { name: user.name, image: user.image } : undefined;
};

const enrichCreatedByDetails = async (item: any) => {
  if (!item) return item;

  const userId = item.by || item.createdBy;
  if (!userId) return item;

  const userDetails = await getUserDetails(userId);
  if (userDetails) item.createdByDetails = userDetails;

  return item;
};

const enrichTask = async (task: any) => {
  if (!task) return task;

  let modified = false;

  const enrichComment = async (comment: any, key: "by" | "createdBy") => {
    const userId = comment[key];
    if (!userId) return comment;
    const userDetails = await getUserDetails(userId);
    if (userDetails) {
      if (
        !comment.createdByDetails ||
        comment.createdByDetails.name !== userDetails.name ||
        comment.createdByDetails.image !== userDetails.image
      ) {
        comment.createdByDetails = userDetails;
        modified = true;
      }
    }
    return comment;
  };

  // Enrich task creator
  if (task.createdBy) {
    const userDetails = await getUserDetails(task.createdBy);
    if (userDetails) {
      task.createdByDetails = userDetails;
      modified = true;
    }
  }

  // Count task comments
  if (Array.isArray(task.comments)) {
    task.totalComments = task.comments.length;
    modified = true;

    // Enrich task comments
    for (let i = 0; i < task.comments.length; i++) {
      task.comments[i] = await enrichComment(task.comments[i], "by");
    }
  }

  // Count subtask comments
  if (Array.isArray(task.subtasks)) {
    for (let i = 0; i < task.subtasks.length; i++) {
      const subtask = task.subtasks[i];
      if (Array.isArray(subtask.comments)) {
        subtask.totalComments = subtask.comments.length;
        modified = true;

        for (let j = 0; j < subtask.comments.length; j++) {
          subtask.comments[j] = await enrichComment(
            subtask.comments[j],
            "createdBy"
          );
        }
      }
    }
  }

  // Only persist if something changed
  if (modified) {
    await Task.findByIdAndUpdate(
      task._id,
      {
        $set: {
          totalComments: task.totalComments,
          subtasks: task.subtasks,
        },
      },
      { new: true }
    );
  }

  return task;
};

/* ----------------------------- Route Handlers ----------------------------- */

/** 🔹 Get active tasks */
router.get("/:ownerUserId", async (req, res) => {
  try {
    const { ownerUserId } = req.params;
    const filter: any = { status: TaskStatus.Active };

    if (ownerUserId) {
      const owner = await User.findOne({ userId: ownerUserId }).lean();
      const ids = [ownerUserId, owner?.partnerUserId].filter(Boolean);
      filter.ownerUserId = { $in: ids };
    }

    const tasks = await Task.find(filter)
      .sort({ nextDue: 1, updatedAt: -1 })
      .lean();

    const enrichedTasks = await Promise.all(
      tasks.map((t) => enrichCreatedByDetails(t))
    );

    res.json(enrichedTasks);
  } catch (err: any) {
    console.error("Error fetching active tasks:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tasks" });
  }
});

/** 🔹 Get task history with pagination */
router.get("/history/:ownerUserId", async (req, res) => {
  try {
    const { ownerUserId } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);

    const filter: any = {
      status: { $in: [TaskStatus.Completed, TaskStatus.Expired] },
    };

    if (ownerUserId) {
      const owner = await User.findOne({ userId: ownerUserId }).lean();
      const ids = [ownerUserId, owner?.partnerUserId].filter(Boolean);
      filter.ownerUserId = { $in: ids };
    }

    const totalCount = await Task.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    const tasks = await Task.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const enrichedTasks = await Promise.all(
      tasks.map((t) => enrichCreatedByDetails(t))
    );

    res.json({
      tasks: enrichedTasks,
      totalPages,
      currentPage: page,
    });
  } catch (err: any) {
    console.error("Error fetching task history:", err);
    res.status(500).json({ error: err.message || "Failed to fetch history" });
  }
});

/** 🔹 Create task */
router.post("/", async (req, res) => {
  try {
    const {
      ownerUserId,
      title,
      createdBy,
      assignedTo,
      priority,
      frequency,
      image,
      description,
      subtasks = [],
    } = req.body;

    if (!ownerUserId || !title)
      return res
        .status(400)
        .json({ error: "ownerUserId and title are required" });

    const formattedSubtasks = subtasks.map((s: any) => ({
      title: s.title || "Untitled",
      dueDateTime: s.dueDateTime ? new Date(s.dueDateTime) : null,
      status: "Pending",
      updatedBy: null,
      completedAt: null,
      comments: [],
    }));

    const { owner, partner } = await getOwnerAndPartner(createdBy);
    const task = await Task.create({
      title,
      image: image || "",
      description: description || "",
      ownerUserId,
      createdBy: createdBy || ownerUserId,
      assignedTo: assignedTo || "Both",
      priority: priority || "Medium",
      frequency: frequency || "Once",
      subtasks: formattedSubtasks,
      status: TaskStatus.Active,
    });

    const creatorName = await getDisplayName(task.createdBy);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()}`,
        `${creatorName} created a new task ${
          task.assignedTo !== "Me" ? "for you" : ""
        }`,
        {
          type: NotificationData.Task,
          taskId: task._id,
          isActive: true,
          image: task.image ?? undefined,
        },
        [partner.userId],
        String(task._id)
      );
    }

    res.status(201).json(task);
  } catch (err: any) {
    console.error("Create task error:", err);
    res.status(500).json({ error: err.message || "Failed to create task" });
  }
});

/** 🔹 Get task by ID */
router.get("/task/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });

    const enriched = await enrichTask(task);
    res.json(enriched);
  } catch (err: any) {
    console.error("Get task error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch task" });
  }
});

/** 🔹 Update task */
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    Object.assign(task, updates);
    await task.save();

    const { owner, partner } = await getOwnerAndPartner(task.createdBy);
    const updaterName = await getDisplayName(updates?.subtasks?.[0]?.updatedBy);

    const token = partner?.notificationToken || owner?.notificationToken;
    const targetId = partner?.userId ?? owner?.userId;

    if (token) {
      await sendExpoPush(
        [token],
        `Task: ${task.title.trim()}`,
        `${updaterName} updated this task`,
        {
          type: NotificationData.Task,
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
          image: task.image ?? undefined,
        },
        [targetId ?? ""],
        String(task._id)
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Update task error:", err);
    res.status(500).json({ error: err.message || "Failed to update task" });
  }
});

/** 🔹 Delete task */
router.delete("/:id", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const { owner, partner } = await getOwnerAndPartner(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()}`,
        `${owner?.name?.trim()} deleted this task!`,
        { type: NotificationData.Task, image: task.image ?? undefined },
        [partner.userId],
        String(task._id)
      );
    }

    res.json({ message: "Task deleted successfully" });
  } catch (err: any) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: err.message || "Failed to delete task" });
  }
});

/** 🔹 Update subtask status */
router.patch("/:id/subtask/:subtaskId/status", async (req, res) => {
  try {
    const { userId, status } = req.body;
    if (!userId || !["Pending", "Completed"].includes(status))
      return res.status(400).json({ error: "Invalid userId or status" });

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
        [partner.notificationToken],
        `Task: ${task.title.trim()}`,
        `${actorName} ${status === "Completed" ? "completed" : "reopened"} "${
          subtask.title
        }"`,
        {
          type: NotificationData.Task,
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
          image: task.image ?? undefined,
        },
        [partner.userId],
        String(task._id)
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Update subtask status error:", err);
    res.status(500).json({ error: err.message || "Failed to update subtask" });
  }
});

/** 🔹 Add task-level comment */
router.post("/:id/comment", async (req, res) => {
  try {
    const { by, text } = req.body;
    if (!by || !text)
      return res.status(400).json({ error: "by and text required" });

    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const now = Date.now();
    const lastComment = [...(task.comments || [])]
      .reverse()
      .find((c) => c.by?.toString() === by);

    const recent = lastComment?.createdAt
      ? now - new Date(lastComment.createdAt).getTime() < 20000
      : false;

    task.comments.push({ by, text, createdAt: new Date() });
    await task.save();

    if (recent)
      return res.json({ task, message: "Comment added (no notification)" });

    const { owner, partner } = await getOwnerAndPartner(by);
    const commenterName = await getDisplayName(by);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()} 💬`,
        `${commenterName} commented: "${text}"`,
        {
          type: NotificationData.Task,
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
          image: task.image ?? undefined,
          isComment: true,
        },
        [partner.userId],
        String(task._id)
      );
    }

    res.json(task);
  } catch (err: any) {
    console.error("Add comment error:", err);
    res.status(500).json({ error: err.message || "Failed to add comment" });
  }
});

/** 🔹 Add subtask comment */
router.post("/:id/subtask/:subtaskId/comment", async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text)
      return res.status(400).json({ error: "userId and text required" });

    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const subtask = task.subtasks?.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    const now = Date.now();
    const lastComment = [...(subtask.comments || [])]
      .reverse()
      .find((c) => c.createdBy?.toString() === userId);

    const recent = lastComment?.createdAt
      ? now - new Date(lastComment.createdAt).getTime() < 20000
      : false;

    subtask.comments.push({ text, createdBy: userId, createdAt: new Date() });
    await task.save();

    if (recent)
      return res.json({
        task,
        message: "Subtask comment added (no notification)",
      });

    const { owner, partner } = await getOwnerAndPartner(userId);
    const commenterName = await getDisplayName(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Task: ${task.title.trim()} 💬`,
        `${commenterName} commented on "${subtask.title}": "${text}"`,
        {
          type: NotificationData.Task,
          taskId: task._id,
          isActive: task.status === TaskStatus.Active,
          image: task.image ?? undefined,
          isComment: true,
          commentSubtaskId: subtask._id,
        },
        [partner.userId],
        String(task._id)
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

/** 🔹 task comments */
router.get("/:taskId/comments", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId, "comments").lean();
    if (!task) return res.status(404).json({ error: "Task not found" });

    // Enrich with user details only for the comments
    const enrichedComments = await Promise.all(
      (task.comments || []).map(async (comment) => ({
        ...comment,
        createdByDetails: await getUserDetails(comment.by),
      }))
    );

    res.json(enrichedComments);
  } catch (err: any) {
    console.error("Error fetching task comments:", err);
    res.status(500).json({ error: err.message || "Failed to fetch comments" });
  }
});

/** 🔹 subtask comments */
router.get("/:taskId/subtask/:subtaskId/comments", async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const task = await Task.findById(taskId, "subtasks").lean();
    if (!task) return res.status(404).json({ error: "Task not found" });

    const subtask = task.subtasks?.find(
      (st) => st._id.toString() === subtaskId
    );
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    // Enrich subtask comments with user details
    const enrichedComments = await Promise.all(
      (subtask.comments || []).map(async (comment) => ({
        ...comment,
        createdByDetails: await getUserDetails(comment.createdBy),
      }))
    );

    res.json(enrichedComments);
  } catch (err: any) {
    console.error("Error fetching subtask comments:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch subtask comments" });
  }
});

export default router;
