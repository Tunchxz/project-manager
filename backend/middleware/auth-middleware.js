import jwt from "jsonwebtoken";

import asyncHandler from "../libs/async-handler.js";
import { UnauthorizedError } from "../libs/errors.js";
import User from "../models/user.js";

/**
 * Verifies the bearer token and attaches the user to the request.
 *
 * Every failure path returns 401. 
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    throw new UnauthorizedError();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (decoded.purpose !== "login") {
    throw new UnauthorizedError("Token is not valid for authentication");
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new UnauthorizedError();
  }

  req.user = user;
  next();
});

export default authMiddleware;
