import mongoose from "mongoose";
/**
 * Store one Expo push token per userId.
 * If a user logs in on multiple devices, you can either:
 * - store multiple docs (unique index on {owner, token})
 * - or change schema to an array.
 */
const schema = new mongoose.Schema({
    owner: { type: String, required: true }, // userId (NOT "me"/"partner")
    token: { type: String, required: true },
}, { timestamps: true });
schema.index({ owner: 1, token: 1 }, { unique: true });
export default mongoose.model("Token", schema);
