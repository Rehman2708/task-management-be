import mongoose, { Document, Types } from "mongoose";

export interface IVideo extends Document {
  _id: Types.ObjectId;
  title: string;
  url: string;
  createdBy: string;
  partnerWatched: boolean;
  viewedAt?: Date;
  createdByDetails: {
    name: string;
    image: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new mongoose.Schema<IVideo>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    createdBy: { type: String, required: true },
    partnerWatched: { type: Boolean, required: true, default: false },
    viewedAt: { type: Date },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
