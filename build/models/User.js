import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
    notificationToken: { type: String, required: false },
    image: { type: String, required: false },
}, { timestamps: true });
export default mongoose.model("User", UserSchema);
