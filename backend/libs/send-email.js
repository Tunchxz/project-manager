import sgMail from "@sendgrid/mail";

import { env, isEmailConfigured } from "../config/env.js";

if (isEmailConfigured) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

/**
 * Sends a transactional email.
 *
 * When no email provider is configured (the default for local dev and the
 * public demo) this is a no-op that reports success, so signup and password
 * reset flows stay usable without a SendGrid account.
 */
export const sendEmail = async (to, subject, html) => {
  if (!isEmailConfigured) {
    console.warn(`[email] not configured; skipping "${subject}" to ${to}`);
    return true;
  }

  try {
    await sgMail.send({
      to,
      from: `TaskHub <${env.FROM_EMAIL}>`,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending email:", error.message);
    return false;
  }
};
