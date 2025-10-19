import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

// Routes
import authRoutes from "./routes/auth.js";
import tasksRoutes from "./routes/tasks.js";
import notesRoutes from "./routes/notes.js";
import videosRoutes from "./routes/videos.js";
import notificationRoutes from "./routes/notifications.js";

// Cron job
import { initCron } from "./jobs/taskScheduler.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/couple_tasks";
await mongoose.connect(MONGODB_URI);
console.log("MongoDB connected");

// Routes
app.use("/auth", authRoutes);
app.use("/tasks", tasksRoutes);
app.use("/notes", notesRoutes);
app.use("/videos", videosRoutes);
app.use("/notifications", notificationRoutes);

// Health check
app.get("/", (_req, res) => res.json({ ok: true }));

// Start server
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  // Initialize cron job
  initCron();
  console.log("Task cron job initialized");
});
