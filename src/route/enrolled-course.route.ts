import { Router } from "express";

import { buyCourseController, getEnrolledCourseController } from "../controller/enrolled-course.controller";
import verifyAuth from "../middlewares/auth.middleware";
import { validateResource } from "../middlewares/zod.middleware";
import { buyCourseSchema } from "../schema/enrolled-course.schema";
import { handleMiddlewareError } from "../utils/async.util";
import { sendErrorResponse } from "../utils/error.util";

export var router = Router();

// Buy course
router.post(
  "/buy/:courseId",
  validateResource(buyCourseSchema),
  handleMiddlewareError(verifyAuth),
  handleMiddlewareError(buyCourseController),
  sendErrorResponse
);

// Get enrolled course
router.get(
  "/:courseId",
  handleMiddlewareError(verifyAuth),
  handleMiddlewareError(getEnrolledCourseController),
  sendErrorResponse
);
