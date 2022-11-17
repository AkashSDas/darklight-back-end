import { Router } from "express";

import { addContentInLessonController, createCourseLessonController, deleteContentInLessonController, deleteLessonController, getCourseController, getCoursesController, getLessonController, reorderContentController, updateContentInLessonController, updateLessonMetadataController } from "../controller/course-lesson.controller";
import { addModuleToCourseController, createCourseController, deleteCourseController, deleteCourseModuleController, getCourseMoudelController, reorderLessonsInModuleController, reorderModulesController, updateCourseMetadataController, updateCourseModuleController } from "../controller/course.controller";
import { validateResource } from "../middlewares/validate-resource";
import verifyAuth from "../middlewares/verify-auth";
import verifyCourseOwnership from "../middlewares/verify-course-ownership";
import verifyInstructor from "../middlewares/verify-instructor";
import { handleMiddlewarelError } from "../utils/handle-async";
import { sendErrorResponse } from "../utils/handle-error";
import { addContentInLessonSchema, createCourseLessonSchema, deleteContentInLessonSchema, updateContentInLessonSchema, updateLessonMetadataSchema } from "../zod-schema/course-lesson.schema";
import { addModuleToCourseSchema, deleteCourseModuleSchema, deleteCourseSchema, getCourseSchema, reorderLessonsInModuleSchema, updateCourseMetadataSchema } from "../zod-schema/course.schema";

export var router = Router();

// ==================================
// COURSE ROUTES
// ==================================

// Create course
router.post(
  "/",
  handleMiddlewarelError(verifyAuth),
  handleMiddlewarelError(verifyInstructor),
  handleMiddlewarelError(createCourseController),
  sendErrorResponse
);

// Update course metadata
router.put(
  "/:courseId/info",
  handleMiddlewarelError(verifyAuth),
  handleMiddlewarelError(verifyInstructor),
  handleMiddlewarelError(verifyCourseOwnership),
  handleMiddlewarelError(updateCourseMetadataController),
  sendErrorResponse
);

// Delete course
router.delete(
  "/:courseId",
  validateResource(deleteCourseSchema),
  handleMiddlewarelError(verifyAuth),
  handleMiddlewarelError(verifyInstructor),
  handleMiddlewarelError(verifyCourseOwnership),
  handleMiddlewarelError(deleteCourseController),
  sendErrorResponse
);

// Course
router
  .get("/all", handleMiddlewarelError(getCoursesController), sendErrorResponse)
  .get(
    "/:courseId",
    validateResource(getCourseSchema),
    handleMiddlewarelError(getCourseController),
    sendErrorResponse
  )
  .put(
    "/:courseId/reorder",
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(reorderModulesController),
    sendErrorResponse
  );

// Module
router
  .get(
    "/:courseId/:moduleId",
    handleMiddlewarelError(getCourseMoudelController),
    sendErrorResponse
  )
  .post(
    "/:courseId",
    validateResource(addModuleToCourseSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(addModuleToCourseController),
    sendErrorResponse
  )
  .put(
    "/:courseId/:moduleId",
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(updateCourseModuleController),
    sendErrorResponse
  )
  .delete(
    "/:courseId/:moduleId",
    validateResource(deleteCourseModuleSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(deleteCourseModuleController),
    sendErrorResponse
  )
  .put(
    "/:courseId/:moduleId/reorder",
    validateResource(reorderLessonsInModuleSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(reorderLessonsInModuleController),
    sendErrorResponse
  );

// Lesson
router
  .post(
    "/:courseId/:moduleId",
    validateResource(createCourseLessonSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(createCourseLessonController),
    sendErrorResponse
  )
  .get(
    "/:courseId/:moduleId/:lessonId",
    handleMiddlewarelError(getLessonController),
    sendErrorResponse
  )
  .put(
    "/:courseId/:moduleId/:lessonId/metadata",
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(updateLessonMetadataController),
    sendErrorResponse
  )
  .delete(
    "/:courseId/:moduleId/:lessonId/delete",
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(deleteLessonController)
  );

// Content
router
  .post(
    "/:courseId/:moduleId/:lessonId",
    validateResource(addContentInLessonSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(addContentInLessonController),
    sendErrorResponse
  )
  .put(
    "/:courseId/:moduleId/:lessonId",
    validateResource(updateContentInLessonSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(updateContentInLessonController),
    sendErrorResponse
  )
  .put(
    "/:courseId/:moduleId/:lessonId/reorder",
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(reorderContentController),
    sendErrorResponse
  )
  .delete(
    "/:courseId/:moduleId/:lessonId",
    validateResource(deleteContentInLessonSchema),
    handleMiddlewarelError(verifyAuth),
    handleMiddlewarelError(deleteContentInLessonController)
  );
