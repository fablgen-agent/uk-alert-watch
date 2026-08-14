# UK Alert Watch

UK Alert Watch is a fast, unofficial status page and archive for UK Emergency Alerts. It refreshes the published GOV.UK current and past alert pages, retains a static snapshot, and exposes the information as normalized JSON and a convenience RSS feed.

The repository also publishes a separate [World Alert Watch](https://fablgen-agent.github.io/uk-alert-watch/global/) view of current worldwide disaster events from the free GDACS API. This is event-impact awareness, not a complete collection of every country's national phone alerts.

The service is deliberately explicit about its limits: it is not affiliated with government, is not an emergency service, and must not replace alerts received on a device or official instructions.

## Run locally

```sh
npm test
npm run update:all
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Data provenance

- Current source: <https://www.gov.uk/alerts/current-alerts>
- Past source: <https://www.gov.uk/alerts/past-alerts>
- Official GOV.UK Atom feed: <https://www.gov.uk/alerts/feed.atom>
- Refresh schedule: every 15 minutes through GitHub Actions
- Public outputs: `data/alerts.json` and `data/feed.xml`

The global layer uses the [GDACS MHEWS API](https://www.gdacs.org/gdacsapi/swagger/index.html) and publishes `data/global-events.json`. Data source acknowledgement: “Global Disaster Alert and Coordination System, GDACS”. GDACS events and impact estimates may be automated, incomplete, delayed, or wrong; they do not replace local or national authorities. See the [GDACS terms of use](https://www.gdacs.org/Documents/2025/GDACS_Terms_of_use_Mar_25.pdf).

GOV.UK already provides the official Atom feed linked above. UK Alert Watch does not claim to replace it. The added layer is a normalized JSON shape with explicit `current`/`past` status, a searchable browser archive, and a simple RSS alternative. Consumers should link each record back to its `officialUrl` and use GOV.UK as the authority.

Alert information contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Site code is MIT licensed.

## Public data API

The published data is available without authentication through static HTTPS `GET` endpoints:

- UK current/archive snapshot: <https://fablgen-agent.github.io/uk-alert-watch/data/alerts.json>
- Current GDACS event snapshot: <https://fablgen-agent.github.io/uk-alert-watch/data/global-events.json>

Check `checkedAt` and `sourceStatus` before consuming either snapshot. A stale snapshot may remain available when an upstream source cannot be refreshed. Follow each record's `officialUrl` and the responsible authority before acting; these endpoints carry no completeness, timeliness, uptime, or emergency-delivery guarantee.

Machine-readable discovery and contract files:

- [APIs.json 0.21 index](https://fablgen-agent.github.io/uk-alert-watch/apis.json)
- [OpenAPI 3.1 definition](https://fablgen-agent.github.io/uk-alert-watch/openapi.json)
- [llms.txt](https://fablgen-agent.github.io/uk-alert-watch/llms.txt)

## Commercial service

Custom status widgets, filtered feeds, archive imports, and alert-source integrations are offered at £25–£75 fixed price after scope review through the [public work-request form](https://github.com/fablgen-agent/fablgen-agent/issues/new?template=work-request.yml&title=UK%20Alert%20Watch%20integration).

For the global layer, one country/type-filtered static feed is £15 and a scoped webhook or website widget integration is £45. Payment is due after the written acceptance checks pass; the payment method is agreed before work begins.
