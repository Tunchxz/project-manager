import { createCookieSessionStorage, redirect } from "react-router";

import type { User } from "@/types";

/**
 * Server-side session for the BFF.
 *
 * The browser only ever receives this cookie: signed, httpOnly and
 * first-party to the frontend origin. The API's JWT is stored inside it and
 * never reaches client JavaScript, so an XSS cannot exfiltrate it.
 */

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET is not set. Generate one with: openssl rand -base64 48"
  );
}

type SessionData = {
  token: string;
  user: User;
};

type SessionFlashData = {
  error: string;
};

const storage = createCookieSessionStorage<SessionData, SessionFlashData>({
  cookie: {
    name: "__taskhub_session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, matching the API token's lifetime
    secrets: [sessionSecret],
  },
});

export const getSession = (request: Request) =>
  storage.getSession(request.headers.get("Cookie"));

/** Starts a session and redirects, in one step. */
export const createUserSession = async (
  token: string,
  user: User,
  redirectTo: string
) => {
  const session = await storage.getSession();
  session.set("token", token);
  session.set("user", user);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  });
};

export const destroyUserSession = async (
  request: Request,
  redirectTo = "/sign-in"
) => {
  const session = await getSession(request);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  });
};

/** The API token, for server-side calls. */
export const getToken = async (request: Request): Promise<string | null> => {
  const session = await getSession(request);
  return session.get("token") ?? null;
};

export const getOptionalUser = async (
  request: Request
): Promise<User | null> => {
  const session = await getSession(request);
  const user = session.get("user");
  const token = session.get("token");
  return user && token ? user : null;
};

/**
 * Guards a route. Redirects to sign-in before any HTML is rendered, rather
 * than flashing a loading state and redirecting on the client.
 */
export const requireUser = async (request: Request): Promise<User> => {
  const user = await getOptionalUser(request);

  if (!user) {
    const url = new URL(request.url);
    const params = new URLSearchParams({
      redirectTo: `${url.pathname}${url.search}`,
    });
    throw redirect(`/sign-in?${params}`);
  }

  return user;
};

export const commitSession = storage.commitSession;
