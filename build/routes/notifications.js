import { Router } from "express";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";
export async function sendExpoPush(expoTokens = [], title, body, data = {}, toUserIds = [], groupId // 🔥 new param: group notifications by this ID (e.g. taskId)
) {
    if (!expoTokens.length)
        return;
    const messages = expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data,
        // Grouping info
        ios: groupId
            ? {
                threadId: groupId, // iOS grouping
            }
            : undefined,
        android: {
            channelId: data.type,
            ...(groupId ? { group: groupId } : {}),
        },
    }));
    // Send notifications to Expo
    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
    });
    // Save to DB (so you can fetch later)
    if (title && body && toUserIds.length) {
        await Notification.create({
            title,
            body,
            data,
            toUserIds,
            ...(groupId ? { groupId } : {}), // store groupId for future use
        });
    }
}
const router = Router();
/**
 * GET /notifications/:userId?page=1&pageSize=10
 */
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const pageSize = Math.max(parseInt(req.query.pageSize) || 10, 1);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        // Delete notifications older than 14 days
        await Notification.deleteMany({ createdAt: { $lt: fourteenDaysAgo } });
        const filter = { toUserIds: userId };
        const totalCount = await Notification.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();
        const formatted = notifications.map((n) => ({
            ...n,
            isRead: n.readBy?.includes(userId),
        }));
        res.json({
            notifications: formatted,
            totalPages,
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching notifications:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to fetch notifications" });
    }
});
/**
 * PATCH /notifications/mark-read
 * Body: { userId: string, notificationIds: string[] }
 */
router.patch("/mark-read", async (req, res) => {
    try {
        const { userId, notificationIds } = req.body;
        if (!userId || !Array.isArray(notificationIds))
            return res
                .status(400)
                .json({ error: "userId and notificationIds array required" });
        await Notification.updateMany({ _id: { $in: notificationIds } }, { $addToSet: { readBy: userId } });
        res.json({ message: "Notifications marked as read" });
    }
    catch (err) {
        console.error("Error marking notifications as read:", err);
        res.status(500).json({ error: err.message || "Failed to mark as read" });
    }
});
export default router;
