import mongoose from "mongoose";
const VideoCommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
        name: { type: String, required: false },
        image: { type: String, required: false },
    },
}, { _id: true });
const VideoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    createdBy: { type: String, required: true },
    partnerWatched: { type: Boolean, required: true, default: false },
    viewedAt: { type: Date },
    createdByDetails: {
        name: { type: String, required: false },
        image: { type: String, required: false },
    },
    comments: { type: [VideoCommentSchema], default: [] },
}, { timestamps: true });
export default mongoose.model("Video", VideoSchema);
