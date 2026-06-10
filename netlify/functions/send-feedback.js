export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = env("RESEND_API_KEY");
  const from = env("FEEDBACK_FROM_EMAIL") || env("INVITE_FROM_EMAIL") || "Fight Locks Feedback <onboarding@resend.dev>";
  const to = env("FEEDBACK_TO_EMAIL") || "team@fight-locks.com";

  if (!apiKey) {
    return json({ error: "Missing RESEND_API_KEY" }, 501);
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    return json({ error: "Invalid feedback request" }, 400);
  }

  const message = String(payload.message || "").trim();
  const email = String(payload.email || payload.userEmail || "").trim();
  const userName = String(payload.userName || "").trim();
  const pageUrl = String(payload.pageUrl || "").trim();
  const poolId = String(payload.poolId || "").trim();
  const poolName = String(payload.poolName || "").trim();
  const userAgent = String(payload.userAgent || "").trim();

  if (!message) {
    return json({ error: "Feedback message is required" }, 400);
  }
  if (message.length > 1600) {
    return json({ error: "Feedback message is too long" }, 400);
  }

  const subjectName = userName || email || "Fight Locks user";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: validEmail(email) ? email : undefined,
      subject: `Fight Locks feedback from ${subjectName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">New Fight Locks Feedback</h2>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
          <hr style="border:0;border-top:1px solid #ddd;margin:18px 0">
          <p><strong>Name:</strong> ${escapeHtml(userName || "Not provided")}</p>
          <p><strong>Email:</strong> ${escapeHtml(email || "Not provided")}</p>
          <p><strong>Pool:</strong> ${escapeHtml([poolName, poolId].filter(Boolean).join(" - ") || "Not provided")}</p>
          <p><strong>Page:</strong> ${escapeHtml(pageUrl || "Not provided")}</p>
          <p style="font-size:12px;color:#555"><strong>User agent:</strong> ${escapeHtml(userAgent || "Not provided")}</p>
        </div>
      `,
      text: [
        "New Fight Locks Feedback",
        "",
        message,
        "",
        `Name: ${userName || "Not provided"}`,
        `Email: ${email || "Not provided"}`,
        `Pool: ${[poolName, poolId].filter(Boolean).join(" - ") || "Not provided"}`,
        `Page: ${pageUrl || "Not provided"}`,
        `User agent: ${userAgent || "Not provided"}`
      ].join("\n")
    })
  });

  const text = await response.text();
  if (!response.ok) {
    return json({ error: "Feedback email failed", details: text }, response.status);
  }

  return json({ ok: true });
}

function env(key) {
  try {
    if (globalThis.Netlify && Netlify.env) return Netlify.env.get(key) || "";
  } catch (error) {}
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key] || "";
  } catch (error) {}
  return "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
