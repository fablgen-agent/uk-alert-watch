import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "global-events.json");
const feedPath = path.join(root, "data", "global-feed.xml");
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/events4app";

const eventTypes = {
  DR: "Drought",
  EQ: "Earthquake",
  FL: "Flood",
  FR: "Forest fire",
  TC: "Tropical cyclone",
  TS: "Tsunami",
  VO: "Volcano",
  WF: "Wildfire"
};

function clean(value, fallback = "Unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function rssDate(value, fallback) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.valueOf()) ? new Date(fallback).toUTCString() : date.toUTCString();
}

export function makeGlobalFeed({ checkedAt, events }) {
  const items = events.filter((event) => event.isCurrent).map((event) => {
    const description = `${event.country} · ${event.eventName} · ${event.alertLevel}. ${event.severity} Source: GDACS. Verify with responsible authorities before acting.`;
    return `    <item>\n      <title>${xml(`${event.alertLevel.toUpperCase()}: ${event.title}`)}</title>\n      <link>${xml(event.officialUrl)}</link>\n      <guid isPermaLink="false">${xml(`${event.id}:${event.episodeId}`)}</guid>\n      <pubDate>${xml(rssDate(event.updatedAt || event.startedAt, checkedAt))}</pubDate>\n      <description>${xml(description)}</description>\n    </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>World Alert Watch — current GDACS disaster events</title>\n    <link>https://fablgen-agent.github.io/uk-alert-watch/global/</link>\n    <description>Current worldwide sudden-onset disaster events tracked by GDACS. Not a complete national warning feed; verify with responsible authorities.</description>\n    <language>en</language>\n    <lastBuildDate>${xml(rssDate(checkedAt, checkedAt))}</lastBuildDate>\n    <atom:link href="https://fablgen-agent.github.io/uk-alert-watch/data/global-feed.xml" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
}

export function normalizeEvent(feature) {
  const item = feature?.properties ?? {};
  const eventType = clean(item.eventtype, "OT").toUpperCase();
  const eventId = String(item.eventid ?? "").trim();
  const episodeId = String(item.episodeid ?? "").trim();
  if (!eventId || !episodeId) return null;
  const coordinates = feature?.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)
    ? feature.geometry.coordinates.slice(0, 2).map(Number)
    : null;
  return {
    id: `${eventType}-${eventId}`,
    episodeId,
    eventType,
    eventName: eventTypes[eventType] ?? eventType,
    title: clean(item.name, clean(item.description, eventTypes[eventType] ?? "Disaster event")),
    country: clean(item.country),
    iso3: clean(item.iso3, ""),
    alertLevel: clean(item.alertlevel).toLowerCase(),
    severity: clean(item.severitydata?.severitytext, "Details available from GDACS"),
    startedAt: item.fromdate || null,
    endsAt: item.todate || null,
    updatedAt: item.datemodified || null,
    source: clean(item.source, "GDACS"),
    isCurrent: String(item.iscurrent).toLowerCase() === "true",
    coordinates: coordinates?.every(Number.isFinite) ? coordinates : null,
    officialUrl: clean(item.url?.report, `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(eventId)}&eventtype=${encodeURIComponent(eventType)}`)
  };
}

export function normalizeCollection(payload) {
  if (!Array.isArray(payload?.features)) throw new Error("GDACS response did not contain a feature collection");
  const normalized = payload.features
    .map(normalizeEvent)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt ?? b.startedAt ?? "").localeCompare(a.updatedAt ?? a.startedAt ?? ""));
  const latestByEvent = new Map();
  for (const event of normalized) if (!latestByEvent.has(event.id)) latestByEvent.set(event.id, event);
  return [...latestByEvent.values()];
}

async function fetchEvents() {
  const response = await fetch(GDACS_URL, {
    headers: {
      "accept": "application/json",
      "accept-encoding": "identity",
      "user-agent": "WorldAlertWatch/1.0 (+https://github.com/fablgen-agent/uk-alert-watch)"
    }
  });
  if (!response.ok) throw new Error(`${GDACS_URL} returned ${response.status}`);
  return response.json();
}

async function main() {
  let existing = { events: [] };
  try { existing = JSON.parse(await readFile(dataPath, "utf8")); } catch {}
  const checkedAt = new Date().toISOString();
  try {
    const events = normalizeCollection(await fetchEvents());
    if (!events.length) throw new Error("GDACS returned no usable events");
    const data = {
      checkedAt,
      sourceStatus: "ok",
      sourceName: "Global Disaster Alert and Coordination System, GDACS",
      sourceUrl: GDACS_URL,
      coverage: "Worldwide sudden-onset disaster events tracked by GDACS; not a complete national emergency-alert feed",
      events
    };
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    await writeFile(feedPath, makeGlobalFeed(data));
    console.log(`Recorded ${events.length} global GDACS events.`);
  } catch (error) {
    const data = { ...existing, checkedAt, sourceStatus: "error", sourceError: String(error.message).slice(0, 300) };
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
