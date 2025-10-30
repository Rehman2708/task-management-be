import mongoose, { Document, Types } from "mongoose";

export interface IVideoComment {
  text: string;
  createdBy: string; // userId
  createdAt: Date;
  createdByDetails?: {
    name: string;
    image?: string;
  };
}

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
  comments: IVideoComment[];
  createdAt: Date;
  updatedAt: Date;
  totalComments: number;
}

const VideoCommentSchema = new mongoose.Schema<IVideoComment>(
  {
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
  },
  { _id: true }
);

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
    comments: { type: [VideoCommentSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
