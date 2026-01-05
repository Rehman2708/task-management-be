import { Router } from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { getOwnerAndPartner } from "../helper.js";
import { sendExpoPush } from "./notifications.js";
import { TaskStatus } from "../enum/task.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
import { deleteFromS3 } from "./uploads.js";
const router = Router();
/* ----------------------------- Helper Functions ---------------------------- */
const sortSubtasksByDueTime = (subtasks) => {
    if (!Array.isArray(subtasks))
        return subtasks;
    return [...subtasks].sort((a, b) => {
        // Handle null/undefined due dates - put them at the end
        if (!a.dueDateTime && !b.dueDateTime)
            return 0;
        if (!a.dueDateTime)
            return 1;
        if (!b.dueDateTime)
            return -1;
        // Sort by due date/time ascending (earliest first)
        return (new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime());
    });
};
const getDisplayName = async (userId) => {
    if (!userId)
        return "Someone";
    const user = await User.findOne({ userId }).lean();
    return user?.name?.trim() || userId;
};
const getUserDetails = async (userId) => {
    const user = await User.findOne({ userId }).lean();
    return user ? { name: user.name, image: user.image } : undefined;
};
const enrichCreatedByDetails = async (item) => {
    if (!item)
        return item;
    const userId = item.by || item.createdBy;
    if (!userId)
        return item;
    const userDetails = await getUserDetails(userId);
    if (userDetails)
        item.createdByDetails = userDetails;
    return item;
};
const enrichTask = async (task) => {
    if (!task)
        return task;
    let modified = false;
    const enrichComment = async (comment, key) => {
        return comment;
        // const userId = comment[key];
        // if (!userId) return comment;
        // const userDetails = await getUserDetails(userId);
        // if (userDetails) {
        //   if (
        //     !comment.createdByDetails ||
        //     comment.createdByDetails.name !== userDetails.name ||
        //     comment.createdByDetails.image !== userDetails.image
        //   ) {
        //     comment.createdByDetails = userDetails;
        //     modified = true;
        //   }
        // }
        // return comment;
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
    // Count subtask comments and sort subtasks by due time
    if (Array.isArray(task.subtasks)) {
        // Sort subtasks by due time
        task.subtasks = sortSubtasksByDueTime(task.subtasks);
        for (let i = 0; i < task.subtasks.length; i++) {
            const subtask = task.subtasks[i];
            if (Array.isArray(subtask.comments)) {
                subtask.totalComments = subtask.comments.length;
                modified = true;
                for (let j = 0; j < subtask.comments.length; j++) {
                    subtask.comments[j] = await enrichComment(subtask.comments[j], "createdBy");
                }
            }
        }
    }
    // Only persist if something changed
    if (modified) {
        await Task.findByIdAndUpdate(task._id, {
            $set: {
                totalComments: task.totalComments,
                subtasks: task.subtasks,
            },
        }, { new: true });
    }
    return task;
};
/* ----------------------------- Route Handlers ----------------------------- */
/** 🔹 Get active tasks */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const filter = { status: TaskStatus.Active };
        if (ownerUserId) {
            const owner = await User.findOne({ userId: ownerUserId }).lean();
            const ids = [ownerUserId, owner?.partnerUserId].filter(Boolean);
            filter.ownerUserId = { $in: ids };
        }
        const tasks = await Task.find(filter)
            .sort({ nextDue: 1, createdAt: -1 })
            .lean();
        const enrichedTasks = await Promise.all(tasks.map((t) => {
            t.totalComments = t.comments.length;
            // Sort subtasks by due time when retrieving (lean objects allow direct assignment)
            if (t.subtasks && Array.isArray(t.subtasks)) {
                t.subtasks = sortSubtasksByDueTime(t.subtasks);
            }
            return enrichCreatedByDetails(t);
        }));
        res.json(enrichedTasks);
    }
    catch (err) {
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
        const filter = {
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
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();
        const enrichedTasks = await Promise.all(tasks.map((t) => {
            t.totalComments = t.comments.length;
            // Sort subtasks by due time when retrieving (lean objects allow direct assignment)
            if (t.subtasks && Array.isArray(t.subtasks)) {
                t.subtasks = sortSubtasksByDueTime(t.subtasks);
            }
            return enrichCreatedByDetails(t);
        }));
        res.json({
            tasks: enrichedTasks,
            totalPages,
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching task history:", err);
        res.status(500).json({ error: err.message || "Failed to fetch history" });
    }
});
/** 🔹 Create task */
router.post("/", async (req, res) => {
    try {
        const { ownerUserId, title, createdBy, priority, frequency, image, description, subtasks = [], } = req.body;
        if (!ownerUserId || !title)
            return res
                .status(400)
                .json({ error: "ownerUserId and title are required" });
        const formattedSubtasks = subtasks.map((s) => ({
            title: s.title || "Untitled",
            dueDateTime: s.dueDateTime ? new Date(s.dueDateTime) : null,
            status: "Pending",
            assignedTo: s.assignedTo || "Both", // Each subtask must have assignment
            updatedBy: null,
            completedAt: null,
            comments: [],
        }));
        // Sort subtasks by due time
        const sortedSubtasks = sortSubtasksByDueTime(formattedSubtasks);
        const { partner } = await getOwnerAndPartner(createdBy);
        const task = await Task.create({
            title,
            image: image || "",
            description: description || "",
            ownerUserId,
            createdBy: createdBy || ownerUserId,
            priority: priority || "Medium",
            frequency: frequency || "Once",
            subtasks: sortedSubtasks,
            status: TaskStatus.Active,
        });
        const creatorName = await getDisplayName(task.createdBy);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Task.Created, {
                taskTitle: task.title.trim(),
                creatorName,
                forYou: "for you",
            }, {
                type: NotificationData.Task,
                taskId: task._id,
                isActive: true,
                image: task.image ?? undefined,
            }, [partner.userId], String(task._id));
        }
        res.status(201).json(task);
    }
    catch (err) {
        console.error("Create task error:", err);
        res.status(500).json({ error: err.message || "Failed to create task" });
    }
});
/** 🔹 Get task by ID */
router.get("/task/:id", async (req, res) => {
    try {
        const task = await Task.findById(req.params.id).lean();
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        // Sort subtasks by due time (lean objects allow direct assignment)
        if (task.subtasks && Array.isArray(task.subtasks)) {
            task.subtasks = sortSubtasksByDueTime(task.subtasks);
        }
        const enriched = await enrichTask(task);
        res.json(enriched);
    }
    catch (err) {
        console.error("Get task error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch task" });
    }
});
/** 🔹 Update task */
router.put("/:id", async (req, res) => {
    try {
        const updates = req.body;
        const task = await Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        // If subtasks are being updated, sort them by due time
        if (updates.subtasks && Array.isArray(updates.subtasks)) {
            updates.subtasks = sortSubtasksByDueTime(updates.subtasks);
        }
        Object.assign(task, updates);
        await task.save();
        const { partner } = await getOwnerAndPartner(task.createdBy);
        const updaterName = await getDisplayName(updates?.subtasks?.[0]?.updatedBy);
        const token = partner?.notificationToken;
        const targetId = partner?.userId;
        if (token) {
            await sendExpoPush([token], NotificationMessages.Task.Updated, { taskTitle: task.title.trim(), updaterName }, {
                type: NotificationData.Task,
                taskId: task._id,
                isActive: task.status === TaskStatus.Active,
                image: task.image ?? undefined,
            }, [targetId ?? ""], String(task._id));
        }
        res.json(task);
    }
    catch (err) {
        console.error("Update task error:", err);
        res.status(500).json({ error: err.message || "Failed to update task" });
    }
});
/** 🔹 Delete task */
router.delete("/:id", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: "userId is required" });
        const task = await Task.findByIdAndDelete(req.params.id);
        if (task?.image) {
            await deleteFromS3(task.image);
        }
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const { partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Task.Deleted, { taskTitle: task.title.trim(), ownerName: "" }, { type: NotificationData.Task, image: task.image ?? undefined }, [partner.userId], String(task._id));
        }
        res.json({ message: "Task deleted successfully" });
    }
    catch (err) {
        console.error("Delete task error:", err);
        res.status(500).json({ error: err.message || "Failed to delete task" });
    }
});
/** 🔹 Update subtask status */
router.patch("/:id/subtask/:subtaskId/status", async (req, res) => {
    try {
        const { userId, status } = req.body;
        // Input validation
        if (!userId || typeof userId !== "string") {
            return res.status(400).json({ error: "Valid userId is required" });
        }
        if (!["Pending", "Completed"].includes(status)) {
            return res
                .status(400)
                .json({ error: "Status must be 'Pending' or 'Completed'" });
        }
        // Use findOneAndUpdate for atomic operation to prevent race conditions
        const task = await Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const subtask = task.subtasks?.id(req.params.subtaskId);
        if (!subtask)
            return res.status(404).json({ error: "Subtask not found" });
        // Check if user is authorized to update this subtask
        const { owner: taskOwner, partner: taskPartner } = await getOwnerAndPartner(task.ownerUserId);
        if (!taskOwner) {
            return res.status(404).json({ error: "Task owner not found" });
        }
        // Check if current user is either the task owner or their partner
        const isTaskOwner = userId === task.ownerUserId;
        const isTaskPartner = taskPartner && userId === taskPartner.userId;
        if (!isTaskOwner && !isTaskPartner) {
            return res
                .status(403)
                .json({ error: "Not authorized to update this subtask" });
        }
        // Check subtask assignment permissions
        // Use subtask assignment if it exists, otherwise fall back to task assignment
        const effectiveAssignment = subtask.assignedTo || task.assignedTo;
        if (effectiveAssignment === "Me" && !isTaskOwner) {
            return res
                .status(403)
                .json({ error: "This subtask is assigned to the task owner only" });
        }
        if (effectiveAssignment === "Partner" && !isTaskPartner) {
            return res
                .status(403)
                .json({ error: "This subtask is assigned to the partner only" });
        }
        // Validate "Both" assignment when no partner exists
        if (effectiveAssignment === "Both" && !taskPartner) {
            return res.status(400).json({
                error: "Cannot complete 'Both' assigned subtask: No partner found. Please add a partner first or change assignment to 'Me'.",
            });
        }
        // Handle completion logic based on assignment type
        if (status === "Completed") {
            if (effectiveAssignment === "Both") {
                // For "Both" assignments, track individual completions
                if (!subtask.completedBy)
                    subtask.completedBy = [];
                // Add user to completedBy if not already there
                if (!subtask.completedBy.includes(userId)) {
                    subtask.completedBy.push(userId);
                }
                // Check if both partners have completed
                const ownerCompleted = subtask.completedBy.includes(task.ownerUserId);
                const partnerCompleted = taskPartner && subtask.completedBy.includes(taskPartner.userId);
                // Both partners must complete for "Both" assignments (no single-user completion)
                if (ownerCompleted && partnerCompleted) {
                    subtask.status = "Completed";
                    subtask.completedAt = new Date();
                }
                else {
                    subtask.status = "PartiallyComplete";
                    subtask.completedAt = null; // Keep null until fully completed
                }
            }
            else {
                // For "Me" or "Partner" assignments, complete immediately
                subtask.status = "Completed";
                subtask.completedAt = new Date();
                if (!subtask.completedBy)
                    subtask.completedBy = [];
                if (!subtask.completedBy.includes(userId)) {
                    subtask.completedBy.push(userId);
                }
            }
        }
        else if (status === "Pending") {
            // Handle reopening subtask
            if (effectiveAssignment === "Both") {
                // Remove user from completedBy array
                if (subtask.completedBy) {
                    subtask.completedBy = subtask.completedBy.filter((id) => id !== userId);
                }
                // Update status based on remaining completions
                if (subtask.completedBy && subtask.completedBy.length > 0) {
                    subtask.status = "PartiallyComplete";
                }
                else {
                    subtask.status = "Pending";
                }
                subtask.completedAt = null;
            }
            else {
                // For "Me" or "Partner" assignments, reopen completely
                subtask.status = "Pending";
                subtask.completedAt = null;
                subtask.completedBy = [];
            }
        }
        subtask.updatedBy = userId;
        // Update task status based on all subtasks
        if (typeof task.updateProgress === "function") {
            task.updateProgress();
        }
        await task.save();
        // Send notification to the other person (not the one who updated)
        const notifyUser = isTaskOwner ? taskPartner : taskOwner;
        const actorName = await getDisplayName(userId);
        if (notifyUser?.notificationToken) {
            let notificationMessage;
            let messageData;
            if (status === "Completed") {
                if (effectiveAssignment === "Both") {
                    if (subtask.status === "Completed") {
                        // Both completed - task is fully done
                        notificationMessage =
                            NotificationMessages.Task.SubtaskStatusChanged;
                        messageData = {
                            taskTitle: task.title.trim(),
                            actorName,
                            status: "fully completed",
                            subtaskTitle: subtask.title,
                        };
                    }
                    else {
                        // Partially completed - notify partner it's their turn
                        notificationMessage =
                            NotificationMessages.Task.SubtaskStatusChanged;
                        messageData = {
                            taskTitle: task.title.trim(),
                            actorName,
                            status: "partially completed - your turn",
                            subtaskTitle: subtask.title,
                        };
                    }
                }
                else {
                    // Regular completion for Me/Partner assignments
                    notificationMessage = NotificationMessages.Task.SubtaskStatusChanged;
                    messageData = {
                        taskTitle: task.title.trim(),
                        actorName,
                        status: "completed",
                        subtaskTitle: subtask.title,
                    };
                }
            }
            else {
                // Reopened
                notificationMessage = NotificationMessages.Task.SubtaskStatusChanged;
                messageData = {
                    taskTitle: task.title.trim(),
                    actorName,
                    status: "reopened",
                    subtaskTitle: subtask.title,
                };
            }
            await sendExpoPush([notifyUser.notificationToken], notificationMessage, messageData, {
                type: NotificationData.Task,
                taskId: task._id,
                isActive: task.status === TaskStatus.Active,
                image: task.image ?? undefined,
            }, [notifyUser.userId], String(task._id));
        }
        res.json(task);
    }
    catch (err) {
        console.error("Update subtask status error:", err);
        res.status(500).json({ error: err.message || "Failed to update subtask" });
    }
});
/** 🔹 Add task-level comment - OPTIMIZED */
router.post("/:id/comment", async (req, res) => {
    try {
        const { by, text, image } = req.body;
        if (!by && (!text || !image))
            return res
                .status(400)
                .json({ error: "by and text or image are required" });
        const newComment = { by, text, createdAt: new Date(), image };
        // Use findByIdAndUpdate for atomic operation - faster than find + save
        const task = await Task.findByIdAndUpdate(req.params.id, {
            $push: { comments: newComment },
            $inc: { totalComments: 1 },
        }, { new: true, select: "comments title status image _id" } // Only select needed fields
        );
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        // Send response immediately - don't wait for notifications
        res.json(task);
        // Handle notifications asynchronously (fire and forget)
        setImmediate(async () => {
            try {
                const { partner } = await getOwnerAndPartner(by);
                const commenterName = await getDisplayName(by);
                if (partner?.notificationToken) {
                    await sendExpoPush([partner.notificationToken], NotificationMessages.Task.Comment, { taskTitle: task.title.trim(), commenterName, text }, {
                        type: NotificationData.Task,
                        taskId: task._id,
                        isActive: task.status === TaskStatus.Active,
                        image: image ?? task.image ?? undefined,
                        isComment: true,
                    }, [partner.userId], String(task._id));
                }
            }
            catch (notifErr) {
                console.error("Notification error:", notifErr);
            }
        });
    }
    catch (err) {
        console.error("Add comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
});
/** 🔹 Add subtask comment - OPTIMIZED */
router.post("/:id/subtask/:subtaskId/comment", async (req, res) => {
    try {
        const { userId, text, image } = req.body;
        if (!userId && (!text || !image))
            return res
                .status(400)
                .json({ error: "userId and text or image required" });
        const newComment = {
            text,
            createdBy: userId,
            createdAt: new Date(),
            image,
        };
        // Use atomic update for better performance
        const task = await Task.findOneAndUpdate({
            _id: req.params.id,
            "subtasks._id": req.params.subtaskId,
        }, {
            $push: { "subtasks.$.comments": newComment },
            $inc: { "subtasks.$.totalComments": 1 },
        }, {
            new: true,
            select: "subtasks title status image _id", // Only select needed fields
        });
        if (!task)
            return res.status(404).json({ error: "Task or subtask not found" });
        const subtask = task.subtasks?.id(req.params.subtaskId);
        if (!subtask)
            return res.status(404).json({ error: "Subtask not found" });
        // Send response immediately
        res.json(task);
        // Handle notifications asynchronously (fire and forget)
        setImmediate(async () => {
            try {
                const { partner } = await getOwnerAndPartner(userId);
                const commenterName = await getDisplayName(userId);
                if (partner?.notificationToken) {
                    await sendExpoPush([partner.notificationToken], NotificationMessages.Task.SubtaskComment, {
                        taskTitle: task.title.trim(),
                        commenterName,
                        subtaskTitle: subtask.title,
                        text,
                    }, {
                        type: NotificationData.Task,
                        taskId: task._id,
                        isActive: task.status === TaskStatus.Active,
                        image: task.image ?? undefined,
                        isComment: true,
                        commentSubtaskId: subtask._id,
                    }, [partner.userId], String(task._id));
                }
            }
            catch (notifErr) {
                console.error("Notification error:", notifErr);
            }
        });
    }
    catch (err) {
        console.error("Add subtask comment error:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to add subtask comment" });
    }
});
/** 🔹 task comments - OPTIMIZED */
router.get("/:taskId/comments", async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findById(taskId)
            .select("comments totalComments")
            .lean();
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        // Set cache headers for better performance
        res.set({
            "Cache-Control": "private, max-age=30", // Cache for 30 seconds
            ETag: `"${taskId}-${task.comments?.length || 0}"`,
        });
        // Enrich with user details only for the comments
        const enrichedComments = await Promise.all((task.comments || []).map(async (comment) => ({
            ...comment,
            createdByDetails: await getUserDetails(comment.by ?? ""),
        })));
        res.json(enrichedComments);
    }
    catch (err) {
        console.error("Error fetching task comments:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
});
/** 🔹 subtask comments - OPTIMIZED */
router.get("/:taskId/subtask/:subtaskId/comments", async (req, res) => {
    try {
        const { taskId, subtaskId } = req.params;
        const task = await Task.findById(taskId).select("subtasks").lean();
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const subtask = task.subtasks?.find((st) => st._id.toString() === subtaskId);
        if (!subtask)
            return res.status(404).json({ error: "Subtask not found" });
        // Set cache headers for better performance
        res.set({
            "Cache-Control": "private, max-age=30", // Cache for 30 seconds
            ETag: `"${taskId}-${subtaskId}-${subtask.comments?.length || 0}"`,
        });
        // Enrich subtask comments with user details
        const enrichedComments = await Promise.all((subtask.comments || []).map(async (comment) => ({
            ...comment,
            createdByDetails: await getUserDetails(comment.createdBy ?? ""),
        })));
        res.json(enrichedComments);
    }
    catch (err) {
        console.error("Error fetching subtask comments:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to fetch subtask comments" });
    }
});
export default router;
