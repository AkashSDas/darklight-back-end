import { object, string, TypeOf } from "zod";

import { zodUser } from "./";

// ============================================
// Schemas
// ============================================

export var signupSchema = object({
  body: object({
    fullName: zodUser.fullName,
    username: zodUser.username,
    email: zodUser.email,
    password: zodUser.password,
    confirmPassword: zodUser.confirmPassword,
  }).refine(
    function zodValidatePassword(data) {
      return data.password == data.confirmPassword;
    },
    { message: "Passwords do not match", path: ["confirmPassword"] }
  ),
});

export var getEmailVerificationLinkSchema = object({
  body: object({ email: zodUser.email }),
});

export var confirmEmailVerificationSchema = object({
  params: object({ token: string() }),
});

export var loginSchema = object({
  body: object({
    email: zodUser.email,
    password: zodUser.password,
    confirmPassword: zodUser.confirmPassword,
  }).refine(
    function zodValidatePassword(data) {
      return data.password == data.confirmPassword;
    },
    { message: "Passwords do not match", path: ["confirmPassword"] }
  ),
});

// ============================================
// Types
// ============================================

export type ZodSignup = TypeOf<typeof signupSchema>;
export type ZodGetEmailVerificationLink = TypeOf<
  typeof getEmailVerificationLinkSchema
>;
export type ZodConfirmEmailVerification = TypeOf<
  typeof confirmEmailVerificationSchema
>;
export type ZodLogin = TypeOf<typeof loginSchema>;
