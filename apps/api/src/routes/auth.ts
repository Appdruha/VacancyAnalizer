import { env } from "@edagent/config";
import { database } from "@edagent/database";
import type { User } from "@edagent/domain";
import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "./types.js";

type LoginPayload = {
  email: string;
  password: string;
};

type GoogleLoginPayload = {
  idToken: string;
};

export async function handleAuthRoutes(
  context: RouteContext,
  deps: {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
    tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
    ensurePlatformBootstrap: () => Promise<void>;
    createAuditEntry: (entry: {
      actorUserId: string;
      action: string;
      entityType: string;
      entityId: string;
    }) => Promise<void>;
    createAuthSession: (user: User, provider: "local" | "google") => { token: string; expiresAt: string };
    buildGoogleAuthTestPage: () => string;
    verifyGoogleIdToken: (idToken: string) => Promise<{ email: string; fullName: string }>;
    getAuthenticatedUser: (req: RouteContext["req"]) => Promise<User | null>;
  }
): Promise<boolean> {
  const { req, res, pathname } = context;

  if (req.method === "POST" && pathname === "/auth/login") {
    const rawBody = await deps.readBody(req);
    const payload = parseJson<LoginPayload>(rawBody);
    await deps.tryDatabase(() => deps.ensurePlatformBootstrap());
    const adminUser = await deps.tryDatabase(() => database.findUserByEmail(env.ADMIN_EMAIL));

    if (!env.ADMIN_PASSWORD || !env.AUTH_TOKEN_SECRET) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "auth_not_configured",
            message: "ADMIN_PASSWORD or AUTH_TOKEN_SECRET is not configured."
          },
          503
        )
      );
      return true;
    }

    if (!payload || payload.email !== env.ADMIN_EMAIL || payload.password !== env.ADMIN_PASSWORD) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_credentials",
            message: "Email or password is incorrect."
          },
          401
        )
      );
      return true;
    }

    if (!adminUser) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "configuration_error",
            message: "Admin user is not configured."
          },
          500
        )
      );
      return true;
    }

    await deps.createAuditEntry({
      actorUserId: adminUser.id,
      action: "auth.login",
      entityType: "user",
      entityId: adminUser.id
    });

    deps.send(
      res,
      jsonResponse({
        ...deps.createAuthSession(adminUser, "local"),
        user: adminUser
      })
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/auth/google/config") {
    deps.send(
      res,
      jsonResponse({
        enabled: env.GOOGLE_AUTH_ENABLED,
        clientIdConfigured: Boolean(env.GOOGLE_CLIENT_ID),
        allowedDomain: env.GOOGLE_ALLOWED_DOMAIN || null,
        clientId: env.GOOGLE_CLIENT_ID || null
      })
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/auth/google/test-page") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(deps.buildGoogleAuthTestPage());
    return true;
  }

  if (req.method === "POST" && pathname === "/auth/google") {
    if (!env.AUTH_TOKEN_SECRET || !env.GOOGLE_AUTH_ENABLED || !env.GOOGLE_CLIENT_ID) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "google_auth_disabled",
            message: "Google auth is not enabled, GOOGLE_CLIENT_ID is missing, or AUTH_TOKEN_SECRET is not configured."
          },
          503
        )
      );
      return true;
    }

    const payload = parseJson<GoogleLoginPayload>(await deps.readBody(req));
    if (!payload?.idToken) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected idToken."
          },
          400
        )
      );
      return true;
    }

    try {
      const googleProfile = await deps.verifyGoogleIdToken(payload.idToken);
      const role: User["role"] = googleProfile.email === env.ADMIN_EMAIL ? "admin" : "operator";
      const user = await database.upsertUserByEmail({
        email: googleProfile.email,
        fullName: googleProfile.fullName,
        role
      });
      const session = deps.createAuthSession(user, "google");

      await deps.createAuditEntry({
        actorUserId: user.id,
        action: "auth.google_login",
        entityType: "user",
        entityId: user.id
      });

      deps.send(
        res,
        jsonResponse({
          ...session,
          provider: "google",
          user
        })
      );
      return true;
    } catch (error: unknown) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "google_auth_failed",
            message: error instanceof Error ? error.message : "Unknown Google auth error"
          },
          401
        )
      );
      return true;
    }
  }

  if (req.method === "GET" && pathname === "/auth/me") {
    const user = await deps.getAuthenticatedUser(req);
    if (!user) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "unauthorized",
            message: "Valid bearer token is required."
          },
          401
        )
      );
      return true;
    }

    deps.send(res, jsonResponse({ user }));
    return true;
  }

  return false;
}
