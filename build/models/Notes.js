import mongoose from "mongoose";
// Note Schema
const NoteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    note: { type: String, required: true },
    createdBy: { type: String, required: true }, // userId
    pinned: { type: Boolean, default: false }, // New pinned field
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
export default mongoose.model("Notes", NoteSchema);
