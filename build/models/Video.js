import mongoose from "mongoose";
import { CommentSchema } from "./Task.js";
const VideoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail: { type: String, required: false },
    createdBy: { type: String, required: true },
    partnerWatched: { type: Boolean, required: true, default: false },
    isLiked: { type: Boolean, required: true, default: false },
    viewedAt: { type: Date },
    createdByDetails: {
        name: { type: String, required: false },
        image: { type: String, required: false },
    },
    comments: { type: [CommentSchema], default: [] },
}, { timestamps: true });
// Performance indexes for faster queries
VideoSchema.index({ createdBy: 1 }); // User lookup
VideoSchema.index({ partnerWatched: 1, viewedAt: 1 }); // Cleanup job
VideoSchema.index({ createdAt: -1 }); // Sort optimization
export default mongoose.model("Video", VideoSchema);
