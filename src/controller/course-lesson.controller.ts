import { Request, Response } from "express";

import { createCourseLessonService, getCourseLessonService } from "../services/course-lesson.service";
import { sendResponse } from "../utils/client-response";
import { batchUpdateCourseAndLessonEditTime, validateCourseAndOwnership, validateCourseLesson } from "../utils/course";
import { BaseApiError } from "../utils/handle-error";
import { ZodAddContentInLesson, ZodCreateCourseLesson, ZodUpdateContentInLesson } from "../zod-schema/course-lesson.schema";

export async function createCourseLessonController(
  req: Request<ZodCreateCourseLesson["params"]>,
  res: Response
) {
  var course = await validateCourseAndOwnership(req, res);

  // Check if the moudle and lesson exists
  var idx = course.modules.findIndex(function findModule(m) {
    return m.id == req.params.moduleId;
  });
  if (idx == -1) throw new BaseApiError(404, "Module not found");

  // Create and save lesson, and update course module
  var lesson = await createCourseLessonService({});
  var module = course.modules[idx];
  module.lessons.push(lesson.id);
  course.modules[idx] = module;
  course.updateLastEditedOn();
  await course.save();

  return sendResponse(res, {
    status: 201,
    msg: "Lesson created successfully",
    data: { lesson },
  });
}

// =============================
// Content related controllers
// =============================

// TODO: Test batch update
export async function addContentInLessonController(
  req: Request<
    ZodAddContentInLesson["params"],
    {},
    ZodAddContentInLesson["body"]
  >,
  res: Response
) {
  var { course } = await validateCourseLesson(req, res);
  var lesson = await getCourseLessonService({ _id: req.params.lessonId });
  var { type, addAt, data } = req.body as any;

  // Check if trying to content at a valid index. If adding a new
  // content at the end, then addAt will be equal to the length of
  // the lesson contents
  if (addAt > lesson.contents.length) {
    throw new BaseApiError(400, "Add at is out of bounds");
  }

  lesson.addContent(type, addAt, data);
  await batchUpdateCourseAndLessonEditTime(lesson, course, function () {
    sendResponse(res, {
      status: 201,
      msg: "Content added to lesson successfully",
      data: { contents: lesson.contents },
    });
  });
}

export async function updateContentInLessonController(
  req: Request<
    ZodUpdateContentInLesson["params"],
    {},
    ZodUpdateContentInLesson["body"]
  >,
  res: Response
) {
  var { course } = await validateCourseLesson(req, res);
  var lesson = await getCourseLessonService({ _id: req.params.lessonId });
  var { updateAt, data } = req.body as any;

  // Check if trying to update at a valid index
  if (updateAt >= lesson.contents.length) {
    throw new BaseApiError(400, "Update at is out of bounds");
  }

  lesson.updateContent(updateAt, data);
  await batchUpdateCourseAndLessonEditTime(lesson, course, function () {
    sendResponse(res, {
      status: 200,
      msg: "Content updated in lesson successfully",
      data: { contents: lesson.contents },
    });
  });
}