import { config } from "dotenv";
import { Request } from "express";
import passport from "passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";

import { AvailableOAuthProvider } from "../models/oauth-provider.schema";
import User from "../models/user.schema";
import { BaseApiError } from "../utils/error";

if (process.env.NODE_ENV != "production") config();

/** Check if the user exists OR not. If not, create a new user else login the user. */
async function verify(
  _req: Request,
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  next: VerifyCallback
) {
  var { email, sub, email_verified } = profile._json;
  var user = await User.findOne({ email: email });

  // Login the user if the user already has an account
  if (user) return next(null, user);

  // Signup the user
  try {
    let verified =
      typeof email_verified == "boolean"
        ? email_verified
        : email_verified == "true"
        ? true
        : false;

    let newUser = await User.create({
      email,
      verified,
      active: verified,
      oauthProviders: [{ sid: sub, provider: AvailableOAuthProvider.GOOGLE }],
    });

    return next(null, newUser);
  } catch (error) {
    if (error instanceof Error || typeof error == "string") {
      return next(error, null);
    }

    throw new BaseApiError(500, "Internal Server Error");
  }
}

function googleSignupStrategy() {
  return new Strategy(
    {
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_OAUTH_SIGNUP_CALLBACK_URL,
      passReqToCallback: true,
    },
    verify
  );
}

passport.serializeUser(function serializeSignupUser(user, done) {
  done(null, (user as any)._id);
});

passport.deserializeUser(async function deserializeSignupUser(_id, done) {
  try {
    var user = await User.findOne({ _id });
  } catch (err) {
    var error = err;
  }

  done(error, user);
});

passport.use("google-signup", googleSignupStrategy());
