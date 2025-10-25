import mongoose from "mongoose";
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
}, { timestamps: true });
export default mongoose.model("Video", VideoSchema);
