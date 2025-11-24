import cron from "node-cron";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import Video from "../models/Video.js";
import { s3 } from "../utils/s3Clients.js";
export function deleteVideos() {
  cron.schedule("30 0 * * *", async () => {
    console.log("🕒 CRON: Checking for old viewed videos to delete...");

    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Find videos eligible for deletion
      const oldVideos = await Video.find({
        partnerWatched: true,
        viewedAt: { $lte: cutoff },
      }).lean();

      if (!oldVideos.length) {
        console.log("⚠️ CRON: No old viewed videos to delete");
        return;
      }

      console.log(`📌 Found ${oldVideos.length} videos to remove`);

      // Delete S3 files + DB entries
      for (const video of oldVideos) {
        try {
          if (video.url) {
            const key = decodeURIComponent(video.url.split("/").pop()!);

            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: key,
              })
            );
            console.log(`🗑️ S3 Deleted: ${key}`);
          }

          await Video.deleteOne({ _id: video._id });
          console.log(`🗑️ DB Deleted: ${video._id.toString()}`);
        } catch (err) {
          console.log("❌ Error deleting video:", video._id, err);
        }
      }

      console.log(`🏁 CRON: Completed deletion of old viewed videos`);
    } catch (err) {
      console.error("❌ CRON: Failed to remove old videos", err);
    }
  });
}
