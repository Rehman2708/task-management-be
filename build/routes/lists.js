import { Router } from "express";
import Lists from "../models/List.js";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
const router = Router();
/* ------------------------ Helper: Enrich Comment ------------------------ */
async function enrichListComment(comment) {
    if (!comment?.createdBy)
        return comment;
    const user = await User.findOne({ userId: comment.createdBy }).lean();
    if (user) {
        comment.createdByDetails = {
            name: user.name,
            image: user.image || "",
        };
    }
    return comment;
}
/* ------------------------ Helper: Enrich List --------------------------- */
async function enrichList(list) {
    if (!list)
        return list;
    let modified = false;
    // createdByDetails
    const user = await User.findOne({ userId: list.createdBy }).lean();
    if (user) {
        const newDetails = { name: user.name, image: user.image || "" };
        list.createdByDetails = newDetails;
        modified = true;
    }
    // comments
    if (Array.isArray(list.comments) && list.comments.length > 0) {
        const enriched = await Promise.all(list.comments.map(enrichListComment));
        list.comments = enriched;
        list.totalComments = enriched.length;
        modified = true;
    }
    else {
        list.totalComments = 0;
        modified = true;
    }
    if (modified) {
        await Lists.findByIdAndUpdate(list._id, {
            $set: {
                createdByDetails: list.createdByDetails,
                comments: list.comments,
                totalComments: list.totalComments,
            },
        }, { new: true });
    }
    return list;
}
/* ------------------------ GET ALL LISTS ------------------------ */
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
        const enrichedLists = await Promise.all(lists.map(enrichList));
        res.json({
            lists: enrichedLists,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching lists:", err);
        res.status(500).json({ error: err.message || "Failed to fetch lists" });
    }
});
/* ------------------------ GET SINGLE LIST ------------------------ */
router.get("/list/:id", async (req, res) => {
    try {
        const list = await Lists.findById(req.params.id).lean();
        if (!list)
            return res.status(404).json({ error: "List not found" });
        const enriched = await enrichList(list);
        res.json(enriched);
    }
    catch (err) {
        console.error("Error fetching list:", err);
        res.status(500).json({ error: err.message || "Failed to fetch list" });
    }
});
/* ------------------------ CREATE LIST ------------------------ */
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
            comments: [],
            totalComments: 0,
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
/* ------------------------ UPDATE LIST ------------------------ */
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
/* ------------------------ DELETE LIST ------------------------ */
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
/* ------------------------ PIN / UNPIN LIST ------------------------ */
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
/* ------------------------ TOGGLE LIST ITEM ------------------------ */
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
        else {
            return res.status(400).json({ error: "Invalid item index" });
        }
    }
    catch (err) {
        console.error("Error toggling item:", err);
        res.status(500).json({ error: err.message || "Failed to toggle item" });
    }
});
/* ------------------------ ADD COMMENT ------------------------ */
router.post("/:id/comment", async (req, res) => {
    try {
        const { createdBy, text } = req.body;
        if (!createdBy || !text)
            return res.status(400).json({ error: "createdBy and text are required" });
        const list = await Lists.findById(req.params.id);
        if (!list)
            return res.status(404).json({ error: "List not found" });
        const newComment = { text, createdBy, createdAt: new Date() };
        const enrichedComment = await enrichListComment(newComment);
        list.comments = list.comments || [];
        list.comments.push(newComment);
        list.totalComments = list.comments.length;
        await list.save();
        const { partner } = await getOwnerAndPartner(createdBy);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.List.Comment, {
                listTitle: list.title,
                commenterName: enrichedComment.createdByDetails?.name ?? "Someone",
                text,
            }, {
                type: NotificationData.List,
                listId: list._id,
                isComment: true,
                image: list.image ?? undefined,
            }, [partner.userId], String(list._id));
        }
        res.status(201).json({
            comments: list.comments,
            totalComments: list.totalComments,
        });
    }
    catch (err) {
        console.error("Add list comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
});
/* ------------------------ GET COMMENTS ------------------------ */
router.get("/:id/comments", async (req, res) => {
    try {
        const list = await Lists.findById(req.params.id).lean();
        if (!list)
            return res.status(404).json({ error: "List not found" });
        const comments = await Promise.all((list.comments || []).map(enrichListComment));
        await Lists.findByIdAndUpdate(list._id, {
            $set: { totalComments: comments.length },
        });
        res.json({ comments, totalComments: comments.length });
    }
    catch (err) {
        console.error("Get list comments error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
});
export default router;
