import { Router } from "express";
import mongoose from "mongoose";
import Notes from "../models/Notes.js";

const router = Router();

/**
 * Get all notes (optionally by user)
 * Optional query: ?userId=<userId>
 */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    const filter: any = {};
    if (userId) filter.createdBy = userId;

    const notes = await Notes.find(filter).sort({ createdAt: -1 }).lean();
    res.json(notes);
  } catch (err: any) {
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
  } catch (err: any) {
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
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!note) return res.status(400).json({ error: "note is required" });

    const updatedNote = await Notes.findByIdAndUpdate(
      req.params.id,
      { title, note, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedNote) return res.status(404).json({ error: "Note not found" });
    res.json(updatedNote);
  } catch (err: any) {
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
    if (!deletedNote) return res.status(404).json({ error: "Note not found" });
    res.json({ message: "Note deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting note:", err);
    res.status(500).json({ error: err.message || "Failed to delete note" });
  }
});

export default router;
