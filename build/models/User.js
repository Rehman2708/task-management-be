import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
}, { timestamps: true });
export default mongoose.model("User", UserSchema);
