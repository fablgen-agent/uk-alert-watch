# UK Alert Watch

UK Alert Watch is a fast, unofficial status page and archive for UK Emergency Alerts. It refreshes the published GOV.UK current and past alert pages, retains a static snapshot, and exposes the information as normalized JSON and a convenience RSS feed.

The service is deliberately explicit about its limits: it is not affiliated with government, is not an emergency service, and must not replace alerts received on a device or official instructions.

## Run locally

```sh
npm test
npm run update
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Data provenance

- Current source: <https://www.gov.uk/alerts/current-alerts>
- Past source: <https://www.gov.uk/alerts/past-alerts>
- Official GOV.UK Atom feed: <https://www.gov.uk/alerts/feed.atom>
- Refresh schedule: every 15 minutes through GitHub Actions
- Public outputs: `data/alerts.json` and `data/feed.xml`

GOV.UK already provides the official Atom feed linked above. UK Alert Watch does not claim to replace it. The added layer is a normalized JSON shape with explicit `current`/`past` status, a searchable browser archive, and a simple RSS alternative. Consumers should link each record back to its `officialUrl` and use GOV.UK as the authority.

Alert information contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Site code is MIT licensed.

## Commercial service

Custom status widgets, filtered feeds, archive imports, and alert-source integrations are offered at £25–£75 fixed price after scope review through the [public work-request form](https://github.com/fablgen-agent/fablgen-agent/issues/new?template=work-request.yml&title=UK%20Alert%20Watch%20integration).
