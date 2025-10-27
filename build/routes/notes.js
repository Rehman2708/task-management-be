import { Router } from "express";
import Notes from "../models/Notes.js";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
const router = Router();
/**
 * Get all notes (optionally by user) with pagination
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
        const totalCount = await Notes.countDocuments(filter);
        const notes = await Notes.find(filter)
            .sort({ pinned: -1, createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();
        const userCache = {};
        await Promise.all(notes.map(async (note) => {
            const userId = note.createdBy;
            if (!userCache[userId]) {
                const user = await User.findOne({ userId }).lean();
                if (user)
                    userCache[userId] = { name: user.name, image: user.image || "" };
            }
            const latestDetails = userCache[userId];
            if (!latestDetails)
                return;
            if (!note.createdByDetails ||
                note.createdByDetails.name !== latestDetails.name ||
                note.createdByDetails.image !== latestDetails.image) {
                await Notes.findByIdAndUpdate(note._id, {
                    createdByDetails: latestDetails,
                });
                note.createdByDetails = latestDetails;
            }
        }));
        res.json({
            notes,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching notes:", err);
        res.status(500).json({ error: err.message || "Failed to fetch notes" });
    }
});
/**
 * Get a single note by ID
 */
router.get("/note/:id", async (req, res) => {
    try {
        const note = await Notes.findById(req.params.id).lean();
        if (!note)
            return res.status(404).json({ error: "Note not found" });
        const user = await User.findOne({ userId: note.createdBy }).lean();
        if (user) {
            note.createdByDetails = { name: user.name, image: user.image || "" };
        }
        res.json(note);
    }
    catch (err) {
        console.error("Error fetching single note:", err);
        res.status(500).json({ error: err.message || "Failed to fetch note" });
    }
});
/**
 * Create a new note
 */
router.post("/", async (req, res) => {
    try {
        const { image, title, note, createdBy } = req.body || {};
        if (!title || !note || !createdBy) {
            return res
                .status(400)
                .json({ error: "title, note and createdBy are required" });
        }
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newNote = await Notes.create({ image, title, note, createdBy });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Note: ${title.trim()}`, `${owner?.name?.trim()} created a note!`, { type: NotificationData.Note, noteId: newNote._id }, [partner.userId], String(newNote._id));
        }
        res.status(201).json(newNote);
    }
    catch (err) {
        console.error("Error creating note:", err);
        res.status(500).json({ error: err.message || "Failed to create note" });
    }
});
/**
 * Update a note
 */
router.put("/:id", async (req, res) => {
    try {
        const { image, title, note, userId } = req.body || {};
        if (!title || !note || !userId) {
            return res
                .status(400)
                .json({ error: "title, note, and userId are required" });
        }
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { image, title, note, updatedAt: new Date() }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Note: ${title.trim()}`, `${owner?.name?.trim()} updated a note!`, { type: NotificationData.Note, noteId: updatedNote._id }, [partner.userId], String(updatedNote._id));
        }
        res.json(updatedNote);
    }
    catch (err) {
        console.error("Error updating note:", err);
        res.status(500).json({ error: err.message || "Failed to update note" });
    }
});
/**
 * Delete a note
 */
router.delete("/:id", async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId)
            return res.status(400).json({ error: "userId is required" });
        const deletedNote = await Notes.findByIdAndDelete(req.params.id);
        if (!deletedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Note deleted ❌`, `${owner?.name?.trim()} deleted "${deletedNote.title.trim()}"!`, { type: NotificationData.Note }, [partner.userId], String(deletedNote._id));
        }
        res.json({ message: "Note deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting note:", err);
        res.status(500).json({ error: err.message || "Failed to delete note" });
    }
});
/**
 * Pin or unpin a note
 */
router.patch("/pin/:id", async (req, res) => {
    try {
        const { pinned, userId } = req.body || {};
        if (typeof pinned !== "boolean" || !userId) {
            return res
                .status(400)
                .json({ error: "pinned (boolean) and userId are required" });
        }
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { pinned }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Note: ${updatedNote.title.trim()}`, `${owner?.name?.trim()} ${pinned ? "pinned" : "unpinned"} a note!`, { type: NotificationData.Note, noteId: updatedNote._id }, [partner.userId], String(updatedNote._id));
        }
        res.json(updatedNote);
    }
    catch (err) {
        console.error("Error pinning/unpinning note:", err);
        res.status(500).json({ error: err.message || "Failed to pin/unpin note" });
    }
});
export default router;
