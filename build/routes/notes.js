import { Router } from "express";
import Notes from "../models/Notes.js";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
const router = Router();
/**
 * Get all notes (optionally by user)
 * Optional query: ?userId=<userId>
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const filter = {};
        if (ownerUserId) {
            const owner = await User.findOne({ userId: ownerUserId }).lean();
            const partnerUserId = owner?.partnerUserId;
            filter.createdBy = {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            };
        }
        // Sort: pinned notes first, then by updatedAt descending
        const notes = await Notes.find(filter)
            .sort({ pinned: -1, createdAt: -1 })
            .lean();
        // Update createdByDetails for each note
        await Promise.all(notes.map(async (note) => {
            const user = await User.findOne({ userId: note.createdBy }).lean();
            if (!user)
                return note;
            const latestDetails = {
                name: user.name,
                image: user.image || "",
            };
            // If details are missing or outdated, update them
            if (!note.createdByDetails ||
                note.createdByDetails.name !== latestDetails.name ||
                note.createdByDetails.image !== latestDetails.image) {
                await Notes.findByIdAndUpdate(note._id, {
                    createdByDetails: latestDetails,
                });
                note.createdByDetails = latestDetails; // update in response too
            }
            return note;
        }));
        res.json(notes);
    }
    catch (err) {
        console.error("Error fetching notes:", err);
        res.status(500).json({ error: err.message || "Failed to fetch notes" });
    }
});
/**
 * Create a new note
 * Body: { note, createdBy }
 */
router.post("/", async (req, res) => {
    try {
        const { image, title, note, createdBy } = req.body || {};
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        if (!title || !note || !createdBy) {
            return res
                .status(400)
                .json({ error: "title, note and createdBy are required" });
        }
        const newNote = await Notes.create({
            image,
            title,
            note,
            createdBy,
        });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Note: ${title.trim()}`, `${owner?.name?.trim()} created a note!`, { type: "note", noteData: newNote });
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
 * Body: { note }
 */
router.put("/:id", async (req, res) => {
    try {
        const { image, title, note } = req.body || {};
        if (!title)
            return res.status(400).json({ error: "title is required" });
        if (!note)
            return res.status(400).json({ error: "note is required" });
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { image, title, note, updatedAt: new Date() }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(updatedNote.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush(partner?.notificationToken
                ? [partner.notificationToken, owner.notificationToken]
                : [owner.notificationToken], `Note: ${title.trim()}`, `${updatedNote.title.trim()} note has been updated!`, { type: "note", noteData: updatedNote });
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
        const deletedNote = await Notes.findByIdAndDelete(req.params.id);
        if (!deletedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(deletedNote.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], `Note deleted ❌`, `${deletedNote.title.trim()} has been deleted!`);
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
 * Body: { pinned: boolean }
 */
router.patch("/pin/:id", async (req, res) => {
    try {
        const { pinned } = req.body;
        if (typeof pinned !== "boolean") {
            return res.status(400).json({ error: "pinned (boolean) is required" });
        }
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { pinned }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        const action = updatedNote.pinned ? "pinned" : "unpinned";
        const owner = await User.findOne({
            userId: updatedNote.createdBy,
        }).lean();
        const partner = await User.findOne({
            userId: owner?.partnerUserId,
        }).lean();
        if (owner?.notificationToken) {
            await sendExpoPush(partner?.notificationToken
                ? [partner.notificationToken, owner.notificationToken]
                : [owner.notificationToken], `Note: ${updatedNote.title.trim()}`, `This note has been ${action}!`, { type: "note", noteData: updatedNote });
        }
        res.json(updatedNote);
    }
    catch (err) {
        console.error("Error pinning/unpinning note:", err);
        res.status(500).json({ error: err.message || "Failed to pin/unpin note" });
    }
});
export default router;
