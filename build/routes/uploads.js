import { Router } from "express";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { Upload } from "@aws-sdk/lib-storage";
import { s3 } from "../utils/s3Clients.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
dotenv.config();
const router = Router();
// Multer storage (memory)
const upload = multer({ storage: multer.memoryStorage() });
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const originalName = req.file.originalname.replace(/\s/g, "");
        const filename = `${Date.now()}-${originalName}`;
        const mimeType = req.file.mimetype.toLowerCase();
        const isVideo = mimeType.startsWith("video/");
        const isImage = mimeType.startsWith("image/");
        // Save temporary file
        const tempPath = path.join("/tmp", filename);
        fs.writeFileSync(tempPath, req.file.buffer);
        let finalPath = tempPath;
        // ----- Video compression -----
        if (isVideo) {
            const compressedVideoPath = path.join("/tmp", `compressed-${filename}`);
            await new Promise((resolve) => {
                ffmpeg(tempPath)
                    .videoCodec("libx264")
                    .outputOptions([
                    "-preset",
                    "fast",
                    "-crf",
                    "23",
                    "-b:v",
                    "1500k",
                    "-maxrate",
                    "2000k",
                    "-bufsize",
                    "3000k",
                    "-movflags",
                    "+faststart",
                ])
                    .on("end", () => {
                    finalPath = compressedVideoPath;
                    resolve();
                })
                    .on("error", (err) => {
                    console.log("❌ Video compression failed → using original", err);
                    finalPath = tempPath;
                    resolve();
                })
                    .save(compressedVideoPath);
            });
        }
        // ----- Image compression -----
        if (isImage) {
            const compressedImagePath = path.join("/tmp", `compressed-${filename}`);
            try {
                await sharp(tempPath)
                    .resize({ width: 1920, withoutEnlargement: true })
                    .jpeg({ quality: 82 })
                    .toFile(compressedImagePath);
                finalPath = compressedImagePath;
            }
            catch (err) {
                console.log("❌ Image compression failed → using original", err);
                finalPath = tempPath;
            }
        }
        // ----- Upload to S3 using multipart -----
        const fileStream = fs.createReadStream(finalPath);
        const s3Upload = new Upload({
            client: s3,
            params: {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: filename,
                Body: fileStream,
                ContentType: mimeType,
                ContentDisposition: "inline",
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024, // 5MB chunks
            leavePartsOnError: false,
        });
        s3Upload.on("httpUploadProgress", (progress) => {
            console.log("Upload progress:", progress);
        });
        await s3Upload.done();
        const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        // Cleanup temp files
        [tempPath, `/tmp/compressed-${filename}`].forEach((f) => {
            if (fs.existsSync(f))
                fs.unlinkSync(f);
        });
        return res.status(200).json({
            success: true,
            url,
            key: filename,
            filename,
            type: isVideo ? "video" : isImage ? "image" : "other",
        });
    }
    catch (err) {
        console.log("Upload Error:", err);
        return res.status(500).json({ error: "Upload failed" });
    }
});
// DELETE route remains the same as your previous code
router.delete("/delete", async (req, res) => {
    try {
        const { uri } = req.query;
        if (!uri)
            return res.status(400).json({ error: "File URI missing" });
        const key = decodeURIComponent(uri.toString().split("/").pop());
        await s3.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        }));
        return res.status(200).json({
            success: true,
            message: "Deleted successfully",
            key,
        });
    }
    catch (err) {
        console.log("Delete Error:", err);
        return res.status(500).json({ error: "Delete failed" });
    }
});
export default router;
