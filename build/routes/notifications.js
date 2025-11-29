import { Router } from "express";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";
export async function sendExpoPush(expoTokens = [], message, messageProps, data = {}, toUserIds = [], groupId) {
    if (!expoTokens.length)
        return;
    // Resolve title and body
    let title;
    let body;
    if (typeof message === "function") {
        const result = message(messageProps);
        title = result.title;
        body = result.body;
    }
    else {
        title = message;
        body = messageProps; // if passing string directly
    }
    const messages = expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data,
        ios: data.type ? { threadId: data.type } : undefined,
        android: {
            channelId: data.type,
            ...(data.type ? { group: data.type } : {}),
        },
        richContent: { image: data.image, video: data?.videoData?.url },
    }));
    try {
        // Send push
        await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messages),
        });
        if (title && body && toUserIds.length) {
            await Notification.create({
                title,
                body,
                data,
                toUserIds,
                ...(groupId ? { groupId } : {}),
            });
        }
    }
    catch (err) {
        console.error("Error sending Expo push:", err);
    }
}
const router = Router();
/**
 * GET /notifications/:userId?page=1&pageSize=10
 */
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
        // Delete notifications older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 4);
        const deleted = await Notification.deleteMany({
            createdAt: { $lt: cutoffDate },
        });
        console.log(`Deleted ${deleted.deletedCount} old notifications`);
        const filter = { toUserIds: userId };
        const totalCount = await Notification.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);
        // Fetch notifications (unread first, then newest first)
        const notifications = await Notification.aggregate([
            { $match: filter },
            {
                $addFields: {
                    isRead: { $in: [userId, "$readBy"] },
                },
            },
            {
                $sort: {
                    isRead: 1, // unread first
                    createdAt: -1,
                },
            },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
        ]);
        // Send response first
        res.json({
            notifications,
            totalPages,
            currentPage: page,
        });
        // Then, asynchronously mark fetched notifications as read
        // const notificationIds = notifications.map((n) => n._id);
        // if (notificationIds.length > 0) {
        //   Notification.updateMany(
        //     { _id: { $in: notificationIds }, readBy: { $ne: userId } },
        //     { $addToSet: { readBy: userId } }
        //   ).catch((err) =>
        //     console.error("Error marking notifications as read:", err)
        //   );
        // }
    }
    catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({
            error: err.message || "Failed to fetch notifications",
        });
    }
});
/**
 * PATCH /notifications/mark-read
 * Body: { userId: string, notificationIds: string[] }
 */
router.patch("/mark-read", async (req, res) => {
    try {
        const { userId, notificationIds } = req.body || {};
        if (!userId || !Array.isArray(notificationIds)) {
            return res
                .status(400)
                .json({ error: "userId and notificationIds array required" });
        }
        await Notification.updateMany({ _id: { $in: notificationIds } }, { $addToSet: { readBy: userId } });
        res.json({ message: "Notifications marked as read" });
    }
    catch (err) {
        console.error("Error marking notifications as read:", err);
        res.status(500).json({
            error: err.message || "Failed to mark notifications as read",
        });
    }
});
export default router;
