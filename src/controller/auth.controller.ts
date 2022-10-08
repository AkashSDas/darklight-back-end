import { Request, Response } from "express";

import { createUserService } from "../services/user.service";
import { sendResponse } from "../utils/client-response";
import logger from "../utils/logger";
import { EmailOptions, sendEmail } from "../utils/send-email";
import { ZodSignup } from "../zod-schema/auth.schema";

export async function signupController(
  req: Request<{}, {}, ZodSignup["body"]>,
  res: Response
) {
  var { fullName, username, email, password } = req.body;
  var user = await createUserService({
    fullName,
    username,
    email,
    passwordDigest: password, // it will be converted to hash in `pre` Mongoose middleware
  });

  // Send email verification link to user's email
  var token = user.getEmailVerificationToken();
  await user.save({ validateModifiedOnly: true }); // saving token info to DB

  // Doing this after the user is saved to DB because if it is done above the passwordDigest will be undefined
  // and it will give error in `pre` save hook (in the bcrypt.hash function) that
  // Error: Illegal arguments: undefined, number (undefined is the passwordDigest)
  user.passwordDigest = undefined; // remove the password digest from the response

  // URL sent to the user for verifying user's email
  var endpoint = `/api/auth/confirm-email/${token}`;
  var confirmEmailURL = `${req.protocol}://${req.get("host")}${endpoint}`;
  var opts: EmailOptions = {
    to: user.email,
    subject: "Confirm your email",
    text: `Please click on the link to confirm your email: ${confirmEmailURL}`,
    html: `Please click on the link to confirm your email: 🔗 <a href="${confirmEmailURL}">${confirmEmailURL}</a>`,
  };

  try {
    await sendEmail(opts);
    return sendResponse(res, {
      status: 200,
      msg: "Email sent successfully",
      data: { user },
    });
  } catch (error) {
    // If sending email fails then make emailVerificationToken and emailVerificationTokenExpiresAt undefined
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiresAt = undefined;
    await user.save({ validateModifiedOnly: true });

    logger.error(`Error sending email: ${error}`);
    return sendResponse(res, {
      status: 500,
      msg: "Failed to send email",
      data: { user },
    });
  }
}