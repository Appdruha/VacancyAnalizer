import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import type { User } from "@edagent/domain";
import { htmlPage } from "@edagent/shared";

type AuthSessionPayload = {
  sub: string;
  email: string;
  role: User["role"];
  fullName: string;
  provider: "local" | "google";
  exp: number;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  exp?: string;
  given_name?: string;
  family_name?: string;
  hd?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signAuthPayload(payload: AuthSessionPayload): string {
  if (!env.AUTH_TOKEN_SECRET) {
    throw new Error("AUTH_TOKEN_SECRET is not configured.");
  }
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", env.AUTH_TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAuthToken(token: string): AuthSessionPayload | null {
  if (!env.AUTH_TOKEN_SECRET) {
    return null;
  }
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", env.AUTH_TOKEN_SECRET).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as AuthSessionPayload;
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createAuthSession(user: User, provider: "local" | "google") {
  const expiresAt = new Date(Date.now() + env.AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const payload: AuthSessionPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    provider,
    exp: Math.floor(new Date(expiresAt).getTime() / 1000)
  };

  return {
    token: signAuthPayload(payload),
    expiresAt
  };
}

function getBearerToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getAuthenticatedUser(req: IncomingMessage): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return null;
  }

  return database.findUserByEmail(payload.email);
}

export async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  fullName: string;
}> {
  const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
  tokenInfoUrl.searchParams.set("id_token", idToken);

  const response = await fetch(tokenInfoUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Google token verification failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GoogleTokenInfo;
  if (!payload.email || payload.email_verified !== "true" || !payload.sub) {
    throw new Error("Google token payload is missing a verified email.");
  }

  if (env.GOOGLE_CLIENT_ID && payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error("Google token audience does not match GOOGLE_CLIENT_ID.");
  }

  if (env.GOOGLE_ALLOWED_DOMAIN) {
    const emailDomain = payload.email.split("@")[1]?.toLowerCase() ?? "";
    const hostedDomain = payload.hd?.toLowerCase() ?? "";
    const allowed = env.GOOGLE_ALLOWED_DOMAIN.toLowerCase();
    if (emailDomain !== allowed && hostedDomain !== allowed) {
      throw new Error("Google account domain is not allowed.");
    }
  }

  return {
    email: payload.email,
    fullName: payload.name?.trim() || payload.email.split("@")[0] || "Google User"
  };
}

export function buildGoogleAuthTestPage(): string {
  return htmlPage(
    "EdAgent Google Auth Test",
    `
      <section class="hero">
        <span class="pill">Phase 10</span>
        <h1>Google Sign-In Test</h1>
        <p>Use this page to validate Google auth against the API and obtain a bearer token for local testing.</p>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Config</h2>
          <p><strong>Enabled:</strong> ${env.GOOGLE_AUTH_ENABLED ? "yes" : "no"}</p>
          <p><strong>Client ID:</strong> ${env.GOOGLE_CLIENT_ID || "not configured"}</p>
          <p><strong>Allowed domain:</strong> ${env.GOOGLE_ALLOWED_DOMAIN || "any verified account"}</p>
          <div id="google-button" style="margin-top:16px;"></div>
        </article>

        <article class="card">
          <h2>Session</h2>
          <p id="status">Waiting for Google sign-in...</p>
          <pre id="result" style="white-space:pre-wrap;overflow:auto;background:#f0ece3;padding:12px;border-radius:12px;"></pre>
        </article>
      </section>

      <script>
        const statusNode = document.getElementById("status");
        const resultNode = document.getElementById("result");

        function showResult(label, value) {
          statusNode.textContent = label;
          resultNode.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        }

        async function handleCredentialResponse(response) {
          try {
            const apiResponse = await fetch("/auth/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ idToken: response.credential })
            });
            const payload = await apiResponse.json();
            if (!apiResponse.ok) {
              showResult("Google sign-in failed", payload);
              return;
            }
            showResult("Google sign-in succeeded", payload);
          } catch (error) {
            showResult("Google sign-in failed", { message: error instanceof Error ? error.message : "Unknown error" });
          }
        }

        window.handleCredentialResponse = handleCredentialResponse;
      </script>
      <script src="https://accounts.google.com/gsi/client" async defer onload="
        google.accounts.id.initialize({
          client_id: '${env.GOOGLE_CLIENT_ID}',
          callback: handleCredentialResponse
        });
        google.accounts.id.renderButton(
          document.getElementById('google-button'),
          { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' }
        );
      "></script>
    `
  );
}
