import { Router } from "express";
import Notes from "../models/Notes.js";
import User from "../models/User.js";
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
        const { title, note, createdBy } = req.body || {};
        if (!title || !note || !createdBy) {
            return res
                .status(400)
                .json({ error: "title, note and createdBy are required" });
        }
        const newNote = await Notes.create({ title, note, createdBy });
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
        const { title, note } = req.body || {};
        if (!title)
            return res.status(400).json({ error: "title is required" });
        if (!note)
            return res.status(400).json({ error: "note is required" });
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { title, note, updatedAt: new Date() }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
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
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { pinned, updatedAt: new Date() }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        res.json(updatedNote);
    }
    catch (err) {
        console.error("Error pinning/unpinning note:", err);
        res.status(500).json({ error: err.message || "Failed to pin/unpin note" });
    }
});
export default router;
