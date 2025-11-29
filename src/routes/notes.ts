import { Router } from "express";
import Notes, { INote, INoteComment } from "../models/Notes.js";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
import { deleteFromS3 } from "./uploads.js";

const router = Router();

/* ------------------------ Helper: Enrich Comment ------------------------ */
async function enrichNoteComment(comment: INoteComment) {
  if (!comment?.createdBy) return comment;

  const user = await User.findOne({ userId: comment.createdBy }).lean();
  if (user) {
    comment.createdByDetails = {
      name: user.name,
      image: user.image || "",
    };
  }
  return comment;
}

/* ------------------------ Helper: Enrich Note --------------------------- */
async function enrichNote(note: INote) {
  if (!note) return note;

  let modified = false;

  // createdByDetails update
  const user = await User.findOne({ userId: note.createdBy }).lean();
  if (user) {
    const newDetails = { name: user.name, image: user.image || "" };
    note.createdByDetails = newDetails;
    modified = true;
  }

  // comments
  if (Array.isArray(note.comments) && note.comments.length > 0) {
    const enriched = await Promise.all(note.comments.map(enrichNoteComment));
    note.comments = enriched;
    note.totalComments = enriched.length;
    modified = true;
  } else {
    note.totalComments = 0;
    modified = true;
  }

  if (modified) {
    await Notes.findByIdAndUpdate(
      note._id,
      {
        $set: {
          createdByDetails: note.createdByDetails,
          comments: note.comments,
          totalComments: note.totalComments,
        },
      },
      { new: true }
    );
  }

  return note;
}

/* ------------------------ GET Notes with Pagination ------------------------ */
router.get("/:ownerUserId", async (req, res) => {
  try {
    const { ownerUserId } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);

    const owner = await User.findOne({ userId: ownerUserId }).lean();
    const filter = owner
      ? {
          createdBy: owner.partnerUserId
            ? { $in: [ownerUserId, owner.partnerUserId] }
            : ownerUserId,
        }
      : {};

    const totalCount = await Notes.countDocuments(filter);
    const notes = await Notes.find(filter)
      .sort({ pinned: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const enrichedNotes = await Promise.all(notes.map(enrichNote));

    res.json({
      notes: enrichedNotes,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
    });
  } catch (err: any) {
    console.error("Error fetching notes:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notes" });
  }
});

/* ------------------------ GET Single Note ------------------------ */
router.get("/note/:id", async (req, res) => {
  try {
    const note = await Notes.findById(req.params.id).lean();
    if (!note) return res.status(404).json({ error: "Note not found" });

    const enriched = await enrichNote(note);

    res.json(enriched);
  } catch (err: any) {
    console.error("Error fetching note:", err);
    res.status(500).json({ error: err.message || "Failed to fetch note" });
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
      await sendExpoPush(
        [partner.notificationToken],
        NotificationMessages.Note.Created,
        {
          noteTitle: title.trim(),
          ownerName: owner?.name?.trim() ?? "",
        },
        {
          type: NotificationData.Note,
          noteId: newNote._id,
          image: newNote.image ?? undefined,
        },
        [partner.userId],
        String(newNote._id)
      );
    }

    res.status(201).json(newNote);
  } catch (err: any) {
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

    const updatedNote = await Notes.findByIdAndUpdate(
      req.params.id,
      { image, title, note, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedNote) return res.status(404).json({ error: "Note not found" });

    const { owner, partner } = await getOwnerAndPartner(userId);
    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        NotificationMessages.Note.Updated,
        {
          noteTitle: title.trim(),
          ownerName: owner?.name?.trim() ?? "",
        },
        {
          type: NotificationData.Note,
          noteId: updatedNote._id,
          image: updatedNote.image ?? undefined,
        },
        [partner.userId],
        String(updatedNote._id)
      );
    }

    res.json(updatedNote);
  } catch (err: any) {
    console.error("Error updating note:", err);
    res.status(500).json({ error: err.message || "Failed to update note" });
  }
});

/* ------------------------ DELETE Note ------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const deleted = await Notes.findByIdAndDelete(req.params.id);
    if (deleted?.image) {
      await deleteFromS3(deleted.image);
    }
    if (!deleted) return res.status(404).json({ error: "Note not found" });

    const { owner, partner } = await getOwnerAndPartner(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        NotificationMessages.Note.Deleted,
        {
          noteTitle: deleted.title.trim(),
          ownerName: owner?.name?.trim() ?? "",
        },
        {
          type: NotificationData.Note,
          image: deleted.image ?? undefined,
        },
        [partner.userId],
        String(deleted._id)
      );
    }

    res.json({ message: "Note deleted successfully" });
  } catch (err: any) {
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

    const updated = await Notes.findByIdAndUpdate(
      req.params.id,
      { pinned },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Note not found" });

    const { owner, partner } = await getOwnerAndPartner(userId);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        NotificationMessages.Note.Pinned,
        {
          noteTitle: updated.title.trim(),
          ownerName: owner?.name?.trim() ?? "",
          pinned,
        },
        {
          type: NotificationData.Note,
          noteId: updated._id,
          image: updated.image ?? undefined,
        },
        [partner.userId],
        String(updated._id)
      );
    }

    res.json(updated);
  } catch (err: any) {
    console.error("Error pinning note:", err);
    res.status(500).json({ error: err.message || "Failed to pin note" });
  }
});

/* ------------------------ ADD COMMENT ------------------------ */
router.post("/:id/comment", async (req, res) => {
  try {
    const { createdBy, text, image } = req.body;

    if (!createdBy && (!text || !image))
      return res
        .status(400)
        .json({ error: "createdBy and text or image are required" });

    const note = await Notes.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    const newComment = {
      text,
      createdBy,
      createdAt: new Date(),
      image,
    };
    const enrichedComment = await enrichNoteComment(newComment);
    note.comments.push(newComment);
    note.totalComments = note.comments.length;
    await note.save();

    const { partner } = await getOwnerAndPartner(createdBy);

    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        NotificationMessages.Note.Comment,
        {
          noteTitle: note.title,
          commenterName: enrichedComment.createdByDetails?.name ?? "Someone",
          text,
        },
        {
          type: NotificationData.Note,
          noteId: note._id,
          isComment: true,
          image: note.image ?? undefined,
        },
        [partner.userId],
        String(note._id)
      );
    }

    res.status(201).json({
      comments: note.comments,
      totalComments: note.totalComments,
    });
  } catch (err: any) {
    console.error("Add note comment error:", err);
    res.status(500).json({ error: err.message || "Failed to add comment" });
  }
});

/* ------------------------ GET COMMENTS ------------------------ */
router.get("/:id/comments", async (req, res) => {
  try {
    const note = await Notes.findById(req.params.id).lean();
    if (!note) return res.status(404).json({ error: "Note not found" });

    const comments = await Promise.all(
      (note.comments || []).map(enrichNoteComment)
    );

    await Notes.findByIdAndUpdate(note._id, {
      $set: { totalComments: comments.length },
    });

    res.json({
      comments,
      totalComments: comments.length,
    });
  } catch (err: any) {
    console.error("Get note comments error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch comments" });
  }
});

export default router;
