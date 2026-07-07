import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    hasOnboarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Applied automatically whenever a document is serialized (res.json(user)) —
// strips the password hash and the internal Cloudinary public_id (asset
// bookkeeping the client never needs) so every response matches API_SPEC.md's
// "safe user shape" without services having to remember to do it themselves.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    delete ret.avatarPublicId;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
