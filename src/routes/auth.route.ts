import { Router } from "express";
import passport from "passport";

import { confirmEmailVerificationController, forgotPasswordController, getEmailVerificationLinkController, getNewAccessTokenController, loginController, logoutController, resetPasswordController, signupController, testAuthController } from "../controller/auth.controller";
import { validateResource } from "../middlewares/validate-resource";
import verifyJwt from "../middlewares/verify-jwt";
import { Strategies } from "../passport";
import { handleMiddlewarelError } from "../utils/handle-async";
import { sendErrorResponse } from "../utils/handle-error";
import { confirmEmailVerificationSchema, forgotPasswordSchema, getEmailVerificationLinkSchema, loginSchema, resetPasswordSchema, signupSchema } from "../zod-schema/auth.schema";

export var router = Router();

// Signup
router
  .post(
    "/signup",
    validateResource(signupSchema),
    handleMiddlewarelError(signupController),
    sendErrorResponse
  )
  .get(
    "/signup/google",
    passport.authenticate(Strategies.GoogleSignup, {
      scope: ["profile", "email"],
    }),
    function signupWithGoogle() {}
  )
  .get(
    "/signup/google/redirect",
    passport.authenticate(Strategies.GoogleSignup, {
      failureMessage: "Cannot signup to Google, Please try again",
      successRedirect: process.env.OAUTH_SIGNUP_SUCCESS_REDIRECT_URL,
      failureRedirect: process.env.OAUTH_SIGNUP_FAILURE_REDIRECT_URL,
    })
  )
  .get(
    "/signup/facebook",
    passport.authenticate(Strategies.FacebookSignup),
    function signupWithFacebook() {}
  )
  .get(
    "/signup/facebook/redirect",
    passport.authenticate(Strategies.FacebookSignup, {
      failureMessage: "Cannot signup to Facebook, Please try again",
      successRedirect: process.env.OAUTH_SIGNUP_SUCCESS_REDIRECT_URL,
      failureRedirect: process.env.OAUTH_SIGNUP_FAILURE_REDIRECT_URL,
    }),
    function signupWithFacebookRedirect() {}
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
router
  .post(
    "/login",
    validateResource(loginSchema),
    handleMiddlewarelError(loginController),
    sendErrorResponse
  )
  .get(
    "/login/google",
    passport.authenticate(Strategies.GoogleLogin, {
      scope: ["profile", "email"],
    }),
    function loginWithGoogle() {}
  )
  .get(
    "/login/google/redirect",
    passport.authenticate(Strategies.GoogleLogin, {
      failureMessage: "Cannot login to Google, Please try again",
      successRedirect: process.env.OAUTH_LOGIN_SUCCESS_REDIRECT_URL,
      failureRedirect: `${process.env.OAUTH_LOGIN_FAILURE_REDIRECT_URL}?info=signup-incomplete`,
    }),
    function loginWithGoogleRedirect() {}
  );

// Test auth
router.get(
  "/test",
  handleMiddlewarelError(verifyJwt),
  handleMiddlewarelError(testAuthController),
  sendErrorResponse
);

// Get new access token
router.get(
  "/access-token",
  handleMiddlewarelError(getNewAccessTokenController),
  sendErrorResponse
);

// Forgot password and reset password
router
  .post(
    "/forgot-password",
    validateResource(forgotPasswordSchema),
    handleMiddlewarelError(forgotPasswordController),
    sendErrorResponse
  )
  .post(
    "/reset-password/:token",
    validateResource(resetPasswordSchema),
    handleMiddlewarelError(resetPasswordController),
    sendErrorResponse
  );

// Logout
router.post(
  "/logout",
  handleMiddlewarelError(logoutController),
  sendErrorResponse
);
