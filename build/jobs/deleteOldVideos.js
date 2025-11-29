import cron from "node-cron";
import Video from "../models/Video.js";
import { deleteFromS3 } from "../routes/uploads.js";
export function deleteVideos() {
    cron.schedule("30 0 * * *", async () => {
        console.log("🕒 CRON: Checking for old viewed videos to delete...");
        try {
            const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
            const oldVideos = await Video.find({
                partnerWatched: true,
                isLiked: false,
                viewedAt: { $lte: cutoff },
            }).lean();
            if (!oldVideos.length) {
                console.log("⚠️ CRON: No old viewed videos to delete");
                return;
            }
            console.log(`📌 Found ${oldVideos.length} videos to remove`);
            for (const video of oldVideos) {
                try {
                    // Delete main video
                    if (video.url) {
                        await deleteFromS3(video.url);
                    }
                    // Delete thumbnail
                    if (video.thumbnail) {
                        await deleteFromS3(video.thumbnail);
                    }
                    // Delete DB record
                    await Video.deleteOne({ _id: video._id });
                    console.log(`🗑️ DB Deleted: ${video._id}`);
                }
                catch (err) {
                    console.error(`❌ Error deleting video ${video._id}:`, err);
                }
            }
            console.log("🏁 CRON: Completed deletion of old viewed videos");
        }
        catch (err) {
            console.error("❌ CRON: Failed to remove old videos", err);
        }
    });
}
