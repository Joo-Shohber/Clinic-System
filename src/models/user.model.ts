import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { Role } from "../types/enums";
import getEnv from "../config/env";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: Role;
  isEmailVerified: boolean;
  googleId?: string;
  profilePhoto: {
    url: string;
    publicId: string | null;
  };
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.PATIENT,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      sparse: true, // unique index بس لو القيمة مش null
    },
    profilePhoto: {
      type: Object,
      default: {
        url: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460__480.png",
        publicId: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Hash الـ password قبل الـ save — بس لو اتغير
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const env = getEnv();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.googleId;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
