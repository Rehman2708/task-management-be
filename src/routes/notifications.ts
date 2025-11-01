import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";

export interface ExpoPushData {
  [key: string]: any;
}

/**
 * Send Expo push notification and store it in DB
 * Groups and accumulates recent comments (like WhatsApp)
 */
type NotificationFunc<T> = (props: T) => { title: string; body: string };

export async function sendExpoPush<T = any>(
  expoTokens: string[] = [],
  message: string | NotificationFunc<T>,
  messageProps?: T,
  data: ExpoPushData = {},
  toUserIds: string[] = [],
  groupId?: string
): Promise<void> {
  if (!expoTokens.length) return;

  // Resolve title and body
  let title: string;
  let body: string;

  if (typeof message === "function") {
    const result = message(messageProps as T);
    title = result.title;
    body = result.body;
  } else {
    title = message;
    body = messageProps as unknown as string; // if passing string directly
  }

  const messages = expoTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
    ios: groupId ? { threadId: groupId } : undefined,
    android: {
      channelId: data.type,
      ...(groupId ? { group: groupId } : {}),
    },
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
  } catch (err) {
    console.error("Error sending Expo push:", err);
  }
}

const router = Router();

/**
 * GET /notifications/:userId?page=1&pageSize=10
 */
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);

    // Delete notifications older than 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

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
    const notificationIds = notifications.map((n) => n._id);
    if (notificationIds.length > 0) {
      Notification.updateMany(
        { _id: { $in: notificationIds }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      ).catch((err) =>
        console.error("Error marking notifications as read:", err)
      );
    }
  } catch (err: any) {
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
router.patch("/mark-read", async (req: Request, res: Response) => {
  try {
    const { userId, notificationIds } = req.body || {};
    if (!userId || !Array.isArray(notificationIds)) {
      return res
        .status(400)
        .json({ error: "userId and notificationIds array required" });
    }

    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $addToSet: { readBy: userId } }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (err: any) {
    console.error("Error marking notifications as read:", err);
    res.status(500).json({
      error: err.message || "Failed to mark notifications as read",
    });
  }
});

export default router;
