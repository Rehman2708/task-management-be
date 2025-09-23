import mongoose, { Document, Types } from "mongoose";

export interface IVideo extends Document {
  _id: Types.ObjectId;
  title: string;
  url: string;
  createdBy: string;
  createdByDetails: {
    name: string;
    image: string;
  };
  createdAt: Date; // Add this
  updatedAt: Date; // Add this
}

const VideoSchema = new mongoose.Schema<IVideo>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
