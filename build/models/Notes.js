import mongoose from "mongoose";
import { CommentSchema } from "./Task.js";
const NoteSchema = new mongoose.Schema({
    image: { type: String },
    title: { type: String, required: true },
    note: { type: String, required: true },
    createdBy: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    comments: { type: [CommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },
    createdByDetails: {
        name: { type: String, required: true },
        image: { type: String, required: false },
    },
}, { timestamps: true });
// Performance indexes for faster queries
NoteSchema.index({ createdBy: 1 }); // User lookup
NoteSchema.index({ pinned: -1, createdAt: -1 }); // Sort optimization
export default mongoose.model("Notes", NoteSchema);
