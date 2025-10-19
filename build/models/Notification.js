import mongoose from "mongoose";
const NotificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Object, default: {} },
    toUserIds: { type: [String], required: true }, // list of userIds that received this notification
    readBy: { type: [String], default: [] }, // userIds who have read it
}, { timestamps: true });
export default mongoose.model("Notification", NotificationSchema);
