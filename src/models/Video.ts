import mongoose, { Document, Types } from "mongoose";
import { CommentSchema } from "./Task.js";

export interface IVideoComment {
  text?: string;
  image?: string;
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
  isLiked: boolean;
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

const VideoSchema = new mongoose.Schema<IVideo>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    createdBy: { type: String, required: true },
    partnerWatched: { type: Boolean, required: true, default: false },
    isLiked: { type: Boolean, required: true, default: false },
    viewedAt: { type: Date },
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
