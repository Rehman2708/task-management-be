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
// Multer storage
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, "/tmp"),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/\s/g, "");
            cb(null, `${Date.now()}-${safeName}`);
        },
    }),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
});
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const tempPath = req.file.path;
        const filename = req.file.filename;
        const mimeType = req.file.mimetype.toLowerCase();
        let finalPath = tempPath;
        const isVideo = mimeType.startsWith("video/");
        const isImage = mimeType.startsWith("image/");
        console.log("📌 Original file size:", req.file.size / (1024 * 1024), "MB");
        // --------------------------
        // VIDEO COMPRESSION
        // --------------------------
        if (isVideo && false) {
            console.log("🎬 Compressing video...");
            const compressedPath = path.join("/tmp", `compressed-${filename}`);
            await new Promise((resolve) => {
                ffmpeg(tempPath) // <<— USE FILE PATH, NOT STREAM
                    .inputOptions(["-y"]) // overwrite if exists
                    .videoCodec("libx264")
                    .audioCodec("aac")
                    .outputOptions([
                    "-crf 28",
                    "-preset veryfast",
                    "-b:v 1000k",
                    "-maxrate 1200k",
                    "-bufsize 2000k",
                    "-b:a 96k",
                    "-movflags +faststart",
                ])
                    .size("?720x?")
                    .on("start", (cmd) => console.log("FFmpeg Command:", cmd))
                    .on("end", () => {
                    console.log("✔ Video compression complete");
                    finalPath = compressedPath;
                    resolve();
                })
                    .on("error", (err) => {
                    console.log("❌ Video compression FAILED — using original:", err.message);
                    resolve();
                })
                    .save(compressedPath);
            });
        }
        // --------------------------
        // IMAGE COMPRESSION
        // --------------------------
        if (isImage) {
            console.log("🖼 Compressing image...");
            const compressedPath = path.join("/tmp", `compressed-${filename}`);
            try {
                await sharp(tempPath)
                    .resize({ width: 1920, withoutEnlargement: true })
                    .jpeg({ quality: 82 })
                    .toFile(compressedPath);
                finalPath = compressedPath;
                console.log("✔ Image compression complete");
            }
            catch (err) {
                console.log("❌ Image compression failed — Using original", err);
            }
        }
        // --------------------------
        // S3 UPLOAD
        // --------------------------
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
            partSize: 5 * 1024 * 1024,
            queueSize: 4,
        });
        s3Upload.on("httpUploadProgress", (p) => console.log("⬆ Upload progress:", p));
        await s3Upload.done();
        const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        const compressedSize = fs.statSync(finalPath).size;
        console.log("📌 Final uploaded file size:", compressedSize / (1024 * 1024), "MB");
        // Cleanup
        [tempPath, `/tmp/compressed-${filename}`].forEach((f) => {
            if (fs.existsSync(f))
                fs.unlinkSync(f);
        });
        return res.status(200).json({
            success: true,
            url,
            key: filename,
            type: isVideo ? "video" : isImage ? "image" : "other",
        });
    }
    catch (err) {
        console.log("Upload Error:", err);
        return res.status(500).json({ error: "Upload failed" });
    }
});
// Delete Route
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
        return res
            .status(200)
            .json({ success: true, message: "Deleted successfully", key });
    }
    catch (err) {
        console.log("Delete Error:", err);
        return res.status(500).json({ error: "Delete failed" });
    }
});
export default router;
