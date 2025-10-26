import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";
import { ObjectId } from "mongoose";

export interface ExpoPushData {
  [key: string]: any;
}

export async function sendExpoPush(
  expoTokens: string[] = [],
  title: string,
  body: string,
  data: ExpoPushData = {},
  toUserIds: string[] = [],
  groupId?: string // 🔥 new param: group notifications by this ID (e.g. taskId)
): Promise<void> {
  if (!expoTokens.length) return;

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
      channelId: "task-updates", // make sure you create this channel in the app
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
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize as string) || 10, 1);

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
  } catch (err: any) {
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
router.patch("/mark-read", async (req: Request, res: Response) => {
  try {
    const { userId, notificationIds } = req.body as {
      userId: string;
      notificationIds: string[];
    };

    if (!userId || !Array.isArray(notificationIds))
      return res
        .status(400)
        .json({ error: "userId and notificationIds array required" });

    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $addToSet: { readBy: userId } }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (err: any) {
    console.error("Error marking notifications as read:", err);
    res.status(500).json({ error: err.message || "Failed to mark as read" });
  }
});

export default router;
