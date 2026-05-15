exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL || "UFC Bros Picks <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      statusCode: 501,
      body: JSON.stringify({ error: "Missing RESEND_API_KEY" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const to = String(payload.to || "").trim().toLowerCase();
  const inviteUrl = String(payload.inviteUrl || "").trim();
  const poolName = String(payload.poolName || "UFC picks pool").trim();
  const hostName = String(payload.hostName || "A UFC Bros host").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !inviteUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing invite email or URL" }) };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${hostName} invited you to ${poolName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">You're invited to ${escapeHtml(poolName)}</h2>
          <p>${escapeHtml(hostName)} invited you to join their UFC picks pool.</p>
          <p><a href="${escapeAttr(inviteUrl)}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:bold">Create account and join pool</a></p>
          <p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(inviteUrl)}</p>
        </div>
      `
    })
  });

  const text = await response.text();
  return {
    statusCode: response.ok ? 200 : response.status,
    body: text
  };
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
