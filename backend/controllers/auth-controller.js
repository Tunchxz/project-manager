import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { env, isEmailConfigured } from "../config/env.js";
import asyncHandler from "../libs/async-handler.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../libs/errors.js";
import { sendEmail } from "../libs/send-email.js";
import User from "../models/user.js";
import Verification from "../models/verification.js";

const SALT_ROUNDS = 10;
const VERIFICATION_TTL_MS = 60 * 60 * 1000; // 1h
const RESET_TTL_MS = 15 * 60 * 1000; // 15m
const LOGIN_TOKEN_TTL = "7d";

const signToken = (userId, purpose, expiresIn) =>
  jwt.sign({ userId, purpose }, env.JWT_SECRET, { expiresIn });

const issueVerificationEmail = async (user) => {
  await Verification.deleteMany({ userId: user._id });

  const token = signToken(user._id, "email-verification", "1h");

  await Verification.create({
    userId: user._id,
    token,
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  const link = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  return sendEmail(
    user.email,
    "Verify your email",
    `<p>Click <a href="${link}">here</a> to verify your email</p>`
  );
};

/**
 * Reads a single-purpose token and returns its matching, unexpired
 * Verification record plus the user it belongs to.
 */
const consumeToken = async (token, expectedPurpose) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (payload.purpose !== expectedPurpose) {
    throw new UnauthorizedError("Token is not valid for this action");
  }

  const verification = await Verification.findOne({
    userId: payload.userId,
    token,
  });

  if (!verification) {
    throw new UnauthorizedError("Invalid or already used token");
  }

  if (verification.expiresAt < new Date()) {
    throw new UnauthorizedError("Token expired");
  }

  const user = await User.findById(payload.userId);

  if (!user) {
    throw new UnauthorizedError();
  }

  return { user, verification };
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, name, password } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new BadRequestError("Email address already in use");
  }

  const hashPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Without an email provider configured there is no way to deliver a
  // verification link, so accounts are usable immediately. This keeps the
  // public demo working without a SendGrid key.
  const newUser = await User.create({
    email,
    password: hashPassword,
    name,
    isEmailVerified: !isEmailConfigured,
  });

  if (!isEmailConfigured) {
    return res.status(201).json({
      message: "Account created. You can sign in now.",
      requiresVerification: false,
    });
  }

  const isEmailSent = await issueVerificationEmail(newUser);

  if (!isEmailSent) {
    await User.findByIdAndDelete(newUser._id);
    throw new BadRequestError("Failed to send verification email");
  }

  res.status(201).json({
    message:
      "Verification email sent to your email. Please check and verify your account.",
    requiresVerification: true,
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  // Same message for unknown email and wrong password, so the endpoint
  // cannot be used to enumerate registered accounts.
  if (!user) {
    throw new BadRequestError("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new BadRequestError("Invalid email or password");
  }

  if (!user.isEmailVerified) {
    const existing = await Verification.findOne({ userId: user._id });

    if (!existing || existing.expiresAt <= new Date()) {
      await issueVerificationEmail(user);
    }

    throw new ForbiddenError(
      "Email not verified. Please check your email for the verification link."
    );
  }

  const token = signToken(user._id, "login", LOGIN_TOKEN_TTL);

  user.lastLogin = new Date();
  await user.save();

  const userData = user.toObject();
  delete userData.password;

  res.status(200).json({ message: "Login successful", token, user: userData });
});

/**
 * One-click sign-in for the public demo. Disabled unless ENABLE_DEMO=true.
 */
const demoLogin = asyncHandler(async (req, res) => {
  if (!env.ENABLE_DEMO) {
    throw new ForbiddenError("Demo login is not enabled");
  }

  const user = await User.findOne({ email: "demo@taskhub.dev" });

  if (!user) {
    throw new BadRequestError(
      "Demo account is not seeded. Run `npm run seed`."
    );
  }

  const token = signToken(user._id, "login", LOGIN_TOKEN_TTL);

  user.lastLogin = new Date();
  await user.save();

  const userData = user.toObject();
  delete userData.password;

  res.status(200).json({ message: "Login successful", token, user: userData });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { user, verification } = await consumeToken(
    req.body.token,
    "email-verification"
  );

  if (user.isEmailVerified) {
    throw new BadRequestError("Email already verified");
  }

  user.isEmailVerified = true;
  await user.save();
  await verification.deleteOne();

  res.status(200).json({ message: "Email verified successfully" });
});

const resetPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Always answer identically, whether or not the address is registered.
  const genericResponse = {
    message: "If that email is registered, a reset link has been sent.",
  };

  const user = await User.findOne({ email });

  if (!user || !user.isEmailVerified) {
    return res.status(200).json(genericResponse);
  }

  const existing = await Verification.findOne({ userId: user._id });

  if (existing && existing.expiresAt > new Date()) {
    return res.status(200).json(genericResponse);
  }

  if (existing) {
    await existing.deleteOne();
  }

  const token = signToken(user._id, "reset-password", "15m");

  await Verification.create({
    userId: user._id,
    token,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail(
    email,
    "Reset your password",
    `<p>Click <a href="${link}">here</a> to reset your password</p>`
  );

  res.status(200).json(genericResponse);
});

const verifyResetPasswordTokenAndResetPassword = asyncHandler(
  async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      throw new BadRequestError("Passwords do not match");
    }

    const { user, verification } = await consumeToken(token, "reset-password");

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();
    await verification.deleteOne();

    res.status(200).json({ message: "Password reset successfully" });
  }
);

export {
  demoLogin,
  loginUser,
  registerUser,
  resetPasswordRequest,
  verifyEmail,
  verifyResetPasswordTokenAndResetPassword,
};
