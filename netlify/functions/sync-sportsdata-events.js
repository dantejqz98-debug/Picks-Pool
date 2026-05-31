const crypto = require("crypto");

const SOURCE = "SportsDataIO";
const DEFAULT_SEASON = String(new Date().getFullYear());
const DEFAULT_LEAGUE = "ufc";

exports.config = {
  schedule: "15 10 * * *"
};

exports.handler = async function(event) {
  if (event.httpMethod && !["GET", "POST", "SCHEDULED"].includes(event.httpMethod)) {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.SPORTSDATAIO_MMA_KEY || process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey) {
    return json(501, {
      error: "Missing SPORTSDATAIO_MMA_KEY. Add the SportsDataIO MMA key in Netlify environment variables, then redeploy."
    });
  }

  try {
    const body = parseBody(event.body);
    const season = String(body.season || event.queryStringParameters?.season || process.env.SPORTSDATAIO_MMA_SEASON || DEFAULT_SEASON);
    const league = String(body.league || event.queryStringParameters?.league || process.env.SPORTSDATAIO_MMA_LEAGUE || DEFAULT_LEAGUE);
    const publishWindowDays = parseInt(body.days || event.queryStringParameters?.days || process.env.SPORTSDATAIO_MMA_SYNC_DAYS || "90", 10);
    const schedule = await fetchSportsDataSchedule(apiKey, league, season);
    const upcoming = schedule.filter((item) => shouldImportEvent(item, publishWindowDays)).slice(0, 12);
    const details = await Promise.all(upcoming.map((item) => fetchSportsDataEvent(apiKey, item.EventId || item.EventID || item.EventID || item.Id || item.id).catch(() => item)));
    const events = details.map(normalizeSportsDataEvent).filter(Boolean);
    const payload = {
      source: SOURCE,
      season,
      league,
      importedAt: new Date().toISOString(),
      importedCount: events.length,
      events
    };

    if ((event.scheduled || event.httpMethod === "SCHEDULED") && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      await saveEventsToFirestore(payload);
      payload.savedToFirebase = true;
    }

    return json(200, payload);
  } catch (error) {
    return json(500, { error: error.message || "Could not sync SportsDataIO events" });
  }
};

function parseBody(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

async function fetchSportsDataSchedule(apiKey, league, season) {
  const customUrl = process.env.SPORTSDATAIO_MMA_SCHEDULE_URL;
  const url = customUrl || `https://api.sportsdata.io/v3/mma/scores/json/Schedule/${encodeURIComponent(league)}/${encodeURIComponent(season)}`;
  const data = await fetchSportsData(url, apiKey);
  return Array.isArray(data) ? data : [];
}

async function fetchSportsDataEvent(apiKey, eventId) {
  if (!eventId) return null;
  const customTemplate = process.env.SPORTSDATAIO_MMA_EVENT_URL_TEMPLATE;
  const url = customTemplate
    ? customTemplate.replace("{eventId}", encodeURIComponent(eventId))
    : `https://api.sportsdata.io/v3/mma/scores/json/Event/${encodeURIComponent(eventId)}`;
  return fetchSportsData(url, apiKey);
}

async function fetchSportsData(url, apiKey) {
  const nextUrl = new URL(url);
  if (!nextUrl.searchParams.has("key")) nextUrl.searchParams.set("key", apiKey);
  const response = await fetch(nextUrl, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text || "null");
  } catch (_) {
    throw new Error("SportsDataIO returned a response that was not JSON.");
  }
  if (!response.ok) {
    throw new Error((data && (data.Message || data.message || data.error)) || "SportsDataIO request failed.");
  }
  return data;
}

function shouldImportEvent(event, days) {
  if (!event) return false;
  const status = String(event.Status || event.status || "").toLowerCase();
  if (["final", "canceled", "cancelled"].includes(status)) return false;
  const when = event.DateTime || event.Day || event.StartDate || event.Date || "";
  if (!when) return true;
  const dt = new Date(when);
  if (isNaN(dt.getTime())) return true;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + Math.max(1, days || 90) * 24 * 60 * 60 * 1000);
  return dt >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) && dt <= windowEnd;
}

function normalizeSportsDataEvent(event) {
  if (!event) return null;
  const sourceEventId = event.EventId || event.EventID || event.Id || event.id;
  const name = event.Name || event.ShortName || event.EventName || `UFC Event ${sourceEventId || ""}`.trim();
  const eventId = `sportsdata-${slug(name || sourceEventId || Date.now())}`;
  const fights = Array.isArray(event.Fights) ? event.Fights : [];
  const normalizedFights = fights
    .slice()
    .filter(shouldImportFight)
    .sort((a, b) => numeric(a.Order, 999) - numeric(b.Order, 999))
    .map((fight, index) => normalizeSportsDataFight(fight, index, eventId))
    .filter(Boolean);
  const dt = event.DateTime || event.Day || event.StartDate || "";
  const date = dt ? new Date(dt) : null;
  return {
    eventId,
    eventName: name,
    eventLabel: event.ShortName || name,
    eventDate: formatEventDate(date, event.Day || dt),
    eventTime: formatEventTime(date),
    eventTimeZone: "ET",
    venue: event.Venue || "",
    location: event.Location || "",
    eventStatus: "draft",
    startPoolHidden: true,
    importedFrom: SOURCE,
    sourceEventId: String(sourceEventId || ""),
    sourceStatus: event.Status || "",
    sourceDateTime: dt || "",
    sourceUpdatedAt: new Date().toISOString(),
    fights: normalizedFights
  };
}

