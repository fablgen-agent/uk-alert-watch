import test from "node:test";
import assert from "node:assert/strict";
import { decodeHtml, makeFeed, parseAlerts, plainText } from "../scripts/update-alerts.mjs";

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
