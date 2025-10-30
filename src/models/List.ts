import mongoose from "mongoose";

const ListSchema = new mongoose.Schema(
  {
    image: { type: String, required: false },
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
    createdByDetails: {
      name: { type: String, required: false },
      image: { type: String, required: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Lists", ListSchema);
