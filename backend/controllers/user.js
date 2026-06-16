import bcrypt from "bcrypt";

import asyncHandler from "../libs/async-handler.js";
import { BadRequestError, NotFoundError } from "../libs/errors.js";
import User from "../models/user.js";

const SALT_ROUNDS = 10;

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.status(200).json(user);
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, profilePicture } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  user.name = name;
  if (profilePicture !== undefined) {
    user.profilePicture = profilePicture;
  }

  await user.save();

  const userData = user.toObject();
  delete userData.password;

  res.status(200).json(userData);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new BadRequestError("New password and confirm password do not match");
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new BadRequestError("Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  res.status(200).json({ message: "Password updated successfully" });
});

export { changePassword, getUserProfile, updateUserProfile };
