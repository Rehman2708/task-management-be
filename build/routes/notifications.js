import { Router } from "express";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";
// Helper functions for notification grouping
function getItemName(data) {
    if (data.taskId)
        return "task";
    if (data.noteId)
        return "note";
    if (data.listId)
        return "list";
    if (data.videoData)
        return "video";
    return "item";
}
function getItemType(type) {
    switch (type) {
        case "task":
            return "Task";
        case "note":
            return "Note";
        case "list":
            return "List";
        case "video":
            return "Video";
        default:
            return "Item";
    }
}
export async function sendExpoPush(expoTokens = [], message, messageProps, data = {}, toUserIds = [], groupId) {
    if (!expoTokens.length)
        return;
    // Validate expo tokens format
    const validTokens = expoTokens.filter((token) => token &&
        typeof token === "string" &&
        token.startsWith("ExponentPushToken["));
    if (!validTokens.length) {
        console.warn("No valid Expo push tokens provided");
        return;
    }
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
    // Handle grouped comment notifications
    if (groupId && data.isComment) {
        await handleGroupedCommentNotification(validTokens, title, body, data, toUserIds, groupId);
        return;
    }
    const messages = validTokens.map((token) => ({
        to: token,
        sound: "default",
        title: title.substring(0, 100), // Limit title length
        body: body.substring(0, 200), // Limit body length
        data,
        priority: "high",
        ios: data.type ? { threadId: data.type } : undefined,
        android: {
            channelId: data.type,
            priority: "high",
            ...(data.type ? { group: data.type } : {}),
            ...(groupId ? { tag: groupId } : {}), // Use tag for grouping on Android
        },
        richContent: { image: data.image, video: data?.videoData?.url },
        // Add category identifier to enable action buttons
        ...(data.type === "subtask_reminder"
            ? { categoryIdentifier: "subtask_reminder" }
            : {}),
        ...(data.isComment && data.type === "task"
            ? { categoryIdentifier: "task_comment" }
            : {}),
        ...(data.isComment && data.type === "note"
            ? { categoryIdentifier: "note_comment" }
            : {}),
        ...(data.isComment && data.type === "list"
            ? { categoryIdentifier: "list_comment" }
            : {}),
        ...(data.isComment && data.type === "video"
            ? { categoryIdentifier: "video_comment" }
            : {}),
        // Fallback for any other comment types
        ...(data.isComment && !["task", "note", "list", "video"].includes(data.type)
            ? { categoryIdentifier: "comment" }
            : {}),
    }));
    try {
        // Send push with retry mechanism
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(messages),
        });
        if (!response.ok) {
            throw new Error(`Push notification failed: ${response.status} ${response.statusText}`);
        }
        const result = (await response.json());
        // Log any errors from Expo
        if (result?.data) {
            result.data.forEach((item, index) => {
                if (item?.status === "error") {
                    console.error(`Push notification error for token ${validTokens[index]}:`, item.message);
                }
            });
        }
        // Store notification in database only if push was successful
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
        // Don't throw error to prevent breaking the main flow
    }
}
// Handle grouped comment notifications (like WhatsApp)
async function handleGroupedCommentNotification(expoTokens, title, body, data, toUserIds, groupId) {
    try {
        // Check for recent notifications in the same group (within last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentNotifications = await Notification.find({
            groupId,
            toUserIds: { $in: toUserIds },
            createdAt: { $gte: tenMinutesAgo },
            "data.isComment": true,
        })
            .sort({ createdAt: -1 })
            .limit(10);
        let finalTitle = title;
        let finalBody = body;
        let commentCount = 1;
        if (recentNotifications.length > 0) {
            commentCount = recentNotifications.length + 1;
            // Get the item name from data
            const itemName = getItemName(data);
            const itemType = getItemType(data.type);
            if (commentCount === 2) {
                // Show both comments
                finalTitle = `💬 ${commentCount} comments`;
                finalBody = `${recentNotifications[0].body}\n${body}`;
            }
            else {
                // Show count and latest comment
                finalTitle = `💬 ${commentCount} comments on ${itemName}`;
                finalBody = `${body}`;
            }
            // Delete old notifications in this group to avoid duplicates
            await Notification.deleteMany({
                groupId,
                toUserIds: { $in: toUserIds },
                "data.isComment": true,
                createdAt: { $gte: tenMinutesAgo },
            });
        }
        // Send the grouped notification
        const messages = expoTokens.map((token) => ({
            to: token,
            sound: "default",
            title: finalTitle.substring(0, 100),
            body: finalBody.substring(0, 200),
            priority: "high",
            data: {
                ...data,
                commentCount,
                isGrouped: commentCount > 1,
            },
            ios: data.type ? { threadId: groupId } : undefined,
            android: {
                channelId: data.type,
                priority: "high",
                group: groupId,
                tag: groupId, // This ensures notifications with same tag replace each other
            },
            richContent: { image: data.image, video: data?.videoData?.url },
            // Add category identifier for comment notifications to enable action buttons
            ...(data.isComment && data.type === "task"
                ? { categoryIdentifier: "task_comment" }
                : {}),
            ...(data.isComment && data.type === "note"
                ? { categoryIdentifier: "note_comment" }
                : {}),
            ...(data.isComment && data.type === "list"
                ? { categoryIdentifier: "list_comment" }
                : {}),
            ...(data.isComment && data.type === "video"
                ? { categoryIdentifier: "video_comment" }
                : {}),
            // Fallback for any other comment types
            ...(data.isComment &&
                !["task", "note", "list", "video"].includes(data.type)
                ? { categoryIdentifier: "comment" }
                : {}),
        }));
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(messages),
        });
        if (!response.ok) {
            throw new Error(`Grouped notification failed: ${response.status}`);
        }
        // Store the grouped notification
        await Notification.create({
            title: finalTitle,
            body: finalBody,
            data: {
                ...data,
                commentCount,
                isGrouped: commentCount > 1,
            },
            toUserIds,
            groupId,
        });
    }
    catch (err) {
        console.error("Error handling grouped comment notification:", err);
        // Fallback to regular notification with simplified approach
        try {
            const messages = expoTokens.map((token) => ({
                to: token,
                sound: "default",
                title: title.substring(0, 100),
                body: body.substring(0, 200),
                priority: "high",
                data,
                ios: data.type ? { threadId: data.type } : undefined,
                android: {
                    channelId: data.type,
                    priority: "high",
                    group: data.type,
                },
            }));
            await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(messages),
            });
            // Store fallback notification
            await Notification.create({
                title,
                body,
                data,
                toUserIds,
                groupId,
            });
        }
        catch (fallbackErr) {
            console.error("Fallback notification also failed:", fallbackErr);
        }
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
        // Delete notifications older than 7 days (run cleanup less frequently)
        const shouldCleanup = Math.random() < 0.1; // 10% chance to run cleanup
        if (shouldCleanup) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep for 7 days instead of 4
            const deleted = await Notification.deleteMany({
                createdAt: { $lt: cutoffDate },
            });
            if (deleted.deletedCount > 0) {
                console.log(`Cleaned up ${deleted.deletedCount} old notifications`);
            }
        }
        const filter = { toUserIds: userId };
        const totalCount = await Notification.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);
        // Fetch notifications with better grouping
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
        // Process notifications to improve grouped comment display
        const processedNotifications = notifications.map((notification) => {
            if (notification.data?.isComment &&
                notification.data?.isGrouped &&
                notification.data?.commentCount > 1) {
                // Improve grouped notification display
                const itemName = getItemName(notification.data);
                const itemType = getItemType(notification.data.type);
                return {
                    ...notification,
                    title: `💬 ${notification.data.commentCount} comments`,
                    body: `${notification.data.commentCount} new comments on ${itemName}`,
                };
            }
            return notification;
        });
        // Send response first
        res.json({
            notifications: processedNotifications,
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