function shouldImportFight(fight) {
  if (!fight) return false;
  const status = String(fight.Status || fight.status || fight.FightStatus || "").toLowerCase();
  const canceledStatuses = ["canceled", "cancelled", "scratched", "postponed", "removed", "off", "deleted"];
  if (canceledStatuses.some((value) => status.includes(value))) return false;
  if (fight.Active === false || fight.IsCanceled === true || fight.Cancelled === true || fight.Canceled === true) return false;
  return true;
}

function normalizeSportsDataFight(fight, index, eventId) {
  const fighters = Array.isArray(fight.Fighters) ? fight.Fighters.filter((f) => f && f.Active !== false) : [];
  const a = fighters[0] || fight.FighterA || {};
  const b = fighters[1] || fight.FighterB || {};
  const f1 = fighterName(a) || fight.FighterAName || "";
  const f2 = fighterName(b) || fight.FighterBName || "";
  if (!f1 || !f2) return null;
  return {
    id: `sdio-${eventId}-${fight.FightId || fight.FightID || index + 1}`,
    sec: cardSegment(fight.CardSegment),
    w: fight.WeightClass || "Fight",
    f1,
    f2,
    img1: fighterImageUrl(a),
    img2: fighterImageUrl(b),
    fighterId1: String(a.FighterId || a.FighterID || a.GlobalFighterID || ""),
    fighterId2: String(b.FighterId || b.FighterID || b.GlobalFighterID || ""),
    nickname1: a.Nickname || "",
    nickname2: b.Nickname || "",
    r1: fighterRecord(a),
    r2: fighterRecord(b),
    o1: numeric(a.Moneyline ?? fight.FighterAMoneyline, -110),
    o2: numeric(b.Moneyline ?? fight.FighterBMoneyline, -110),
    status: fight.Status || "Scheduled",
    rounds: numeric(fight.Rounds, index === 0 ? 5 : 3),
    sourceFightId: String(fight.FightId || fight.FightID || ""),
    sourceOrder: numeric(fight.Order, index + 1)
  };
}

function fighterName(fighter) {
  return [fighter.FirstName, fighter.LastName].filter(Boolean).join(" ").trim() || fighter.Name || "";
}

function fighterImageUrl(fighter) {
  const candidates = [
    "HeadshotUrl",
    "HeadshotURL",
    "PhotoUrl",
    "PhotoURL",
    "ImageUrl",
    "ImageURL",
    "PlayerHeadshotUrl",
    "PlayerHeadshotURL",
    "FighterHeadshotUrl",
    "FighterHeadshotURL",
    "ProfileImageUrl",
    "ProfileImageURL"
  ];
  for (const key of candidates) {
    const value = fighter && fighter[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
  }
  return "";
}

function fighterRecord(fighter) {
  const wins = numeric(fighter.PreFightWins, null);
  const losses = numeric(fighter.PreFightLosses, null);
  const draws = numeric(fighter.PreFightDraws, 0);
  if (wins === null || losses === null) return "";
  return `${wins}-${losses}${draws ? `-${draws}` : ""}`;
}

function cardSegment(value) {
  value = String(value || "").toLowerCase();
  if (value.includes("early")) return "early";
  if (value.includes("prelim")) return "prelim";
  return "main";
}

function numeric(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function formatEventDate(date, fallback) {
  if (date && !isNaN(date.getTime())) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return fallback ? String(fallback) : "";
}

function formatEventTime(date) {
  if (!(date && !isNaN(date.getTime()))) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function slug(value) {
  return String(value || "event")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "event";
}

async function saveEventsToFirestore(payload) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "ufc328pool";
  const token = await getAccessToken(serviceAccount);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/siteGlobals/sportsDataEvents`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(payload) })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not save SportsDataIO event drafts to Firestore: ${text}`);
  }
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));
  const unsigned = `${header}.${claim}`;
  const privateKey = String(serviceAccount.private_key || "").replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(signature)}` })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Could not get Firebase access token");
  return data.access_token;
}

function toFirestoreFields(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach((key) => {
    fields[key] = toFirestoreValue(obj[key]);
  });
  return fields;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: toFirestoreFields(value) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(payload)
  };
}
