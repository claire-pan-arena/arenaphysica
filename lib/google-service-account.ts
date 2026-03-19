import crypto from "crypto";

function base64url(data: string | Buffer): string {
  const b64 = Buffer.from(data).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function getServiceAccountKey(): ServiceAccountKey | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Get an access token for a user via domain-wide delegation.
 * Uses a service account to impersonate the user and access their calendar.
 */
export async function getAccessTokenForUser(userEmail: string): Promise<string | null> {
  const sa = getServiceAccountKey();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: userEmail,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signable = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signable);
  const signature = base64url(sign.sign(sa.private_key));

  const jwt = `${signable}.${signature}`;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}
