import { Router, Request, Response } from "express";
import User, { IUser } from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import Video, { IVideo } from "../models/Video.js";

const router = Router();

/**
 * GET /videos/:ownerUserId
 * Query params: ?page=<number> (default 1)  ?pageSize=<number> (default 10)
 * Returns paginated globally shuffled videos
 */
router.get(
  "/:ownerUserId",
  async (
    req: Request<
      { ownerUserId: string },
      any,
      any,
      { page?: string; pageSize?: string }
    >,
    res: Response
  ) => {
    try {
      const { ownerUserId } = req.params;
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const pageSize = Math.max(parseInt(req.query.pageSize || "10", 10), 1);

      const filter: Record<string, any> = {};
      if (ownerUserId) {
        const owner = await User.findOne({ userId: ownerUserId }).lean<IUser>();
        const partnerUserId = owner?.partnerUserId;
        filter.createdBy = {
          $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
        };
      }

      // Get total count
      const totalCount = await Video.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / pageSize);

      // Fetch all matching video IDs for global shuffle
      const allVideoIds = await Video.find(filter).select("_id").lean();
      const shuffledIds = allVideoIds
        .map((v) => v._id)
        .sort(() => Math.random() - 0.5);

      // Paginate the shuffled IDs
      const pagedIds = shuffledIds.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      // Fetch paginated videos
      const videos = await Video.find({ _id: { $in: pagedIds } }).lean<
        IVideo[]
      >();

      // Bulk update createdByDetails if needed
      const bulkOps = [];
      for (const video of videos) {
        const user = await User.findOne({
          userId: video.createdBy,
        }).lean<IUser>();
        if (!user) continue;

        const latestDetails = { name: user.name, image: user.image || "" };
        if (
          !video.createdByDetails ||
          video.createdByDetails.name !== latestDetails.name ||
          video.createdByDetails.image !== latestDetails.image
        ) {
          bulkOps.push({
            updateOne: {
              filter: { _id: video._id },
              update: { createdByDetails: latestDetails },
            },
          });
          video.createdByDetails = latestDetails;
        }
      }
      if (bulkOps.length > 0) await Video.bulkWrite(bulkOps);

      // Sort videos according to shuffled order
      const sortedVideos = pagedIds.map((id) =>
        videos.find((v) => v._id.equals(id))
      );

      res.json({ videos: sortedVideos, totalPages, currentPage: page });
    } catch (err: any) {
      console.error("Error fetching videos:", err);
      res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
  }
);

/**
 * GET /videos/all/:ownerUserId
 * Returns ALL shuffled videos with only title, createdAt, createdByDetails
 */
router.get(
  "/all/:ownerUserId",
  async (req: Request<{ ownerUserId: string }>, res: Response) => {
    try {
      const { ownerUserId } = req.params;

      const filter: Record<string, any> = {};
      if (ownerUserId) {
        const owner = await User.findOne({ userId: ownerUserId }).lean<IUser>();
        const partnerUserId = owner?.partnerUserId;
        filter.createdBy = {
          $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
        };
      }

      const allVideos = await Video.find(
        filter,
        "title createdAt createdByDetails"
      ).lean<Pick<IVideo, "title" | "createdAt" | "createdByDetails">[]>();

      res.json({ videos: allVideos });
    } catch (err: any) {
      console.error("Error fetching all shuffled videos:", err);
      res.status(500).json({ error: err.message || "Failed to fetch videos" });
    }
  }
);

/**
 * POST /videos
 * Body: { title: string; url: string; createdBy: string }
 */
router.post(
  "/",
  async (
    req: Request<{}, any, { title?: string; url?: string; createdBy?: string }>,
    res: Response
  ) => {
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
        await sendExpoPush(
          [partner.notificationToken],
          `Video: ${title.trim()}`,
          `${owner?.name?.trim()} added a video!`,
          { type: "video", videoData: newVideo },
          [partner?.userId]
        );
      }

      res.status(201).json(newVideo);
    } catch (err: any) {
      console.error("Error creating video:", err);
      res.status(500).json({ error: err.message || "Failed to create video" });
    }
  }
);

/**
 * DELETE /videos/:id
 */
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deletedVideo = await Video.findByIdAndDelete(req.params.id);
    if (!deletedVideo) {
      return res.status(404).json({ error: "Video not found" });
    }

    const { owner } = await getOwnerAndPartner(deletedVideo.createdBy);
    if (owner?.notificationToken) {
      await sendExpoPush(
        [owner.notificationToken],
        "Video deleted ❌",
        `${deletedVideo.title.trim()} has been deleted!`,
        undefined,
        [owner.userId]
      );
    }

    res.json({ message: "Video deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting video:", err);
    res.status(500).json({ error: err.message || "Failed to delete video" });
  }
});

export default router;
