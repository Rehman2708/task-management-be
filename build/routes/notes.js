import { Router } from "express";
import Notes from "../models/Notes.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
import { deleteFromS3 } from "./uploads.js";
import { createUserCache } from "../services/userCacheService.js";
const router = Router();
/* ------------------------ Optimized Helper Functions ------------------------ */
// Batch enrich comments using user cache (solves N+1 problem)
async function enrichNoteComments(comments, userCache) {
    if (!comments?.length)
        return [];
    // Get all unique user IDs
    const userIds = [
        ...new Set(comments.map((c) => c.createdBy).filter(Boolean)),
    ];
    // Batch fetch all users at once
    const users = await userCache.getUsers(userIds);
    // Enrich comments with cached user data
    return comments.map((comment) => {
        if (!comment?.createdBy)
            return comment;
        const user = users.get(comment.createdBy);
        if (user) {
            comment.createdByDetails = userCache.getUserDetails(user);
        }
        return comment;
    });
}
// Optimized note enrichment without redundant writes
async function enrichNote(note, userCache) {
    if (!note)
        return note;
    // Get creator details from cache
    const user = await userCache.getUser(note.createdBy);
    if (user) {
        note.createdByDetails = userCache.getUserDetails(user);
    }
    // Enrich comments in batch
    if (Array.isArray(note.comments) && note.comments.length > 0) {
        note.comments = await enrichNoteComments(note.comments, userCache);
        note.totalComments = note.comments.length;
    }
    else {
        note.totalComments = 0;
    }
    return note;
}
/* ------------------------ GET Notes with Pagination - OPTIMIZED ------------------------ */
router.get("/:ownerUserId", async (req, res) => {
    const userCache = createUserCache();
    try {
        const { ownerUserId } = req.params;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
        // Get owner and partner in parallel
        const owner = await userCache.getUser(ownerUserId);
        const filter = owner
            ? {
                createdBy: owner.partnerUserId
                    ? { $in: [ownerUserId, owner.partnerUserId] }
                    : ownerUserId,
            }
            : {};
        // Run count and find queries in parallel
        const [totalCount, notes] = await Promise.all([
            Notes.countDocuments(filter),
            Notes.find(filter)
                .sort({ pinned: -1, createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .lean(),
        ]);
        // Batch enrich all notes
        const enrichedNotes = await Promise.all(notes.map((note) => enrichNote(note, userCache)));
        // Set cache headers
        res.set({
            "Cache-Control": "private, max-age=60", // Cache for 1 minute
            ETag: `"notes-${ownerUserId}-${page}-${totalCount}"`,
        });
        res.json({
            notes: enrichedNotes,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
        });
    }
    catch (err) {
        console.error("Error fetching notes:", err);
        res.status(500).json({ error: err.message || "Failed to fetch notes" });
    }
    finally {
        userCache.clear(); // Prevent memory leaks
    }
});
/* ------------------------ GET Single Note - OPTIMIZED ------------------------ */
router.get("/note/:id", async (req, res) => {
    const userCache = createUserCache();
    try {
        const note = await Notes.findById(req.params.id).lean();
        if (!note)
            return res.status(404).json({ error: "Note not found" });
        const enriched = await enrichNote(note, userCache);
        // Set cache headers
        res.set({
            "Cache-Control": "private, max-age=300", // Cache for 5 minutes
            ETag: `"note-${note._id}-${note.comments?.length || 0}"`,
        });
        res.json(enriched);
    }
    catch (err) {
        console.error("Error fetching note:", err);
        res.status(500).json({ error: err.message || "Failed to fetch note" });
    }
    finally {
        userCache.clear();
    }
});
/* ------------------------ CREATE Note ------------------------ */
router.post("/", async (req, res) => {
    try {
        const { image, title, note, createdBy } = req.body || {};
        if (!title || !note || !createdBy)
            return res
                .status(400)
                .json({ error: "title, note and createdBy are required" });
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newNote = await Notes.create({
            image,
            title,
            note,
            createdBy,
            comments: [],
            totalComments: 0,
            createdByDetails: { name: owner?.name, image: owner?.image },
        });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Note.Created, {
                noteTitle: title.trim(),
                ownerName: owner?.name?.trim() ?? "",
            }, {
                type: NotificationData.Note,
                noteId: newNote._id,
                image: newNote.image ?? undefined,
            }, [partner.userId], String(newNote._id));
        }
        res.status(201).json(newNote);
    }
    catch (err) {
        console.error("Error creating note:", err);
        res.status(500).json({ error: err.message || "Failed to create note" });
    }
});
/* ------------------------ UPDATE Note ------------------------ */
router.put("/:id", async (req, res) => {
    try {
        const { image, title, note, userId } = req.body || {};
        if (!title || !note || !userId)
            return res
                .status(400)
                .json({ error: "title, note, and userId are required" });
        const updatedNote = await Notes.findByIdAndUpdate(req.params.id, { image, title, note, updatedAt: new Date() }, { new: true });
        if (!updatedNote)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Note.Updated, {
                noteTitle: title.trim(),
                ownerName: owner?.name?.trim() ?? "",
            }, {
                type: NotificationData.Note,
                noteId: updatedNote._id,
                image: updatedNote.image ?? undefined,
            }, [partner.userId], String(updatedNote._id));
        }
        res.json(updatedNote);
    }
    catch (err) {
        console.error("Error updating note:", err);
        res.status(500).json({ error: err.message || "Failed to update note" });
    }
});
/* ------------------------ DELETE Note ------------------------ */
router.delete("/:id", async (req, res) => {
    try {
        const { userId } = req.body || {};
        if (!userId)
            return res.status(400).json({ error: "userId is required" });
        const deleted = await Notes.findByIdAndDelete(req.params.id);
        if (deleted?.image) {
            await deleteFromS3(deleted.image);
        }
        if (!deleted)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Note.Deleted, {
                noteTitle: deleted.title.trim(),
                ownerName: owner?.name?.trim() ?? "",
            }, {
                type: NotificationData.Note,
                image: deleted.image ?? undefined,
            }, [partner.userId], String(deleted._id));
        }
        res.json({ message: "Note deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting note:", err);
        res.status(500).json({ error: err.message || "Failed to delete note" });
    }
});
/* ------------------------ PIN / UNPIN Note ------------------------ */
router.patch("/pin/:id", async (req, res) => {
    try {
        const { pinned, userId } = req.body || {};
        if (typeof pinned !== "boolean" || !userId)
            return res
                .status(400)
                .json({ error: "pinned (boolean) and userId are required" });
        const updated = await Notes.findByIdAndUpdate(req.params.id, { pinned }, { new: true });
        if (!updated)
            return res.status(404).json({ error: "Note not found" });
        const { owner, partner } = await getOwnerAndPartner(userId);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Note.Pinned, {
                noteTitle: updated.title.trim(),
                ownerName: owner?.name?.trim() ?? "",
                pinned,
            }, {
                type: NotificationData.Note,
                noteId: updated._id,
                image: updated.image ?? undefined,
            }, [partner.userId], String(updated._id));
        }
        res.json(updated);
    }
    catch (err) {
        console.error("Error pinning note:", err);
        res.status(500).json({ error: err.message || "Failed to pin note" });
    }
});
/* ------------------------ ADD COMMENT - OPTIMIZED ------------------------ */
router.post("/:id/comment", async (req, res) => {
    const userCache = createUserCache();
    try {
        const { createdBy, text, image } = req.body;
        if (!createdBy && (!text || !image))
            return res
                .status(400)
                .json({ error: "createdBy and text or image are required" });
        const newComment = {
            text,
            createdBy,
            createdAt: new Date(),
            image,
        };
        // Use atomic update for better performance
        const note = await Notes.findByIdAndUpdate(req.params.id, {
            $push: { comments: newComment },
            $inc: { totalComments: 1 },
        }, {
            new: true,
            select: "comments totalComments title image _id", // Only select needed fields
        });
        if (!note)
            return res.status(404).json({ error: "Note not found" });
        // Send response immediately
        res.status(201).json({
            comments: note.comments,
            totalComments: note.totalComments,
        });
        // Handle notifications asynchronously (fire and forget)
        setImmediate(async () => {
            try {
                const enrichedComments = await enrichNoteComments([newComment], userCache);
                const enrichedComment = enrichedComments[0];
                const { partner } = await getOwnerAndPartner(createdBy);
                if (partner?.notificationToken) {
                    await sendExpoPush([partner.notificationToken], NotificationMessages.Note.Comment, {
                        noteTitle: note.title,
                        commenterName: enrichedComment.createdByDetails?.name ?? "Someone",
                        text,
                    }, {
                        type: NotificationData.Note,
                        noteId: note._id,
                        isComment: true,
                        image: image ?? note.image ?? undefined,
                    }, [partner.userId], String(note._id));
                }
            }
            catch (notificationErr) {
                console.error("Note notification error:", notificationErr);
            }
        });
    }
    catch (err) {
        console.error("Add note comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
    finally {
        userCache.clear();
    }
});
/* ------------------------ GET COMMENTS - OPTIMIZED ------------------------ */
router.get("/:id/comments", async (req, res) => {
    const userCache = createUserCache();
    try {
        // Only select comments field for better performance
        const note = await Notes.findById(req.params.id)
            .select("comments totalComments")
            .lean();
        if (!note)
            return res.status(404).json({ error: "Note not found" });
        // Set cache headers for better performance
        res.set({
            "Cache-Control": "private, max-age=30", // Cache for 30 seconds
            ETag: `"${note._id}-${note.comments?.length || 0}"`,
        });
        // Batch enrich comments
        const comments = await enrichNoteComments(note.comments || [], userCache);
        res.json({
            comments,
            totalComments: comments.length,
        });
    }
    catch (err) {
        console.error("Get note comments error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
    finally {
        userCache.clear();
    }
});
export default router;
