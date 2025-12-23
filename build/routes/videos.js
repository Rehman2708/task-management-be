import { Router } from "express";
import User from "../models/User.js";
import Video from "../models/Video.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
import { deleteFromS3 } from "./uploads.js";
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
 * GET /videos/:ownerUserId?page=1&pageSize=10 - OPTIMIZED
 */
router.get("/:ownerUserId", async (req, res) => {
    try {
        const { ownerUserId } = req.params;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
        const owner = await User.findOne({ userId: ownerUserId }).lean();
        const partnerUserId = owner?.partnerUserId;
        const filter = {
            createdBy: {
                $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
            },
        };
        // Run count and find queries in parallel for better performance
        const [totalCount, videos] = await Promise.all([
            Video.countDocuments(filter),
            Video.find(filter)
                .sort({ partnerWatched: 1, createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .lean(),
        ]);
        const totalPages = Math.ceil(totalCount / pageSize);
        // Batch enrich videos
        const enrichedVideos = await Promise.all(videos.map(enrichVideo));
        // Set cache headers
        res.set({
            "Cache-Control": "private, max-age=120", // Cache for 2 minutes
            ETag: `"videos-${ownerUserId}-${page}-${totalCount}"`,
        });
        res.json({ videos: enrichedVideos, totalPages, currentPage: page });
    }
    catch (err) {
        console.error("Error fetching videos:", err);
        res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
});
/**
 * GET /videos/video/:videoId
 */
router.get("/video/:videoId", async (req, res) => {
    try {
        const { videoId } = req.params;
        // Fetch raw video
        const video = await Video.findById(videoId).lean();
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        // Enrich video just like list API
        const enrichedVideo = await enrichVideo(video);
        res.json({ video: enrichedVideo });
    }
    catch (err) {
        console.error("Error fetching video:", err);
        res.status(500).json({
            error: err.message || "Failed to fetch video",
        });
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
        const { title, url, createdBy, thumbnail } = req.body;
        if (!title || !url || !createdBy)
            return res
                .status(400)
                .json({ error: "title, url and createdBy are required" });
        const { owner, partner } = await getOwnerAndPartner(createdBy);
        const newVideo = await Video.create({
            title,
            url,
            thumbnail,
            createdBy,
            totalComments: 0,
            createdByDetails: { name: owner?.name, image: owner?.image },
        });
        if (partner?.notificationToken) {
            await sendExpoPush([partner.notificationToken], NotificationMessages.Video.Added, { videoTitle: title.trim(), ownerName: owner?.name?.trim() ?? "" }, {
                type: NotificationData.Video,
                videoData: newVideo,
                image: newVideo.thumbnail ?? undefined,
            }, [partner.userId], String(newVideo._id));
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
        if (deletedVideo?.url) {
            deleteFromS3(deletedVideo.url);
        }
        if (deletedVideo?.thumbnail) {
            deleteFromS3(deletedVideo.thumbnail);
        }
        if (!deletedVideo)
            return res.status(404).json({ error: "Video not found" });
        const { owner } = await getOwnerAndPartner(deletedVideo.createdBy);
        if (owner?.notificationToken) {
            await sendExpoPush([owner.notificationToken], NotificationMessages.Video.Deleted, { videoTitle: deletedVideo.title.trim() }, {
                type: NotificationData.Video,
                image: deletedVideo.thumbnail ?? undefined,
            }, [owner.userId], String(deletedVideo._id));
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
            await sendExpoPush([owner.notificationToken], NotificationMessages.Video.Viewed, { videoTitle: video.title }, {
                type: NotificationData.Video,
                videoData: video,
                image: video.thumbnail ?? undefined,
            }, [owner.userId], String(video._id));
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
 * PATCH /videos/:id/like
 */
router.patch("/:id/like", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        video.isLiked = !video.isLiked;
        if (!video.partnerWatched) {
            video.partnerWatched = true;
        }
        await video.save();
        return res.json({
            message: `Video ${video.isLiked ? "liked" : "unliked"}`,
            video,
        });
    }
    catch (err) {
        console.error("Error marking like:", err);
        return res
            .status(500)
            .json({ error: err.message || "Failed to toggle like" });
    }
});
/**
 * POST /videos/:id/comment - OPTIMIZED
 */
router.post("/:id/comment", async (req, res) => {
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
        const video = await Video.findByIdAndUpdate(req.params.id, {
            $push: { comments: newComment },
            $inc: { totalComments: 1 },
            $set: { partnerWatched: true }, // Mark as watched when commenting
        }, {
            new: true,
            select: "comments totalComments title thumbnail _id", // Only select needed fields
        });
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        // Send response immediately
        res.status(201).json({
            comments: video.comments,
            totalComments: video.totalComments,
        });
        // Handle enrichment and notifications asynchronously (fire and forget)
        setImmediate(async () => {
            try {
                const enriched = await enrichComment(newComment);
                // Update the last comment with enriched data (since it's the newest one)
                await Video.findByIdAndUpdate(req.params.id, {
                    $set: { [`comments.${video.comments.length - 1}`]: enriched },
                });
                const { partner } = await getOwnerAndPartner(createdBy);
                if (partner?.notificationToken) {
                    await sendExpoPush([partner.notificationToken], NotificationMessages.Video.Comment, {
                        videoTitle: video.title,
                        commenterName: enriched.createdByDetails?.name ?? "Someone",
                        text,
                    }, {
                        type: NotificationData.Video,
                        videoData: video,
                        isComment: true,
                        image: image ?? video.thumbnail ?? undefined,
                    }, [partner.userId], String(video._id));
                }
            }
            catch (notifErr) {
                console.error("Video notification error:", notifErr);
            }
        });
    }
    catch (err) {
        console.error("Add video comment error:", err);
        res.status(500).json({ error: err.message || "Failed to add comment" });
    }
});
/**
 * GET /videos/:id/comments - OPTIMIZED
 */
router.get("/:id/comments", async (req, res) => {
    try {
        // Only select comments and totalComments fields for better performance
        const video = await Video.findById(req.params.id)
            .select("comments totalComments")
            .lean();
        if (!video)
            return res.status(404).json({ error: "Video not found" });
        // Set cache headers for better performance
        res.set({
            "Cache-Control": "private, max-age=30", // Cache for 30 seconds
            ETag: `"${video._id}-${video.comments?.length || 0}"`,
        });
        const comments = await Promise.all((video.comments || []).map(enrichComment));
        // Only update totalComments if it's different (avoid unnecessary writes)
        if (video.totalComments !== comments.length) {
            setImmediate(async () => {
                try {
                    await Video.findByIdAndUpdate(video._id, {
                        $set: { totalComments: comments.length },
                    });
                }
                catch (updateErr) {
                    console.error("Update totalComments error:", updateErr);
                }
            });
        }
        res.json({ comments, totalComments: comments.length });
    }
    catch (err) {
        console.error("Get video comments error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch comments" });
    }
});
export default router;
