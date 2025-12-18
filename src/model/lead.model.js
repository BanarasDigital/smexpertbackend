import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
    type: {
      type: String,
      enum: ["general", "follow_up", "meeting", "call", "email", "important"],
      default: "general",
    },
    status: {
      type: String,
      enum: [
        "in_progress",
        "interested",
        "not_interested",
        "follow_up",
        "converted",
        "dropped",
      ],
      default: "in_progress",
    },
     _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  }
);


const LeadSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },

    leadSource: {
      type: String,
      enum: [
        "fb",
        "ig",
        "google",
        "website",
        "referral",
        "cold_call",
        "linkedin",
        "twitter",
        "other",
      ],
      lowercase: true,
      default: "other",
    },

    segment: {
      type: String,
      enum: [
        "bank_nifty_option",
        "stock_future",
        "stock_equity",
        "commodity",
        "forex",
        "crypto",
        "mutual_funds",
        "other",
      ],
      lowercase: true,
    },

    investmentSize: {
      amount: { type: Number, min: 0 },
      currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR", "GBP"],
      },
      remark: {
        type: String,
        trim: true,
        maxlength: 500,
      },
    },

    personalInfo: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      alternatePhone: {
        type: String,
        trim: true,
      },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
      pincode: { type: String, trim: true },
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: [
        "unassigned",
        "new",
        "in_progress",
        "interested",
        "not_interested",
        "follow_up",
        "converted",
        "dropped",
      ],
      default: "new",
      lowercase: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      lowercase: true,
    },

    notes: [NoteSchema],

    followUpDate: { type: Date },
    lastContactDate: { type: Date },
    conversionDate: { type: Date },
    conversionValue: { type: Number, min: 0 },

    tags: [{ type: String, trim: true, lowercase: true }],

    customFields: { type: Map, of: mongoose.Schema.Types.Mixed },

    importBatch: { type: String, trim: true },

    isActive: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const LeadModel = mongoose.model("Lead", LeadSchema);
export default LeadModel;
