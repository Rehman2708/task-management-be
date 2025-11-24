import { Router, Request, Response } from "express";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../utils/s3Clients.js";

dotenv.config();
const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Upload API working 🚀", time: new Date() });
});

router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const originalName = req.file.originalname.replace(/\s/g, "");
      const filename = `${Date.now()}-${originalName}`;
      const mimeType = req.file.mimetype.toLowerCase();

      const isVideo = mimeType.startsWith("video/");
      const isImage = mimeType.startsWith("image/");

      // Save file to /tmp
      const tempPath = path.join("/tmp", filename);
      fs.writeFileSync(tempPath, req.file.buffer);

      let finalUploadPath = tempPath;

      // -------- Video Compression --------
      if (isVideo) {
        const compressedPath = path.join("/tmp", `compressed-${filename}`);
        await new Promise((resolve) => {
          ffmpeg(tempPath)
            .videoCodec("libx264")
            .outputOptions([
              "-preset",
              "fast", // Better quality than veryfast
              "-crf",
              "23", // Balanced quality
              "-b:v",
              "1500k", // Maintain detail
              "-maxrate",
              "2000k",
              "-bufsize",
              "3000k",
              "-movflags",
              "+faststart",
            ])
            .on("end", () => {
              finalUploadPath = compressedPath;
              resolve(true);
            })
            .on("error", (err) => {
              console.log("❌ Video compression failed → using original", err);
              finalUploadPath = tempPath;
              resolve(true);
            })
            .save(compressedPath);
        });
      }

      // -------- Image Compression --------
      if (isImage) {
        const compressedPath = path.join("/tmp", `compressed-${filename}`);

        await sharp(tempPath)
          .resize({ width: 1920, withoutEnlargement: true }) // Only shrink if bigger
          .jpeg({ quality: 82 }) // High quality
          .toFile(compressedPath)
          .then(() => {
            finalUploadPath = compressedPath;
          })
          .catch((err: any) => {
            console.log("❌ Image compression failed → using original", err);
            finalUploadPath = tempPath;
          });
      }

      // Upload to S3
      const fileContent = fs.readFileSync(finalUploadPath);
      const key = filename;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: key,
          Body: fileContent,
          ContentType: mimeType,
          ContentDisposition: "inline",
        })
      );

      const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      // Remove temp files
      const tempCompressed = `/tmp/compressed-${filename}`;
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (fs.existsSync(tempCompressed)) fs.unlinkSync(tempCompressed);

      return res.status(200).json({
        success: true,
        message: "Uploaded successfully",
        url,
        key,
        filename,
        type: isVideo ? "video" : isImage ? "image" : "other",
      });
    } catch (err) {
      console.log("Upload Error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }
);

// DELETE
router.delete("/delete", async (req: Request, res: Response) => {
  try {
    const { uri } = req.query;
    if (!uri) return res.status(400).json({ error: "File URI missing" });

    const key = decodeURIComponent(uri.toString().split("/").pop()!);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
      })
    );

    return res.status(200).json({
      success: true,
      message: "Deleted successfully",
      key,
    });
  } catch (err) {
    console.log("Delete Error:", err);
    return res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
