import test from "node:test";
import assert from "node:assert/strict";
import { decodeHtml, makeFeed, parseAlerts, plainText } from "../scripts/update-alerts.mjs";
import { makeGlobalFeed, normalizeCollection, normalizeEvent } from "../scripts/update-global.mjs";

const fixture = `
<h2 class="alerts-alert__title govuk-heading-m"><span class="govuk-visually-hidden">Emergency alert sent to </span>England &amp; Wales</h2>
<p class="govuk-body truncated-text">Issued by the UK Government\n\nStay safe &amp; follow advice.</p>
<a href="/alerts/14-aug-2026-2" class="govuk-link govuk-body">More information</a>
<h3 class="alerts-alert__title govuk-heading-m"><span>Emergency alert sent to </span>Wales</h3>
<p class="truncated-text">Anfonwyd gan Lywodraeth y DU</p>
<a href="/alerts/14-aug-2026" class="govuk-link govuk-body">More information</a>`;

test("decodes and strips official markup", () => {
  assert.equal(decodeHtml("A &amp; B &#39;ok&#39;"), "A & B 'ok'");
  assert.equal(plainText("<span>Emergency</span><br>line"), "Emergency\nline");
});

test("parses English and Welsh alert cards", () => {
  const alerts = parseAlerts(fixture, "current");
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts[0], {
    id: "14-aug-2026-2",
    status: "current",
    area: "England & Wales",
    language: "en",
    issuedDate: "2026-08-14",
    message: "Issued by the UK Government\n\nStay safe & follow advice.",
    officialUrl: "https://www.gov.uk/alerts/14-aug-2026-2"
  });
  assert.equal(alerts[1].language, "cy");
});

test("RSS escapes data and uses canonical links", () => {
  const feed = makeFeed({ checkedAt: "2026-08-14T19:00:00Z", alerts: [parseAlerts(fixture, "current")[0]] });
  assert.match(feed, /CURRENT: England &amp; Wales/);
  assert.match(feed, /https:\/\/www\.gov\.uk\/alerts\/14-aug-2026-2/);
  assert.doesNotMatch(feed, /<script/i);
});

const globalFixture = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [121.4, -8.3] },
  properties: {
    eventtype: "EQ",
    eventid: 123,
    episodeid: 456,
    name: "Earthquake in Indonesia",
    alertlevel: "Green",
    iscurrent: "true",
    country: "Indonesia",
    iso3: "IDN",
    fromdate: "2026-08-14T22:18:06",
    datemodified: "2026-08-14T22:45:25",
    source: "NEIC",
    severitydata: { severitytext: "Magnitude 5.6M, Depth:10km" },
    url: { report: "https://www.gdacs.org/report.aspx?eventid=123&eventtype=EQ" }
  }
};

test("normalizes a GDACS feature without copying presentation HTML", () => {
  assert.deepEqual(normalizeEvent(globalFixture), {
    id: "EQ-123",
    episodeId: "456",
    eventType: "EQ",
    eventName: "Earthquake",
    title: "Earthquake in Indonesia",
    country: "Indonesia",
    iso3: "IDN",
    alertLevel: "green",
    severity: "Magnitude 5.6M, Depth:10km",
    startedAt: "2026-08-14T22:18:06",
    endsAt: null,
    updatedAt: "2026-08-14T22:45:25",
    source: "NEIC",
    isCurrent: true,
    coordinates: [121.4, -8.3],
    officialUrl: "https://www.gdacs.org/report.aspx?eventid=123&eventtype=EQ"
  });
});

test("rejects malformed global collections and events", () => {
  assert.throws(() => normalizeCollection({}), /feature collection/);
  assert.equal(normalizeEvent({ properties: { eventtype: "EQ" } }), null);
});

test("keeps only the newest episode for each GDACS event", () => {
  const older = structuredClone(globalFixture);
  older.properties.episodeid = 455;
  older.properties.datemodified = "2026-08-14T21:00:00";
  const result = normalizeCollection({ features: [older, globalFixture] });
  assert.equal(result.length, 1);
  assert.equal(result[0].episodeId, "456");
});

test("makes a current-only global RSS feed with escaped event data", () => {
  const current = normalizeEvent(globalFixture);
  const past = { ...current, id: "EQ-124", episodeId: "457", title: "Past <event>", isCurrent: false };
  const feed = makeGlobalFeed({ checkedAt: "2026-08-15T12:00:00Z", events: [current, past] });
  assert.match(feed, /GREEN: Earthquake in Indonesia/);
  assert.match(feed, /eventid=123&amp;eventtype=EQ/);
  assert.doesNotMatch(feed, /Past &lt;event&gt;/);
  assert.match(feed, /global-feed\.xml/);
});
