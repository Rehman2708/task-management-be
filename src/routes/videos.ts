import { Router, Request, Response } from "express";
import User, { IUser } from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import Video, { IVideo } from "../models/Video.js";

const router = Router();

/**
 * GET /videos/:ownerUserId
 * Query params: ?page=<number> (default 1)  ?pageSize=<number> (default 10)
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
      //   if (ownerUserId) {
      //     const owner = await User.findOne({ userId: ownerUserId }).lean<IUser>();
      //     const partnerUserId = owner?.partnerUserId;
      //     filter.createdBy = {
      //       $in: partnerUserId ? [ownerUserId, partnerUserId] : [ownerUserId],
      //     };
      //   }

      const totalCount = await Video.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / pageSize);

      const videos = await Video.find(filter)
        .sort({ pinned: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<IVideo[]>();

      // Update createdByDetails if needed
      await Promise.all(
        videos.map(async (video) => {
          const user = await User.findOne({
            userId: video.createdBy,
          }).lean<IUser>();
          if (!user) return;

          const latestDetails = {
            name: user.name,
            image: user.image || "",
          };

          if (
            !video.createdByDetails ||
            video.createdByDetails.name !== latestDetails.name ||
            video.createdByDetails.image !== latestDetails.image
          ) {
            await Video.findByIdAndUpdate(video._id, {
              createdByDetails: latestDetails,
            });
            video.createdByDetails = latestDetails;
          }
        })
      );

      res.json({ videos, totalPages, currentPage: page });
    } catch (err: any) {
      console.error("Error fetching videos:", err);
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
          { type: "video", videoData: newVideo }
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
        `${deletedVideo.title.trim()} has been deleted!`
      );
    }

    res.json({ message: "Video deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting video:", err);
    res.status(500).json({ error: err.message || "Failed to delete video" });
  }
});

export default router;
