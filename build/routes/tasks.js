import { Router } from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
const router = Router();
/**
 * Get active tasks (home)
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const filter = { status: "Active" };
        if (ownerUserId) {
            const owner = await User.findOne({ userId: ownerUserId }).lean();
            const partnerUserId = owner?.partnerUserId;
            filter.ownerUserId = {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            };
        }
        const list = await Task.find(filter)
            .sort({ nextDue: 1, updatedAt: -1 })
            .lean();
        res.json(list);
    }
    catch (err) {
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
        const filter = { status: { $in: ["Completed", "Expired"] } };
        if (ownerUserId) {
            const owner = await User.findOne({ userId: ownerUserId }).lean();
            const partnerUserId = owner?.partnerUserId;
            filter.ownerUserId = {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            };
        }
        const list = await Task.find(filter).sort({ updatedAt: -1 }).lean();
        res.json(list);
    }
    catch (err) {
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
        const subtasks = (payload.subtasks || []).map((s) => ({
            title: s.title || "Untitled",
            dueDateTime: s.dueDateTime ? new Date(s.dueDateTime) : null,
            status: "Pending",
            updatedBy: null,
            completedAt: null,
            comments: [],
        }));
        const t = await Task.create({
            title: payload.title,
            description: payload.description || "",
            ownerUserId: payload.ownerUserId,
            createdBy: payload.createdBy || payload.ownerUserId,
            assignedTo: payload.assignedTo || "Both",
            priority: payload.priority || "Medium",
            frequency: payload.frequency || "Once",
            subtasks,
            status: "Active",
        });
        res.status(201).json(t);
    }
    catch (err) {
        console.error("Create task error:", err);
        res.status(500).json({ error: err.message || "Failed to create task" });
    }
});
/**
 * Get task by ID
 */
router.get("/task/:id", async (req, res) => {
    try {
        const t = await Task.findById(req.params.id).lean();
        if (!t)
            return res.status(404).json({ error: "Task not found" });
        res.json(t);
    }
    catch (err) {
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
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        Object.assign(task, updates);
        // if (typeof task.updateProgress === "function") task.updateProgress();
        await task.save();
        res.json(task);
    }
    catch (err) {
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
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        res.json({ message: "Task deleted successfully" });
    }
    catch (err) {
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
        const task = await Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const subtask = task.subtasks?.id(req.params.subtaskId);
        if (!subtask)
            return res.status(404).json({ error: "Subtask not found" });
        subtask.status = status;
        subtask.updatedBy = userId;
        subtask.completedAt = status === "Completed" ? new Date() : null;
        if (typeof task.updateProgress === "function")
            task.updateProgress();
        await task.save();
        res.json(task);
    }
    catch (err) {
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
        const task = await Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        task.comments = task.comments || [];
        task.comments.push({ by, text, date: new Date() });
        await task.save();
        res.json(task);
    }
    catch (err) {
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
        const task = await Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const subtask = task.subtasks?.id(req.params.subtaskId);
        if (!subtask)
            return res.status(404).json({ error: "Subtask not found" });
        subtask.comments = subtask.comments || [];
        subtask.comments.push({ text, createdBy: userId, createdAt: new Date() });
        await task.save();
        res.json(task);
    }
    catch (err) {
        console.error("Add subtask comment error:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to add subtask comment" });
    }
});
export default router;
