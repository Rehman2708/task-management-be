import { Router } from "express";
import User from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import Video from "../models/Video.js";
const router = Router();
async function enrichComment(comment) {
    if (!comment?.createdBy)
        return comment;
    const user = await User.findOne({ userId: comment.createdBy }).lean();
    if (!user)
        return comment;
    comment.createdByDetails = {
        name: user.name,
        image: user.image || "",
    };
    return comment;
}
/**
 * GET /videos/:ownerUserId
 * Query params: ?page=<number> (default 1)  ?pageSize=<number> (default 10)
 * Returns paginated globally shuffled videos
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const page = Math.max(parseInt(req.query.page || "1", 10), 1);
        const pageSize = Math.max(parseInt(req.query.pageSize || "10", 10), 1);
        // Delete videos that have been viewed more than 24 hrs ago
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await Video.deleteMany({
            partnerWatched: true,
            viewedAt: { $lte: cutoff }, // older than 24 hrs
        });
        // Build filter for fetching videos
        const filter = {};
        if (ownerUserId) {
            const owner = await User.findOne({ userId: ownerUserId }).lean();
            const partnerUserId = owner?.partnerUserId;
            filter.createdBy = {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            };
        }
        // Get total count
        const totalCount = await Video.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);
        // Fetch all matching video IDs for global shuffle
        const allVideoIds = await Video.find(filter)
            .sort({ createdAt: -1 })
            .select("_id")
            .lean();
        const shuffledIds = allVideoIds.map((v) => v._id);
        // .sort(() => Math.random() - 0.5);
        // Paginate the shuffled IDs
        const pagedIds = shuffledIds.slice((page - 1) * pageSize, page * pageSize);
        // Fetch paginated videos
        const videos = await Video.find({ _id: { $in: pagedIds } }).lean();
        // Bulk update createdByDetails if needed
        const bulkOps = [];
        for (const video of videos) {
            const user = await User.findOne({
                userId: video.createdBy,
            }).lean();
            if (!user)
                continue;
            const latestDetails = { name: user.name, image: user.image || "" };
            if (!video.createdByDetails ||
                video.createdByDetails.name !== latestDetails.name ||
                video.createdByDetails.image !== latestDetails.image) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: video._id },
                        update: { createdByDetails: latestDetails },
                    },
                });
                video.createdByDetails = latestDetails;
            }
        }
        if (bulkOps.length > 0)
            await Video.bulkWrite(bulkOps);
        // Sort videos according to shuffled order
        const sortedVideos = pagedIds.map((id) => videos.find((v) => v._id.equals(id)));
        res.json({ videos: sortedVideos, totalPages, currentPage: page });
    }
    catch (err) {
        console.error("Error fetching videos:", err);
        res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
});
/**
 * GET /videos/all/:ownerUserId
 * Returns ALL shuffled videos with only title, createdAt, createdByDetails
 */
router.get("/all/:ownerUserId", async (req, res) => {
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
        const allVideos = await Video.find(filter, "title createdAt createdByDetails").lean();
        res.json({ videos: allVideos });
    }
    catch (err) {
        console.error("Error fetching all shuffled videos:", err);
        res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
});
/**
 * POST /videos
 * Body: { title: string; url: string; createdBy: string }
 */
router.post("/", async (req, res) => {
    try {
        const { title, url, createdBy } = req.body;
        if (!title || !url || !createdBy) {
            return res
                .status(400)
                .json({ error: "title, url and createdBy are required" });
        }
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newVideo = await Video.create({ title, url, createdBy });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Video: ${title.trim()}`, `${owner?.name?.trim()} added a video!`, { type: "video", videoData: newVideo }, [partner?.userId], String(newVideo._id));
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
        if (!deletedVideo) {
            return res.status(404).json({ error: "Video not found" });
        }
        const { owner } = await getOwnerAndPartner(deletedVideo.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], "Video deleted ❌", `${deletedVideo.title.trim()} has been deleted!`, undefined, [owner.userId], String(deletedVideo._id));
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
 * Marks a video as viewed by the partner
 */
router.patch("/:id/viewed", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        video.partnerWatched = true;
        video.viewedAt = new Date(); // <-- mark viewed time
        await video.save();
        const { owner } = await getOwnerAndPartner(video.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], "Video Viewed ✅", `Your video "${video.title}" has been viewed!`, { type: "video", videoData: video }, [owner.userId], String(video._id));
        }
        res.json({ message: "Video marked as viewed", video });
    }
    catch (err) {
        console.error("Error marking video as viewed:", err);
        res
            .status(500)
            .json({ error: err.message || "Failed to mark video as viewed" });
    }
});
/**
 * POST /videos/:id/comment
 * Body: { createdBy: string, text: string }
 */
router.post("/:id/comment", async (req, res) => {
    try {
        const { createdBy, text } = req.body;
        if (!createdBy || !text) {
            return res.status(400).json({ error: "createdBy and text are required" });
        }
        const video = await Video.findById(req.params.id);
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        // Create new comment
        const newComment = {
            text,
            createdBy,
            createdAt: new Date(),
        };
        // Add to video
        video.comments.push(newComment);
        await video.save();
        // Enrich the last added comment with user details
        const enrichedComment = await enrichComment(newComment);
        video.comments[video.comments.length - 1] = enrichedComment;
        // Save again if needed (optional, but ensures createdByDetails is stored)
        await video.save();
        // Notify partner if exists
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], `Comment on video: ${video.title}`, `${enrichedComment.createdByDetails?.name || "Someone"} commented: "${text}"`, { type: "video", videoData: video }, [partner.userId], String(video._id));
        }
        // Send enriched comments back
        res.status(201).json({ comments: video.comments });
    }
    catch (err) {
        console.error("Add video comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
});
/**
 * GET /videos/:id/comments
 * Returns all comments for a video
 */
router.get("/:id/comments", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id).lean();
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        const commentsArray = video.comments || []; // <-- fix here
        const comments = await Promise.all(commentsArray.map(enrichComment));
        res.json({ comments });
    }
    catch (err) {
        console.error("Get video comments error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
});
export default router;
