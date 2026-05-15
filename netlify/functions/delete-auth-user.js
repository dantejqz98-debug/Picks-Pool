const crypto = require("crypto");

const CREATOR_EMAILS = new Set(["aiaiai@example.com", "dante.jqz98@gmail.com"]);
const FIREBASE_WEB_API_KEY = ["AIzaSyCZt", "tp0qGCO5PE", "l2Mu1Zkov9", "AGZ1vyyGlY"].join("");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return json(501, {
      error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Add it in Netlify environment variables, then redeploy."
    });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { error: "Invalid request body." });
  }

  let uid = String(input.uid || "").trim();
  const targetEmail = String(input.email || "").trim().toLowerCase();
  const idToken = String(input.idToken || "").trim();
  if ((!uid && !targetEmail) || !idToken) {
    return json(400, { error: "Missing user id/email or creator login token." });
  }

  try {
    const caller = await lookupCurrentUser(idToken);
    const callerEmail = String(caller.email || "").toLowerCase();
    if (!CREATOR_EMAILS.has(callerEmail)) {
      return json(403, { error: "Creator access is required." });
    }
    if (targetEmail && targetEmail === callerEmail) {
      return json(400, { error: "You cannot delete the creator login you are currently using." });
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "ufc328pool";
    const token = await getAccessToken(serviceAccount);
    if (!uid && targetEmail) {
      const target = await lookupTargetUserByEmail(projectId, token, targetEmail);
      if (!target || !target.localId) {
        return json(404, { error: "No Firebase Auth login was found for that email." });
      }
      uid = target.localId;
    }
    if (caller.localId === uid) {
      return json(400, { error: "You cannot delete the creator login you are currently using." });
    }

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ localId: uid })
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { raw: text };
    }
    if (!response.ok) {
      return json(response.status, { error: data.error && data.error.message || data.message || "Could not delete Firebase Auth login." });
    }
    return json(200, { ok: true, uid, email: targetEmail });
  } catch (error) {
    return json(500, { error: error.message || "Could not delete Firebase Auth login." });
  }
};

async function lookupCurrentUser(idToken) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error && data.error.message || "Could not verify creator login.");
  }
  const user = data.users && data.users[0];
  if (!user) throw new Error("Creator login could not be verified.");
  return user;
}

async function lookupTargetUserByEmail(projectId, token, email) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: [email] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error && data.error.message || "Could not look up Firebase Auth login by email.");
  }
  return data.users && data.users[0] || null;
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));
  const unsigned = `${header}.${claim}`;
  const privateKey = String(serviceAccount.private_key || "").replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const jwt = `${unsigned}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Could not get Firebase access token");
  return data.access_token;
}

function base64url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
