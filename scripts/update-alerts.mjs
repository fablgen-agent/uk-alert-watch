import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "alerts.json");
const feedPath = path.join(root, "data", "feed.xml");
const CURRENT_URL = "https://www.gov.uk/alerts/current-alerts";
const PAST_URL = "https://www.gov.uk/alerts/past-alerts";

const entities = new Map([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", "\""], ["apos", "'"], ["#39", "'"], ["nbsp", " "]
]);

export function decodeHtml(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (entities.has(key)) return entities.get(key);
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return match;
  });
}

export function plainText(html) {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dateFromSlug(slug) {
  const match = slug.match(/(\d{1,2})-([a-z]{3})-(\d{4})/i);
  if (!match) return null;
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  return `${match[3]}-${months[match[2].toLowerCase()]}-${match[1].padStart(2, "0")}`;
}

export function parseAlerts(html, status) {
  const cards = [];
  const headingPattern = /<(?:h2|h3)[^>]*class="[^"]*alerts-alert__title[^"]*"[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi;
  const headings = [...html.matchAll(headingPattern)];

  for (let index = 0; index < headings.length; index += 1) {
    const start = headings[index].index;
    const end = headings[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const messageMatch = block.match(/<p[^>]*class="[^"]*truncated-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const linkMatch = block.match(/href="(\/alerts\/[^"]+)"[^>]*class="[^"]*govuk-link[^\"]*govuk-body/i);
    if (!messageMatch || !linkMatch) continue;
    const slug = linkMatch[1].split("/").filter(Boolean).at(-1);
    const message = plainText(messageMatch[1]);
    const area = plainText(headings[index][1]).replace(/^Emergency alert sent to\s*/i, "");
    cards.push({
      id: slug,
      status,
      area,
      language: /^Anfonwyd\b/i.test(message) ? "cy" : "en",
      issuedDate: dateFromSlug(slug),
      message,
      officialUrl: `https://www.gov.uk${linkMatch[1]}`
    });
  }
  return cards;
}

function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}

export function makeFeed(data, baseUrl = "https://fablgen-agent.github.io/uk-alert-watch/") {
  const items = data.alerts.slice(0, 30).map((alert) => `    <item>
      <title>${xml(`${alert.status === "current" ? "CURRENT: " : ""}${alert.area}`)}</title>
      <link>${xml(alert.officialUrl)}</link>
      <guid isPermaLink="true">${xml(alert.officialUrl)}</guid>
      <pubDate>${new Date(`${alert.issuedDate ?? "1970-01-01"}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${xml(alert.message)}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>UK Alert Watch</title>
    <link>${baseUrl}</link>
    <description>Unofficial tracker of UK Emergency Alerts sourced from GOV.UK.</description>
    <lastBuildDate>${new Date(data.checkedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "accept-encoding": "identity",
      "user-agent": "UKAlertWatch/1.0 (+https://github.com/fablgen-agent/uk-alert-watch)"
    }
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main() {
  let existing = { alerts: [] };
  try { existing = JSON.parse(await readFile(dataPath, "utf8")); } catch {}
  const checkedAt = new Date().toISOString();
  try {
    const [currentHtml, pastHtml] = await Promise.all([fetchPage(CURRENT_URL), fetchPage(PAST_URL)]);
    const current = parseAlerts(currentHtml, "current");
    const past = parseAlerts(pastHtml, "past");
    if (!currentHtml.includes("Current alerts") || !pastHtml.includes("Past alerts")) throw new Error("Official page structure was not recognized");
    const byId = new Map(past.map((alert) => [alert.id, alert]));
    for (const alert of existing.alerts) {
      if (!byId.has(alert.id) && !current.some((item) => item.id === alert.id)) byId.set(alert.id, { ...alert, status: "past" });
    }
    const alerts = [...current, ...byId.values()].sort((a, b) => (b.issuedDate ?? "").localeCompare(a.issuedDate ?? "") || a.id.localeCompare(b.id));
    const data = { checkedAt, sourceStatus: "ok", sourceUrls: [CURRENT_URL, PAST_URL], alerts };
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    await writeFile(feedPath, makeFeed(data));
    console.log(`Recorded ${current.length} current and ${byId.size} past alerts.`);
  } catch (error) {
    const data = { ...existing, checkedAt, sourceStatus: "error", sourceError: String(error.message).slice(0, 300) };
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    await writeFile(feedPath, makeFeed(data));
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
