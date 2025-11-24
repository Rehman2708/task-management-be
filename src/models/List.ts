import mongoose, { Document, Types } from "mongoose";
import { CommentSchema } from "./Task.js";

export interface IListComment {
  text?: string;
  image?: string;
  createdBy: string; // userId
  createdAt: Date;
  createdByDetails?: {
    name: string;
    image?: string;
  };
}

export interface IList extends Document {
  _id: Types.ObjectId;
  image?: string;
  title: string;
  description: string;
  items: { text: string; completed: boolean }[];
  createdBy: string;
  pinned: boolean;
  comments: IListComment[];
  totalComments: number;
  createdAt: Date;
  updatedAt: Date;
  createdByDetails: {
    name: string;
    image: string;
  };
}

const ListSchema = new mongoose.Schema<IList>(
  {
    image: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    items: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    createdBy: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    comments: { type: [CommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },
    createdByDetails: {
      name: { type: String, required: true },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IList>("Lists", ListSchema);
