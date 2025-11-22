import mongoose, { Document, Types } from "mongoose";

export interface IListComment {
  text: string;
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

const ListCommentSchema = new mongoose.Schema<IListComment>(
  {
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByDetails: {
      name: { type: String, required: true },
      image: { type: String, required: false },
    },
  },
  { _id: true }
);

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
    comments: { type: [ListCommentSchema], default: [] },
    totalComments: { type: Number, default: 0 },
    createdByDetails: {
      name: { type: String, required: true },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IList>("Lists", ListSchema);
