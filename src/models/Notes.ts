import mongoose, { Document, Types } from "mongoose";
import { CommentSchema } from "./Task.js";

export interface INoteComment {
  text: string;
  createdBy: string; // userId
  createdAt: Date;
  createdByDetails?: {
    name: string;
    image?: string;
  };
}

export interface INote extends Document {
  _id: Types.ObjectId;
  image?: string;
  title: string;
  note: string;
  createdBy: string;
  pinned: boolean;
  comments: INoteComment[];
  totalComments: number;
  createdAt: Date;
  updatedAt: Date;
  createdByDetails: {
    name: string;
    image: string;
  };
}

const NoteSchema = new mongoose.Schema<INote>(
  {
    image: { type: String },
    title: { type: String, required: true },
    note: { type: String, required: true },
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

export default mongoose.model<INote>("Notes", NoteSchema);
