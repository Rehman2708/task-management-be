import mongoose, { Document } from "mongoose";

export interface IVideo extends Document {
  title: string;
  url: string;
  createdBy: string;
  createdByDetails: {
    name: string;
    image: string;
  };
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
