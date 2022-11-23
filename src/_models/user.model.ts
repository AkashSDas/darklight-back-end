import {
  getModelForClass,
  modelOptions,
  post,
  pre,
  prop,
  Severity,
} from "@typegoose/typegoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { SchemaTypes, Types } from "mongoose";
import isEmail from "validator/lib/isEmail";
import { BaseApiError } from "../_utils/error.util";
import { OAuthProvider, UserRole } from "../_utils/user.util";
import { ImageClass } from "./image.model";

class OAuthProviderClass {
  @prop({ type: SchemaTypes.String, required: true })
  id: string;

  @prop({ type: SchemaTypes.String, required: true, enum: OAuthProvider })
  provider: OAuthProvider;
}

// TODO: set size limit for tokens
/**
 * @remark since fields like email/username could be null, the unique flag
 * is not set on them
 */
@pre<UserClass>("save", async function encryptPassword(next) {
  // If password is modified then hash it
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
})
@post<UserClass>("save", function handleDuplicateError(err, user, next) {
  // Handle error due to violation of unique fields
  if (err.name == "MongoServerError" && err.code == 11000) {
    next(new BaseApiError(400, "Username OR email is already used"));
  } else next();
})
@modelOptions({
  schemaOptions: {
    timestamps: true,
    toJSON: { virtuals: true },
    typeKey: "type",
  },
  options: { allowMixed: Severity.ALLOW, customName: "-user" },
})
export class UserClass {
  // ============================
  // FIELDS
  // ============================

  @prop({
    type: SchemaTypes.String,
    trim: true,
    maxlength: [48, "Too long"],
    minlength: [6, "Too short"],
  })
  fullName?: string;

  @prop({
    type: SchemaTypes.String,
    trim: true,
    maxlength: [24, "Too long"],
    minlength: [4, "Too short"],
  })
  username?: string;

  @prop({ type: SchemaTypes.String, validate: [isEmail, "Invalid"] })
  email?: string;

  @prop({ type: SchemaTypes.Boolean, default: false, required: true })
  active: boolean;

  @prop({ type: SchemaTypes.Boolean, default: false, required: true })
  verified: boolean;

  @prop({ type: SchemaTypes.String, select: false })
  verificationToken?: string | null;

  @prop({ type: SchemaTypes.Date, select: false })
  verificationTokenExpiresAt?: Date | null;

  @prop({
    type: () => SchemaTypes.Array,
    required: true,
    default: [UserRole.STUDENT],
  })
  roles: UserRole[];

  @prop({ type: SchemaTypes.String, select: false })
  password?: string;

  @prop({ type: SchemaTypes.String, select: false })
  passwordResetToken?: string | null;

  @prop({ type: SchemaTypes.Date, select: false })
  passwordResetTokenExpiresAt?: Date | null;

  @prop({ type: () => ImageClass })
  profileImage?: ImageClass | null;

  @prop({ type: () => SchemaTypes.Array, required: true, default: [] })
  oauthProviders: OAuthProviderClass[];

  // ============================
  // INSTANCE METHODS
  // ============================

  /**
   *
   * @param pwd Password to be compared
   * @returns true if password matches, false otherwise
   */
  async verifyPassword(pwd: string): Promise<boolean> {
    return await bcrypt.compare(pwd, this.password);
  }

  /**
   * Generate a random token, hash it and set it as password reset token
   * along with its expiry date (10min from now)
   *
   * @returns the generated token
   */
  generatePasswordResetToken(): string {
    var token = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 10 minutes
    this.passwordResetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return token;
  }

  /**
   * Generate a random token, hash it and set it as verification token
   * along with its expiry date (10min from now)
   *
   * @returns the generated token
   */
  generateVerificationToken(): string {
    var token = crypto.randomBytes(32).toString("hex");

    this.verificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 10 minutes
    this.verificationTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return token;
  }

  /** Genereate access token for JWT authentication. Short duration */
  accessToken(): string {
    var payload = { _id: this._id, email: this.email };
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  /** Genereate refresh token for JWT authentication. Long duration */
  refreshToken(): string {
    var payload = { _id: this._id, email: this.email };
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  // ============================
  // STATIC METHODS
  // ============================

  // ============================
  // VRITUALS
  // ============================

  _id!: Types.ObjectId;
  /** Get transformed MongoDB `_id` */
  get id() {
    return this._id.toHexString();
  }
}

/** User Typegoose Model */
var User = getModelForClass(UserClass);
export default User;
