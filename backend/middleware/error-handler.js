import mongoose from "mongoose";
import { AppError } from "../libs/errors.js";

/**
 * Centralized error handler.
 *
 * Translates the error types the app actually produces into correct status
 * codes, instead of collapsing everything into a 500.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Malformed ObjectId, bad date, etc.
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Duplicate key
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Resource already exists" });
  }

  if (err?.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  if (err?.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  return res.status(500).json({ message: "Internal server error" });
};

export default errorHandler;
