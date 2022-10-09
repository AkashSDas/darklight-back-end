import { Router } from "express";

import { confirmEmailVerificationController, getEmailVerificationLinkController, loginController, signupController, testAuthController } from "../controller/auth.controller";
import { validateResource } from "../middlewares/validate-resource";
import verifyJwt from "../middlewares/verify-jwt";
import { handleMiddlewarelError } from "../utils/handle-async";
import { sendErrorResponse } from "../utils/handle-error";
import { confirmEmailVerificationSchema, getEmailVerificationLinkSchema, loginSchema, signupSchema } from "../zod-schema/auth.schema";

export var router = Router();

// Signup
router.post(
  "/signup",
  validateResource(signupSchema),
  handleMiddlewarelError(signupController),
  sendErrorResponse
);

// Email verification
router
  .post(
    "/verify-email",
    validateResource(getEmailVerificationLinkSchema),
    handleMiddlewarelError(getEmailVerificationLinkController),
    sendErrorResponse
  )
  .get(
    "/confirm-email/:token",
    validateResource(confirmEmailVerificationSchema),
    handleMiddlewarelError(confirmEmailVerificationController),
    sendErrorResponse
  );

// Login
router.post(
  "/login",
  validateResource(loginSchema),
  handleMiddlewarelError(loginController),
  sendErrorResponse
);

// Test auth
router.get(
  "/test",
  handleMiddlewarelError(verifyJwt),
  handleMiddlewarelError(testAuthController),
  sendErrorResponse
);
