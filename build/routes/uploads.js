import { Router } from "express";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { s3 } from "../utils/s3Clients.js";
dotenv.config();
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.get("/", (req, res) => {
    res.status(200).json({ message: "Upload API working 🚀", time: new Date() });
});
// 🔹 Upload File (Direct to S3 root)
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const ext = req.file.originalname.toLowerCase();
        let fileType;
        if (ext.match(/\.(jpg|jpeg|png|webp|gif)$/i))
            fileType = "image";
        else if (ext.match(/\.(mp4|mov|avi|mkv|webm)$/i))
            fileType = "video";
        else
            fileType = "other";
        // Fix MIME type only if required
        if (fileType === "image" && !req.file.mimetype.startsWith("image/"))
            req.file.mimetype = "image/jpeg";
        if (fileType === "video" && !req.file.mimetype.startsWith("video/"))
            req.file.mimetype = "video/mp4";
        const originalName = req.file.originalname.replace(/\s/g, "");
        const filename = `${Date.now()}-${originalName}`;
        // 🚫 Removed folder logic — file stored directly in root
        const key = filename;
        await s3.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ContentDisposition: "inline",
        }));
        const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        return res.status(200).json({
            success: true,
            message: "Uploaded successfully",
            key,
            url,
            filename,
            type: fileType,
        });
    }
    catch (err) {
        console.log("Upload Error:", err);
        return res.status(500).json({ error: "Upload failed" });
    }
});
// 🔹 Delete File
router.delete("/delete", async (req, res) => {
    try {
        const { uri } = req.query;
        if (!uri)
            return res.status(400).json({ error: "File URI missing" });
        // Extract Key (after the last slash)
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
