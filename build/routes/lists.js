import { Router } from "express";
import Lists from "../models/List.js";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
const router = Router();
/**
 * Get all lists (optionally by user) with pagination
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
        const owner = await User.findOne({ userId: ownerUserId }).lean();
        const filter = owner
            ? {
                createdBy: {
                    $in: owner.partnerUserId
                        ? [ownerUserId, owner.partnerUserId]
                        : [ownerUserId],
                },
            }
            : {};
        const totalCount = await Lists.countDocuments(filter);
        const lists = await Lists.find(filter)
            .sort({ pinned: -1, createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();
        const userCache = {};
        await Promise.all(lists.map(async (list) => {
            const userId = list.createdBy;
            if (!userCache[userId]) {
                const user = await User.findOne({ userId }).lean();
                if (user)
                    userCache[userId] = { name: user.name, image: user.image || "" };
            }
            const latestDetails = userCache[userId];
            if (!latestDetails)
                return;
            if (!list.createdByDetails ||
                list.createdByDetails.name !== latestDetails.name ||
                list.createdByDetails.image !== latestDetails.image) {
                await Lists.findByIdAndUpdate(list._id, {
                    createdByDetails: latestDetails,
                });
                list.createdByDetails = latestDetails;
            }
        }));
        res.json({
            lists,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching lists:", err);
        res.status(500).json({ error: err.message || "Failed to fetch lists" });
    }
});
/**
 * Get a single list by ID
 */
router.get("/list/:id", async (req, res) => {
    try {
        const list = await Lists.findById(req.params.id).lean();
        if (!list)
            return res.status(404).json({ error: "List not found" });
        const user = await User.findOne({ userId: list.createdBy }).lean();
        if (user) {
            list.createdByDetails = { name: user.name, image: user.image || "" };
        }
        res.json(list);
    }
    catch (err) {
        console.error("Error fetching list:", err);
        res.status(500).json({ error: err.message || "Failed to fetch list" });
    }
});
/**
 * Create a new list
 */
router.post("/", async (req, res) => {
    try {
        const { image, title, items, createdBy, description } = req.body || {};
        if (!title || !createdBy) {
            return res
                .status(400)
                .json({ error: "title and createdBy are required" });
        }
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newList = await Lists.create({
            image,
            title,
            items,
            createdBy,
            description,
        });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.Created, { listTitle: title.trim(), ownerName: owner?.name?.trim() ?? "" }, {
                type: NotificationData.List,
                listId: newList._id,
                image: newList.image ?? undefined,
            }, [partner.userId], String(newList._id));
        }
        res.status(201).json(newList);
    }
    catch (err) {
        console.error("Error creating list:", err);
        res.status(500).json({ error: err.message || "Failed to create list" });
    }
});
/**
 * Update a list
 */
router.put("/:id", async (req, res) => {
    try {
        const { image, title, items, userId, description } = req.body || {};
        if (!title || !userId) {
            return res.status(400).json({ error: "title and userId are required" });
        }
        const updatedList = await Lists.findByIdAndUpdate(req.params.id, { image, title, items, updatedAt: new Date(), description }, { new: true });
        if (!updatedList)
            return res.status(404).json({ error: "List not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.Updated, { listTitle: title.trim(), ownerName: owner?.name?.trim() ?? "" }, {
                type: NotificationData.List,
                listId: updatedList._id,
                image: updatedList.image ?? undefined,
            }, [partner.userId], String(updatedList._id));
        }
        res.json(updatedList);
    }
    catch (err) {
        console.error("Error updating list:", err);
        res.status(500).json({ error: err.message || "Failed to update list" });
    }
});
/**
 * Delete a list
 */
router.delete("/:id", async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId)
            return res.status(400).json({ error: "userId is required" });
        const deletedList = await Lists.findByIdAndDelete(req.params.id);
        if (!deletedList)
            return res.status(404).json({ error: "List not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.Deleted, {
                listTitle: deletedList.title.trim(),
                ownerName: owner?.name?.trim() ?? "",
            }, { type: NotificationData.List, image: deletedList.image ?? undefined }, [partner.userId], String(deletedList._id));
        }
        res.json({ message: "List deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting list:", err);
        res.status(500).json({ error: err.message || "Failed to delete list" });
    }
});
/**
 * Pin or unpin a list
 */
router.patch("/pin/:id", async (req, res) => {
    try {
        const { pinned, userId } = req.body || {};
        if (typeof pinned !== "boolean" || !userId) {
            return res
                .status(400)
                .json({ error: "pinned (boolean) and userId are required" });
        }
        const updatedList = await Lists.findByIdAndUpdate(req.params.id, { pinned }, { new: true });
        if (!updatedList)
            return res.status(404).json({ error: "List not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.Pinned, {
                listTitle: updatedList.title.trim(),
                ownerName: owner?.name?.trim() ?? "",
                pinned,
            }, {
                type: NotificationData.List,
                listId: updatedList._id,
                image: updatedList.image ?? undefined,
            }, [partner.userId], String(updatedList._id));
        }
        res.json(updatedList);
    }
    catch (err) {
        console.error("Error pinning/unpinning list:", err);
        res.status(500).json({ error: err.message || "Failed to pin/unpin list" });
    }
});
/**
 * Toggle a single list item’s completed status
 */
router.patch("/toggle-item/:listId/:itemIndex", async (req, res) => {
    try {
        const { listId, itemIndex } = req.params;
        const { userId } = req.body || {};
        if (!userId)
            return res.status(400).json({ error: "userId is required" });
        const list = await Lists.findById(listId);
        if (!list)
            return res.status(404).json({ error: "List not found" });
        if (list.items?.[Number(itemIndex)]) {
            list.items[Number(itemIndex)].completed =
                !list.items[Number(itemIndex)].completed;
            await list.save();
            res.json(list);
        }
        else {
            return res.status(400).json({ error: "Invalid item index" });
        }
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.ItemStatus, {
                listTitle: list.title.trim(),
                ownerName: owner?.name?.trim() ?? "",
                completed: list.items[Number(itemIndex)].completed,
            }, {
                type: NotificationData.List,
                listId: list._id,
                image: list.image ?? undefined,
            }, [partner.userId], String(list._id));
        }
        res.json(list);
    }
    catch (err) {
        console.error("Error toggling item:", err);
        res.status(500).json({ error: err.message || "Failed to toggle item" });
    }
});
export default router;
