import ActivityLog from "../models/activity.js";

const recordActivity = async (
  userId,
  action,
  resourceType,
  resourceId,
  details
) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      resourceType,
      resourceId,
      details,
    });
  } catch (error) {
    // Activity logging must never fail the request.
    console.error("Failed to record activity:", error.message);
  }
};

export { recordActivity };
