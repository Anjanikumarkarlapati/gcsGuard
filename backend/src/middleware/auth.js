import { OAuth2Client } from "google-auth-library";
import { GCP_MUTATIONS_ENABLED, STORAGE_PROVIDER } from "../config/gcp.js";

const client = new OAuth2Client();

const admins = () =>
  new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

export async function requireAuth(req, res, next) {
  if (process.env.AUTH_DISABLED === "true") {
    req.user = {
      email: process.env.DEV_USER_EMAIL || "dev@localhost",
      role: process.env.DEV_USER_ROLE === "viewer" ? "viewer" : "admin",
    };
    return next();
  }

  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, email_verified } = ticket.getPayload();
    if (!email || !email_verified) throw new Error("unverified email");

    // ponytail: admin = ADMIN_EMAILS allowlist; swap for a Cloud Identity
    // group lookup (storage-admins) if the list gets long.
    req.user = {
      email,
      role: admins().has(email.toLowerCase()) ? "admin" : "viewer",
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  res.status(403).json({ error: "Only storage-admins can perform this action" });
}

export function requireCloudMutationEnabled(_req, res, next) {
  if (STORAGE_PROVIDER !== "gcp") return next();
  if (!GCP_MUTATIONS_ENABLED) {
    return res.status(403).json({ error: "GCP mutations are disabled. Set GCP_ALLOW_MUTATIONS=true only when you are ready to change the selected GCP project." });
  }
  if (process.env.AUTH_DISABLED === "true") {
    return res.status(403).json({ error: "Enable Google ID-token authentication before allowing GCP mutations." });
  }
  next();
}
