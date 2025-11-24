import { Router } from "express";
import User from "../models/User.js";
import Video from "../models/Video.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
const router = Router();
/* ---------------------------- Helper Functions ---------------------------- */
async function enrichComment(comment) {
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
async function enrichVideo(video) {
    if (!video)
        return video;
    let modified = false;
    // 🔹 Enrich video creator details
    if (video.createdBy) {
        const user = await User.findOne({ userId: video.createdBy }).lean();
        if (user) {
            const newDetails = { name: user.name, image: user.image || "" };
            if (!video.createdByDetails ||
                video.createdByDetails.name !== newDetails.name ||
                video.createdByDetails.image !== newDetails.image) {
                video.createdByDetails = newDetails;
                modified = true;
            }
        }
    }
    // 🔹 Enrich and count comments
    if (Array.isArray(video.comments) && video.comments.length > 0) {
        const enrichedComments = await Promise.all(video.comments.map(enrichComment));
        video.comments = enrichedComments;
        video.totalComments = enrichedComments.length;
        modified = true;
    }
    else {
        video.totalComments = 0;
        modified = true;
    }
    // 🔹 Persist only if needed
    if (modified) {
        await Video.findByIdAndUpdate(video._id, {
            $set: {
                createdByDetails: video.createdByDetails,
                totalComments: video.totalComments,
                comments: video.comments,
            },
        }, { new: true });
    }
    return video;
}
/* ------------------------------- APIs ------------------------------------ */
/**
 * GET /videos/:ownerUserId?page=1&pageSize=10
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
        // remove video seen and older than 24 hrs
        // const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // await Video.deleteMany({
        //   partnerWatched: true,
        //   viewedAt: { $lte: cutoff },
        // });
        const owner = await User.findOne({ userId: ownerUserId }).lean();
        const partnerUserId = owner?.partnerUserId;
        const filter = {
            createdBy: {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            },
        };
        const totalCount = await Video.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const videoIds = (await Video.find(filter)
            .sort({ partnerWatched: 1, createdAt: -1 })
            .select("_id")
            .lean()).map((v) => v._id);
        const pagedIds = videoIds.slice((page - 1) * pageSize, page * pageSize);
        const videos = await Video.find({ _id: { $in: pagedIds } }).lean();
        const enrichedVideos = await Promise.all(videos.map(enrichVideo));
        const sortedVideos = pagedIds.map((id) => enrichedVideos.find((v) => v?._id?.equals(id)));
        res.json({ videos: sortedVideos, totalPages, currentPage: page });
    }
    catch (err) {
        console.error("Error fetching videos:", err);
        res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
});
/**
 * GET /videos/all/:ownerUserId
 */
router.get("/all/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const owner = await User.findOne({ userId: ownerUserId }).lean();
        const partnerUserId = owner?.partnerUserId;
        const filter = {
            createdBy: {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            },
        };
        const videos = await Video.find(filter, "title createdAt createdByDetails totalComments").lean();
        const enriched = await Promise.all(videos.map(enrichVideo));
        res.json({ videos: enriched });
    }
    catch (err) {
        console.error("Error fetching all videos:", err);
        res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
});
/**
 * POST /videos
 */
router.post("/", async (req, res) => {
    try {
        const { title, url, createdBy } = req.body;
        if (!title || !url || !createdBy)
            return res
                .status(400)
                .json({ error: "title, url and createdBy are required" });
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newVideo = await Video.create({
            title,
            url,
            createdBy,
            totalComments: 0,
        });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Video.Added, { videoTitle: title.trim(), ownerName: owner?.name?.trim() ?? "" }, { type: NotificationData.Video, videoData: newVideo }, [partner.userId], String(newVideo._id));
        }
        res.status(201).json(newVideo);
    }
    catch (err) {
        console.error("Error creating video:", err);
        res.status(500).json({ error: err.message || "Failed to create video" });
    }
});
/**
 * DELETE /videos/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const deletedVideo = await Video.findByIdAndDelete(req.params.id);
        if (!deletedVideo)
            return res.status(404).json({ error: "Video not found" });
        const { owner } = await getOwnerAndPartner(deletedVideo.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], NotificationMessages.Video.Deleted, { videoTitle: deletedVideo.title.trim() }, { type: NotificationData.Video }, [owner.userId], String(deletedVideo._id));
        }
        res.json({ message: "Video deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting video:", err);
        res.status(500).json({ error: err.message || "Failed to delete video" });
    }
});
/**
 * PATCH /videos/:id/viewed
 */
router.patch("/:id/viewed", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        video.partnerWatched = true;
        video.viewedAt = new Date();
        await video.save();
        const { owner } = await getOwnerAndPartner(video.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], NotificationMessages.Video.Viewed, { videoTitle: video.title }, { type: NotificationData.Video, videoData: video }, [owner.userId], String(video._id));
        }
        res.json({ message: "Video marked as viewed", video });
    }
    catch (err) {
        console.error("Error marking viewed:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to mark as viewed" });
    }
});
/**
 * POST /videos/:id/comment
 */
router.post("/:id/comment", async (req, res) => {
    try {
        const { createdBy, text } = req.body;
        if (!createdBy || !text)
            return res.status(400).json({ error: "createdBy and text are required" });
        const video = await Video.findById(req.params.id);
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        const newComment = {
            text,
            createdBy,
            createdAt: new Date(),
        };
        video.comments.push(newComment);
        video.totalComments = video.comments.length;
        await video.save();
        const enriched = await enrichComment(newComment);
        video.comments[video.comments.length - 1] = enriched;
        await video.save();
        const { partner } = await getOwnerAndPartner(createdBy);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Video.Comment, {
                videoTitle: video.title,
                commenterName: enriched.createdByDetails?.name ?? "Someone",
                text,
            }, { type: NotificationData.Video, videoData: video, isComment: true }, [partner.userId], String(video._id));
        }
        res
            .status(201)
            .json({ comments: video.comments, totalComments: video.totalComments });
    }
    catch (err) {
        console.error("Add comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
});
/**
 * GET /videos/:id/comments
 */
router.get("/:id/comments", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id).lean();
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        const comments = await Promise.all((video.comments || []).map(enrichComment));
        await Video.findByIdAndUpdate(video._id, {
            $set: { totalComments: comments.length },
        });
        res.json({ comments, totalComments: comments.length });
    }
    catch (err) {
        console.error("Get comments error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
});
export default router;
