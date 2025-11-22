import mongoose from "mongoose";
const ListCommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
        name: { type: String, required: true },
        image: { type: String, required: false },
    },
}, { _id: true });
const ListSchema = new mongoose.Schema({
    image: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    items: [
        {
            text: { type: String, required: true },
            completed: { type: Boolean, default: false },
        },
    ],
    createdBy: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    comments: { type: [ListCommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },
    createdByDetails: {
        name: { type: String, required: true },
        image: { type: String, required: false },
    },
}, { timestamps: true });
export default mongoose.model("Lists", ListSchema);
