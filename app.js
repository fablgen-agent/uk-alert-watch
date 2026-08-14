const dataUrl = new URL("data/alerts.json", import.meta.url);

const elements = {
  activeCount: document.querySelector("#active-count"),
  archiveCount: document.querySelector("#archive-count"),
  lastChecked: document.querySelector("#last-checked"),
  sourceHealth: document.querySelector("#source-health"),
  currentList: document.querySelector("#current-list"),
  archiveList: document.querySelector("#archive-list"),
  archiveSearch: document.querySelector("#archive-search"),
  archiveEmpty: document.querySelector("#archive-empty")
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London"
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Europe/London"
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function officialLink(alert) {
  const link = el("a", "official-link", "Verify on GOV.UK →");
  link.href = alert.officialUrl;
  link.rel = "noopener";
  return link;
}

function renderCurrent(alerts) {
  elements.currentList.replaceChildren();
  elements.currentList.setAttribute("aria-busy", "false");

  if (!alerts.length) {
    const card = el("div", "alert-card");
    card.style.borderLeftColor = "var(--green)";
    card.append(el("h3", "", "No current alerts are published"));
    card.append(el("p", "", "GOV.UK did not list an active Emergency Alert at the most recent check."));
    const link = el("a", "official-link", "Check the official current-alert page →");
    link.href = "https://www.gov.uk/alerts/current-alerts";
    card.append(link);
    elements.currentList.append(card);
    return;
  }

  for (const alert of alerts) {
    const card = el("article", "alert-card");
    const header = el("div", "alert-card-header");
    const titleWrap = el("div");
    titleWrap.append(el("span", "tag", alert.language === "cy" ? "Current · Welsh" : "Current"));
    titleWrap.append(el("h3", "", alert.area));
    header.append(titleWrap);
    if (alert.issuedDate) header.append(el("span", "alert-meta", dateOnlyFormatter.format(new Date(`${alert.issuedDate}T12:00:00Z`))));
    card.append(header, el("p", "alert-message", alert.message), officialLink(alert));
    elements.currentList.append(card);
  }
}

function archiveCard(alert) {
  const card = el("article", "archive-card");
  card.dataset.search = `${alert.area} ${alert.message} ${alert.issuedDate}`.toLocaleLowerCase("en-GB");
  card.append(el("p", "archive-date", alert.issuedDate ? dateOnlyFormatter.format(new Date(`${alert.issuedDate}T12:00:00Z`)) : "Date unavailable"));
  card.append(el("h3", "", alert.area));
  card.append(el("p", "", alert.message));
  card.append(officialLink(alert));
  return card;
}

function renderArchive(alerts) {
  elements.archiveList.replaceChildren(...alerts.map(archiveCard));
  filterArchive();
}

function filterArchive() {
  const query = elements.archiveSearch.value.trim().toLocaleLowerCase("en-GB");
  let visible = 0;
  for (const card of elements.archiveList.children) {
    const matches = !query || card.dataset.search.includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  elements.archiveEmpty.hidden = visible !== 0;
}

async function load() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request returned ${response.status}`);
    const data = await response.json();
    const active = data.alerts.filter((alert) => alert.status === "current");
    const archived = data.alerts.filter((alert) => alert.status === "past");
    elements.activeCount.textContent = String(active.length);
    elements.archiveCount.textContent = String(archived.length);
    elements.lastChecked.textContent = formatter.format(new Date(data.checkedAt));
    elements.sourceHealth.textContent = data.sourceStatus === "ok" ? "Official source fetched" : "Showing last verified snapshot";
    if (data.sourceStatus !== "ok") elements.sourceHealth.classList.add("is-stale");
    renderCurrent(active);
    renderArchive(archived);
  } catch (error) {
    elements.sourceHealth.textContent = "Data temporarily unavailable";
    elements.sourceHealth.classList.add("is-stale");
    elements.currentList.setAttribute("aria-busy", "false");
    elements.currentList.replaceChildren(el("p", "loading", "The tracker data could not be loaded. Use the official GOV.UK link to check current alerts."));
  }
}

elements.archiveSearch.addEventListener("input", filterArchive);
load();
