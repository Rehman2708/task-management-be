import mongoose from "mongoose";
const NotificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Object, default: {} },
    toUserIds: { type: [String], required: true }, // list of userIds that received this notification
    readBy: { type: [String], default: [] }, // userIds who have read it
    groupId: { type: String, required: false }, // for grouping related notifications
}, { timestamps: true });
// Performance indexes for faster queries
NotificationSchema.index({ toUserIds: 1, createdAt: -1 }); // User notifications
NotificationSchema.index({ groupId: 1, createdAt: -1 }); // Grouped notifications
NotificationSchema.index({ createdAt: 1 }); // Cleanup job
export default mongoose.model("Notification", NotificationSchema);
