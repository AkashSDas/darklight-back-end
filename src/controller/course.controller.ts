import { Request, Response } from "express";
import { startSession } from "mongoose";

import { UserRole } from "../models/user.model";
import { createCourseLessonService, getCourseLessonService } from "../services/course-lesson.service";
import { createCourseService, getCourseService } from "../services/course.service";
import { sendResponse } from "../utils/client-response";
import { BaseApiError } from "../utils/handle-error";
import logger from "../utils/logger";
import { ZodAddContentToCourseLesson, ZodAddLessonToCourse } from "../zod-schema/course.schema";

export async function createCourseController(req: Request, res: Response) {
  // Check if the user exists
  var user = req.user;
  if (!user) throw new BaseApiError(404, "User not found");

  // Check if the user has the required permissions
  if (!user.roles.includes(UserRole.INSTRUCTOR)) {
    throw new BaseApiError(403, "You don't have the required permissions");
  }

  // Create the course
  var course = await createCourseService({ instructors: [user._id] });
  return sendResponse(res, {
    status: 201,
    msg: "Course created successfully",
    data: { course },
  });
}

export async function addLessonToCourseController(
  req: Request<ZodAddLessonToCourse["params"]>,
  res: Response
) {
  // Check if the course exists and the user is an instructor of this course
  var user = req.user;
  if (!user) throw new BaseApiError(404, "User not found");
  var course = await getCourseService({ _id: req.params.courseId });
  if (!course) throw new BaseApiError(404, "Course not found");
  if (!course.instructors.includes(user._id)) {
    throw new BaseApiError(403, "You don't have the required permissions");
  }

  // Create a lesson and add it to the course
  var lesson = await createCourseLessonService({});
  course.lessons.push(lesson._id);
  course.updateLastEditedOn();
  await course.save();

  return sendResponse(res, {
    status: 201,
    msg: "Lesson added to course successfully",
    data: { lesson },
  });
}

export async function addContentToCourseLesson(
  req: Request<
    ZodAddContentToCourseLesson["params"],
    {},
    ZodAddContentToCourseLesson["body"]
  >,
  res: Response
) {
  // Check if the course exists and the user is an instructor of this course
  var user = req.user;
  if (!user) throw new BaseApiError(404, "User not found");
  var course = await getCourseService({ _id: req.params.courseId });
  if (!course) throw new BaseApiError(404, "Course not found");
  if (!course.instructors.includes(user._id)) {
    throw new BaseApiError(403, "You don't have the required permissions");
  }

  // Check if the lesson exists and is part of the course
  var exists = course.lessons.find(function checkLesson(lesson) {
    return lesson._id.toString() == req.params.lessonId;
  });
  if (!exists) throw new BaseApiError(404, "Lesson not found");

  // Add content to the lesson and update the lesson
  var lesson = await getCourseLessonService({ _id: req.params.lessonId });
  var { type, addAt, data } = req.body as any;
  if (addAt > lesson.contents.length) {
    throw new BaseApiError(400, "Add at is out of bounds");
  }
  lesson.addContent(type, addAt, data);

  // Update the course/lesson last edited on. Saving lesson and course together
  var session = await startSession();
  session.startTransaction();
  try {
    lesson.updateLastEditedOn();
    course.updateLastEditedOn();

    // Don't use Promise.all here because it cause the transaction to fail
    // Error - Given transaction number does not match any in-progress transactions
    await lesson.save({ session });
    await course.save({ session });
    await session.commitTransaction();

    // Return the updated lesson contents
    return sendResponse(res, {
      status: 201,
      msg: "Content added to lesson successfully",
      data: { contents: lesson.contents },
    });
  } catch (error) {
    logger.error(error);
    await session.abortTransaction();
    throw error;
  }
}
