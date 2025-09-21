import mongoose from "mongoose";

// Note Schema
const NoteSchema = new mongoose.Schema(
  {
    image: { type: String, required: false },
    title: { type: String, required: true },
    note: { type: String, required: true },
    createdBy: { type: String, required: true }, // userId
    pinned: { type: Boolean, default: false }, // New pinned field
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notes", NoteSchema);
