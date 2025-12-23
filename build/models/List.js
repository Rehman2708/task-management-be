import mongoose from "mongoose";
import { CommentSchema } from "./Task.js";
const ListSchema = new mongoose.Schema({
    image: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: false },
    items: [
        {
            text: { type: String, required: true },
            completed: { type: Boolean, default: false },
        },
    ],
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
ListSchema.index({ createdBy: 1 }); // User lookup
ListSchema.index({ pinned: -1, createdAt: -1 }); // Sort optimization
export default mongoose.model("Lists", ListSchema);
