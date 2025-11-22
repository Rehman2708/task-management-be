import mongoose from "mongoose";
const NoteCommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
        name: { type: String, required: true },
        image: { type: String, required: false },
    },
}, { _id: true });
const NoteSchema = new mongoose.Schema({
    image: { type: String },
    title: { type: String, required: true },
    note: { type: String, required: true },
    createdBy: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    comments: { type: [NoteCommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },
    createdByDetails: {
        name: { type: String, required: true },
        image: { type: String, required: false },
    },
}, { timestamps: true });
export default mongoose.model("Notes", NoteSchema);
