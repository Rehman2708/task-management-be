import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import compression from "compression";
import rateLimit from "express-rate-limit";
// Routes
import authRoutes from "./routes/auth.js";
import tasksRoutes from "./routes/tasks.js";
import notesRoutes from "./routes/notes.js";
import videosRoutes from "./routes/videos.js";
import notificationRoutes from "./routes/notifications.js";
import serverRoutes from "./routes/server.js";
import listsRoutes from "./routes/lists.js";
import uploadRoutes from "./routes/uploads.js";
// Cron jobs
import { initCron } from "./jobs/taskScheduler.js";
import { deleteVideos } from "./jobs/deleteOldVideos.js";
const app = express();
// Performance middleware
app.use(compression()); // Compress responses (70-80% smaller)
// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increased limit for file uploads
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// MongoDB connection with optimized pool settings
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/couple_tasks";
await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10, // Maximum number of connections
    minPoolSize: 5, // Minimum number of connections
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    serverSelectionTimeoutMS: 5000, // How long to try selecting a server
});
console.log("MongoDB connected with optimized pool settings");
// Routes
app.use("/auth", authRoutes);
app.use("/tasks", tasksRoutes);
app.use("/notes", notesRoutes);
app.use("/videos", videosRoutes);
app.use("/notifications", notificationRoutes);
app.use("/server", serverRoutes);
app.use("/lists", listsRoutes);
app.use("/file", uploadRoutes);
// Health check
app.get("/", (_req, res) => res.json({ ok: true }));
// Start server
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    // Initialize cron jobs
    initCron();
    deleteVideos();
    console.log("Cron jobs initialized: tasks, video cleanup");
});
