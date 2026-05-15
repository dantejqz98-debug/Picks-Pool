const crypto = require("crypto");

const EVENT_ID = "ufc-freedom-250";
const SPORT_KEY = "mma_mixed_martial_arts";
const FIGHTS = [
  { id: "m1", f1: "Ilia Topuria", f2: "Justin Gaethje" },
  { id: "m2", f1: "Alex Pereira", f2: "Ciryl Gane" },
  { id: "m3", f1: "Sean O'Malley", f2: "Aiemann Zahabi" },
  { id: "m4", f1: "Mauricio Ruffy", f2: "Michael Chandler" },
  { id: "m5", f1: "Bo Nickal", f2: "Kyle Daukaus" },
  { id: "p1", f1: "Diego Lopes", f2: "Steve Garcia" },
  { id: "p2", f1: "Josh Hokit", f2: "Derrick Lewis" }
];

exports.handler = async function(event) {
  if (event.httpMethod && event.httpMethod !== "GET" && event.httpMethod !== "POST" && event.httpMethod !== "SCHEDULED") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    return json(501, {
      error: "Missing THE_ODDS_API_KEY. Add it in Netlify environment variables, then redeploy."
    });
  }

  try {
    const odds = await fetchOdds(apiKey);
    const payload = matchOddsToFights(odds);

    if ((event.scheduled || event.httpMethod === "SCHEDULED") && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      await saveToFirestore(payload);
      payload.savedToFirebase = true;
    } else if (event.scheduled || event.httpMethod === "SCHEDULED") {
      payload.savedToFirebase = false;
      payload.firebaseMessage = "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Scheduled refresh pulled odds but could not save them to Firebase.";
    }

    return json(200, payload);
  } catch (error) {
    return json(500, { error: error.message || "Could not refresh fighter lines" });
  }
};

exports.refreshAndSaveToFirebase = async function() {
  return exports.handler({ httpMethod: "SCHEDULED", scheduled: true });
};

async function fetchOdds(apiKey) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", process.env.ODDS_REGIONS || "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");

  const response = await fetch(url);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text || "[]");
  } catch (error) {
    throw new Error("The Odds API returned a response that was not JSON.");
  }
  if (!response.ok) {
    throw new Error(data.message || data.error || "The Odds API request failed.");
  }
  return Array.isArray(data) ? data : [];
}

function matchOddsToFights(events) {
  const fights = {};
  const unmatched = [];
  FIGHTS.forEach((fight) => {
    const match = findEventForFight(events, fight);
    if (!match) {
      unmatched.push({ id: fight.id, f1: fight.f1, f2: fight.f2 });
      return;
    }
    const prices = pricesFromEvent(match.event, fight);
    if (!prices) {
      unmatched.push({ id: fight.id, f1: fight.f1, f2: fight.f2, reason: "No h2h prices found" });
      return;
    }
    fights[fight.id] = {
      o1: prices.o1,
      o2: prices.o2,
      f1: fight.f1,
      f2: fight.f2,
      bookmaker: prices.bookmaker,
      sourceEventId: match.event.id || "",
      commenceTime: match.event.commence_time || "",
      matchedHome: match.event.home_team || "",
      matchedAway: match.event.away_team || ""
    };
  });
  return {
    eventId: EVENT_ID,
    source: "The Odds API",
    sourceSport: SPORT_KEY,
    updatedAt: new Date().toISOString(),
    matchedCount: Object.keys(fights).length,
    fights,
    unmatched
  };
}

function findEventForFight(events, fight) {
  const a = canonical(fight.f1);
  const b = canonical(fight.f2);
  return events.map((event) => ({ event, score: eventScore(event, a, b) }))
    .filter((item) => item.score >= 2)
    .sort((x, y) => y.score - x.score)[0] || null;
}

function eventScore(event, a, b) {
  const names = [event.home_team, event.away_team].concat((event.bookmakers || []).flatMap((book) => {
    return (book.markets || []).flatMap((market) => (market.outcomes || []).map((outcome) => outcome.name));
  })).filter(Boolean).map(canonical);
  const joined = names.join(" ");
  let score = 0;
  if (joined.includes(a)) score += 2;
  if (joined.includes(b)) score += 2;
  if (lastNameMatch(names, a)) score += 1;
  if (lastNameMatch(names, b)) score += 1;
  return score;
}

function lastNameMatch(names, canonicalName) {
  const last = canonicalName.split(" ").filter(Boolean).pop();
  return !!last && names.some((name) => name.split(" ").includes(last));
}

function pricesFromEvent(event, fight) {
  const preferred = (process.env.ODDS_BOOKMAKER_PRIORITY || "draftkings,fanduel,betmgm,caesars,espnbet,bet365")
    .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const books = (event.bookmakers || []).slice().sort((a, b) => {
    const ai = preferred.indexOf(String(a.key || "").toLowerCase());
    const bi = preferred.indexOf(String(b.key || "").toLowerCase());
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  for (const book of books) {
    const market = (book.markets || []).find((m) => m.key === "h2h");
    if (!market) continue;
    const o1 = outcomePrice(market.outcomes || [], fight.f1);
    const o2 = outcomePrice(market.outcomes || [], fight.f2);
    if (Number.isFinite(o1) && Number.isFinite(o2)) {
      return { o1, o2, bookmaker: book.title || book.key || "Sportsbook" };
    }
  }
  return null;
}

function outcomePrice(outcomes, fighterName) {
  const target = canonical(fighterName);
  const last = target.split(" ").filter(Boolean).pop();
  const outcome = outcomes.find((o) => canonical(o.name) === target) ||
    outcomes.find((o) => last && canonical(o.name).split(" ").includes(last));
  return outcome ? parseInt(outcome.price, 10) : NaN;
}

function canonical(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function saveToFirestore(payload) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "ufc328pool";
  const token = await getAccessToken(serviceAccount);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/siteGlobals/fighterLines?updateMask.fieldPaths=eventId&updateMask.fieldPaths=source&updateMask.fieldPaths=sourceSport&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=matchedCount&updateMask.fieldPaths=fights&updateMask.fieldPaths=unmatched`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(payload) })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not save scheduled fighter lines to Firestore: ${text}`);
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

function toFirestoreFields(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach((key) => {
    fields[key] = toFirestoreValue(obj[key]);
  });
  return fields;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  return { mapValue: { fields: toFirestoreFields(value) } };
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
