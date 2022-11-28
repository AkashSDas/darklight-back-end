import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import mongoose, { startSession } from "mongoose";

import { Course } from "../_models/course.model";
import { Lesson } from "../_models/lesson.model";
import * as z from "../_schema/course.schema";
import { CourseStage, generateContentBlock, removeLessonVideo, updateContentBlock, updateCourseCoverImage, uploadLessonVideo } from "../_utils/course.util";
import { UserRole } from "../_utils/user.util";

// ==================================
// COURSE CONTROLLERS
// ==================================

/**
 * Create a new course with the requesting user as an instructor
 * @route POST /api/course
 * @remark Whether user has instuctor's role is checked here
 *
 * Middlewares used:
 * - verifyAuth
 */
export async function createCourseController(req: Request, res: Response) {
  var user = req.user;
  if (!user.roles.includes(UserRole.TEACHER)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var course = new Course();
  course.instructors.push(user._id);
  course = await course.save();
  return res.status(201).json(course);
}

// TODO: fix setting update in the db
/**
 * Update course settings
 * @route PUT /api/course/:courseId/settings
 * @remark Verification of course ownership is done by the query for getting the course
 * @remark Mongoose omits fields that are not defined in the schema, so it's ok to pass req.body directly
 * @remark Settings that are updated are:
 * - emoji
 * - title
 * - description
 * - stage
 * - price
 * - difficulty
 * - tags
 * - faqs
 *
 * Middlewares used:
 * - verifyAuth
 */
export async function updateCourseSettingsController(
  req: Request<z.CourseSettings["params"], {}, z.CourseSettings["body"]>,
  res: Response
) {
  // This check whether the course exists and whether the user is an instructor
  var course = await Course.findOneAndUpdate(
    { _id: req.params.courseId, instructors: req.user._id },
    { $set: { ...req.body } },
    { new: true, fields: "-__v" }
  );

  if (!course) return res.status(404).json({ message: "Course not found" });
  return res.status(200).json(course);
}

/**
 * Update course cover image
 * @route PUT /api/course/:courseId/cover
 * @remark Cover image file name is `coverImage`
 * @remark Verification of course ownership is done by the query for getting the course
 *
 * Middlewares used:
 * - verifyAuth
 */
export async function updateCourseCoverController(
  req: Request<z.UpdateCourseCover["params"]>,
  res: Response
) {
  if (!req.files?.coverImage) {
    return res.status(400).json({ message: "No cover image provided" });
  }

  // Get course if it exists and user is its instructor
  var course = await Course.findOne({
    _id: req.params.courseId,
    instructors: req.user._id,
  });
  if (!course) return res.status(404).json({ message: "Course not found" });

  // Update course cover image
  var coverImage = req.files.coverImage as UploadedFile;
  var image = await updateCourseCoverImage(coverImage, course);
  course.coverImage = image;
  await course.save();
  return res.status(200).json(image);
}

/**
 * Get course by id
 * @route GET /api/course/:courseId
 * @remark Here "instructors" and "groups.lessons" are populated
 */
export async function getCourseController(
  req: Request<z.GetCourse["params"]>,
  res: Response
) {
  var course = await Course.findById(req.params.courseId).populate([
    {
      path: "instructors",
      model: "-user",
      select:
        "-__v -oauthProviders -createdAt -updatedAt -verified -active -roles +profileImage",
    },
    {
      path: "groups.lessons",
      model: "-lesson",
      select: "-__v -content -video -qna -attachements",
    },
  ]);

  if (!course) return res.status(404).json({ message: "Course not found" });
  return res.status(200).json(course);
}

/**
 * Get published courses
 * @route GET /api/course
 */
export async function getCoursesController(req: Request, res: Response) {
  const LIMIT = 2;
  var next = req.query.next as string;
  var result = await (Course as any).paginateCourse({
    query: { stage: CourseStage.PUBLISHED },
    limit: LIMIT,
    paginatedField: "updatedAt",
    next,
  });

  var populatedCourses = await Course.populate(result.results, [
    {
      path: "instructors",
      model: "-user",
      select:
        "-__v -oauthProviders -createdAt -updatedAt -verified -active -roles +profileImage",
    },
    {
      path: "groups.lessons",
      model: "-lesson",
      select: "-__v -content -video -qna -attachements",
    },
  ]);

  return res.status(200).json({
    courses: populatedCourses,
    hasPrevious: result.hasPrevious,
    hasNext: result.hasNext,
    next: result.next,
  });
}

// ==================================
// GROUP CONTROLLERS
// ==================================

/**
 * Create a new group in a course
 *
 * @route POST /api/course/:courseId/group
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function createGroupController(
  req: Request<z.CreateGroup["params"]>,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOneAndUpdate(
    { _id: req.params.courseId, instructors: user._id },
    {
      $push: {
        groups: {
          _id: new mongoose.Types.ObjectId(),
          lessons: [],
          lastEditedOn: new Date(Date.now()),
        },
      },
    },
    { new: true, fields: "-__v" }
  );

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var group = course.groups[course.groups.length - 1];
  return res.status(201).json({ group });
}

/**
 * Update a group in a course
 *
 * @route PUT /api/course/:courseId/group/:groupId
 *
 * @remark Fields that can be updated are:
 * - title
 * - description
 * - emoji
 * - lastEditedOn
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function updateGroupController(
  req: Request<z.UpdateGroup["params"], {}, z.UpdateGroup["body"]>,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOneAndUpdate(
    {
      _id: req.params.courseId,
      "groups._id": new mongoose.Types.ObjectId(req.params.groupId),
      instructors: user._id,
    },
    {
      $set: {
        "groups.$.emoji": req.body.emoji,
        "groups.$.title": req.body.title,
        "groups.$.description": req.body.description,
        "groups.$.lastEditedOn": new Date(Date.now()),
      },
    },
    { new: true, fields: "-__v" }
  );

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var group = course.groups.find((group) => group._id == req.params.groupId);
  return res.status(200).json({ group });
}

/**
 * Reorder lessons in a group
 *
 * @route PUT /api/course/:courseId/group/:groupId/reorder
 *
 * @remark Lessons are directly updated without checking if they are
 * part of the group OR not. Also it is not checked if the original lessons
 * are part of the group or not. This is done to reduce the number of requests
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function reorderLessonsController(
  req: Request<z.ReorderLessons["params"], {}, z.ReorderLessons["body"]>,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOneAndUpdate(
    {
      _id: req.params.courseId,
      "groups._id": new mongoose.Types.ObjectId(req.params.groupId),
      instructors: user._id,
    },
    { $set: { "groups.$.lessons": req.body.lessons } },
    { new: true, fields: "-__v" }
  );

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var group = course.groups.find((group) => group._id == req.params.groupId);
  return res.status(200).json({ group });
}

// ==================================
// LESSON CONTROLLERS
// ==================================

/**
 * Create a new lesson
 *
 * @route POST /api/course/:courseId/group/:groupId/lesson
 *
 * @remark Saving the lesson in the course's respective group
 * this way works. Directly updating the group like using the
 * .map method OR course.groups[idx].lessons.push(lesson._id)
 * DOES NOT WORK
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function createLessonController(
  req: Request<z.CreateLesson["params"]>,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOne({
    _id: req.params.courseId,
    instructors: user._id,
  });

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var session = await startSession();
  session.startTransaction();

  try {
    var lesson = await Lesson.create({ session });

    // Saving the lesson in the course's respective group
    // this way works. Directly updating the group like
    // using the .map method OR course.groups[idx].lessons.push(lesson._id)
    // DOES NOT WORK
    let idx = course.groups.findIndex((g) => {
      if (g._id == req.params.groupId) return true;
      return false;
    });
    let group = course.groups[idx];
    group.lessons.push(lesson._id);
    course.groups[idx] = group;

    await course.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  }

  session.endSession();
  return res.status(201).json({ lesson });
}

/**
 * Update a lesson settings
 *
 * @route PUT /api/course/:courseId/group/:groupId/lesson/:lessonId/settings
 *
 * @remark Fields that can be updated are:
 * - title
 * - emoji
 * - free
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function updateLessonSettingsController(
  req: Request<
    z.UpdateLessonSettings["params"],
    {},
    z.UpdateLessonSettings["body"]
  >,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOne({
    _id: req.params.courseId,
    instructors: user._id,
  });

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var lesson = await Lesson.findOneAndUpdate(
    { _id: req.params.lessonId },
    {
      $set: {
        emoji: req.body.emoji,
        title: req.body.title,
        lastEditedOn: new Date(Date.now()),
      },
    },
    { new: true, fields: "-__v" }
  );

  if (!lesson) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.status(200).json({ message: "Lesson updated successfully" });
}

/**
 * Upload a lesson video
 *
 * @route POST /api/course/:courseId/group/:groupId/lesson/:lessonId/video
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function updateLessonVideoController(
  req: Request<z.UpdateLessonVideo["params"]>,
  res: Response
) {
  var file = req.files?.lessonVideo as UploadedFile;
  if (!file) return res.status(400).json({ message: "No video file found" });

  var user = req.user;
  var course = await Course.findOne({
    _id: req.params.courseId,
    instructors: user._id,
  });

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var lesson = await Lesson.findOne({ _id: req.params.lessonId });
  if (!lesson) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var video = await uploadLessonVideo(file, lesson, course._id.toString());
  lesson.video = { id: video.id, URL: video.URL };
  lesson.videoDuration = video.duration;

  // Updating video duration in the course
  let idx = course.groups.findIndex((g) => {
    if (g._id == req.params.groupId) return true;
    return false;
  });
  let group = course.groups[idx];
  group.videoDuration = group.videoDuration + video.duration;
  course.groups[idx] = group;

  var session = await startSession();
  session.startTransaction();

  try {
    await lesson.save({ session });
    await course.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  }

  session.endSession();
  return res.status(200).json({ message: "Video uploaded successfully" });
}

/**
 * Remove lesson video
 *
 * @route DELETE /api/course/:courseId/group/:groupId/lesson/:lessonId/video
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function removeLessonVideoController(
  req: Request<z.UpdateLessonVideo["params"]>,
  res: Response
) {
  var user = req.user;
  var course = await Course.findOne({
    _id: req.params.courseId,
    instructors: user._id,
  });

  if (!course) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var lesson = await Lesson.findOne({ _id: req.params.lessonId });
  if (!lesson) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await removeLessonVideo(lesson);

  // Updating video duration in the course
  let idx = course.groups.findIndex((g) => {
    if (g._id == req.params.groupId) return true;
    return false;
  });
  let group = course.groups[idx];
  group.videoDuration = group.videoDuration - lesson.videoDuration;
  course.groups[idx] = group;

  lesson.video = undefined;
  lesson.videoDuration = 0;
  var session = await startSession();
  session.startTransaction();

  try {
    await lesson.save({ session });
    await course.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  }

  session.endSession();
  return res.status(200).json({ message: "Video removed successfully" });
}

// function addLessonAttachmentController() {}

// function removeLessonAttachmentController() {}

// ==================================
// CONTENT CONTROLLERS
// ==================================

/**
 * Add content to a lesson
 *
 * @route POST /api/course/:courseId/group/:groupId/lesson/:lessonId/content
 *
 * @remark Middlewares used:
 * - verifyAuth
 */
export async function createContentController(
  req: Request<z.CreateContent["params"]>,
  res: Response
) {
  var user = req.user;
  var [course, lesson] = await Promise.all([
    Course.findOne({ _id: req.params.courseId, instructors: user._id }),
    Lesson.findOne({ _id: req.params.lessonId }),
  ]);

  if (!course || !lesson) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var content = generateContentBlock(req.body.type);
  if (!content) {
    return res.status(400).json({ message: "Invalid content type" });
  }
  lesson.content.push(content);
  lesson.save();

  return res.status(201).json({ content });
}

export async function updateContentController(
  // req: Request<z.UpdateContent["params"], {}, z.UpdateContent["body"]>,
  req: Request<z.UpdateContent["params"]>,
  res: Response
) {
  var user = req.user;

  var [course, lesson] = await Promise.all([
    Course.findOne({ _id: req.params.courseId, instructors: user._id }),
    Lesson.findOne({ _id: req.params.lessonId }),
  ]);

  if (!course || !lesson) {
    return res.status(403).json({ message: "Forbidden" });
  }

  var idx = lesson.content.findIndex((c) => c.id == req.params.contentId);
  var content = lesson.content[idx];
  if (!content) {
    return res.status(404).json({ message: "Content not found" });
  }

  var updatedcontent = await updateContentBlock(
    course._id.toString(),
    lesson._id.toString(),
    content,
    req.body as any,
    req.files
  );

  var contentBlocks = lesson.content;
  contentBlocks[idx] = updatedcontent;
  lesson.content = contentBlocks;
  await lesson.save();

  return res.status(200).json({ content: updatedcontent });
}

// function removeContentController() {}

// function reorderContentController() {}
