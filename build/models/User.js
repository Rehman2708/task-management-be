import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
    notificationToken: { type: String, required: false },
    image: { type: String, required: false },
    theme: {
        dark: { type: String, required: true, default: "#3F87E9" },
        light: { type: String, required: true, default: "#6697D9" },
    },
}, { timestamps: true });
export default mongoose.model("User", UserSchema);
