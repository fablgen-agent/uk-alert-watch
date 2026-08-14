const dataUrl = new URL("../data/global-events.json", import.meta.url);

const elements = {
  eventCount: document.querySelector("#event-count"),
  countryCount: document.querySelector("#country-count"),
  lastChecked: document.querySelector("#last-checked"),
  sourceHealth: document.querySelector("#source-health"),
  list: document.querySelector("#global-list"),
  country: document.querySelector("#country-filter"),
  level: document.querySelector("#level-filter"),
  type: document.querySelector("#type-filter"),
  empty: document.querySelector("#global-empty"),
  resultCount: document.querySelector("#result-count"),
  showMore: document.querySelector("#show-more")
};

const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
let events = [];
let visibleLimit = 24;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function option(value, label = value) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function eventCard(event) {
  const card = el("article", `global-card level-${event.alertLevel}`);
  const top = el("div", "alert-card-header");
  const heading = el("div");
  heading.append(el("span", "tag", `${event.alertLevel} · ${event.eventName}`), el("h3", "", event.title));
  top.append(heading, el("span", "alert-meta", event.startedAt ? formatter.format(new Date(`${event.startedAt}Z`)) : "Time unavailable"));
  const country = el("p", "global-country", event.country);
  if (event.iso3) country.append(` · ${event.iso3}`);
  const link = el("a", "official-link", "Open the GDACS event report →");
  link.href = event.officialUrl;
  link.rel = "noopener";
  card.append(top, country, el("p", "", event.severity), link);
  return card;
}

function render() {
  const matches = events.filter((event) =>
    (!elements.country.value || event.iso3 === elements.country.value) &&
    (!elements.level.value || event.alertLevel === elements.level.value) &&
    (!elements.type.value || event.eventType === elements.type.value)
  );
  const visible = matches.slice(0, visibleLimit);
  elements.list.replaceChildren(...visible.map(eventCard));
  elements.empty.hidden = matches.length !== 0;
  elements.resultCount.textContent = `${visible.length} of ${matches.length} event${matches.length === 1 ? "" : "s"} shown`;
  elements.showMore.hidden = visible.length >= matches.length;
}

function addFilters() {
  const countries = [...new Map(events.map((event) => [event.iso3, event.country])).entries()]
    .filter(([code]) => code)
    .sort((a, b) => a[1].localeCompare(b[1]));
  elements.country.append(...countries.map(([code, name]) => option(code, name)));
  const types = [...new Map(events.map((event) => [event.eventType, event.eventName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  elements.type.append(...types.map(([code, name]) => option(code, name)));
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request returned ${response.status}`);
    const data = await response.json();
    events = data.events.filter((event) => event.isCurrent);
    elements.eventCount.textContent = String(events.length);
    elements.countryCount.textContent = String(new Set(events.flatMap((event) => event.iso3 ? [event.iso3] : [])).size);
    elements.lastChecked.textContent = formatter.format(new Date(data.checkedAt));
    elements.sourceHealth.textContent = data.sourceStatus === "ok" ? "GDACS source fetched" : "Showing last available snapshot";
    if (data.sourceStatus !== "ok") elements.sourceHealth.classList.add("is-stale");
    addFilters();
    render();
    elements.list.setAttribute("aria-busy", "false");
  } catch {
    elements.sourceHealth.textContent = "Data temporarily unavailable";
    elements.sourceHealth.classList.add("is-stale");
    elements.list.setAttribute("aria-busy", "false");
    elements.list.replaceChildren(el("p", "loading", "The global dataset could not be loaded. Open GDACS for current information."));
  }
}

for (const select of [elements.country, elements.level, elements.type]) select.addEventListener("change", () => { visibleLimit = 24; render(); });
elements.showMore.addEventListener("click", () => { visibleLimit += 24; render(); });
load();
