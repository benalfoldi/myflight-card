/**
 * myFlight Lovelace cards — Home dashboard tiles + Leaflet maps.
 */
const MFC_VERSION = "0.1.0";
const MFC_LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const MFC_LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const MFC_DOC = "https://github.com/benalfoldi/myflight-card";

function mfcPickDefaultEntity(hass, pool) {
  const ids = [...new Set([
    ...(pool || []),
    ...(hass ? Object.keys(hass.states || {}) : []),
  ])];
  const status = ids.find((e) => e.includes("myflight") && e.endsWith("_status"));
  if (status) return status;
  return ids.find((e) => e.includes("myflight")) || "sensor.myflight_status";
}

function mfcIsDark(hass) {
  try {
    if (hass?.themes?.darkMode) return true;
  } catch (_e) { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

function mfcAttrs(hass, entity) {
  return hass?.states?.[entity]?.attributes || {};
}

function mfcEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mfcClock(value) {
  const text = (value || "").trim();
  if (!text) return "—";
  if (text.includes("T")) return text.split("T", 1)[1].slice(0, 5);
  if (text.length >= 5 && text[2] === ":") return text.slice(0, 5);
  if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2)}`;
  return text;
}

function mfcDateLabel(iso) {
  if (!iso) return "";
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch (_e) {
    return iso;
  }
}

function mfcStyles(dark, theme) {
  const brand = theme !== "ha";
  const navy = brand ? "#0a1f44" : "var(--primary-text-color)";
  const magenta = brand ? "#c6007e" : "var(--primary-color)";
  const card = dark ? "#1e293b" : "#ffffff";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#334155" : "#e2e8f0";
  const bg = dark ? "#0b1220" : "#f8fafc";
  return `
    :host { display: block; }
    .mfc {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: ${card};
      color: ${text};
      border-radius: 16px;
      border: 1px solid ${border};
      padding: 14px 16px;
      box-sizing: border-box;
    }
    .mfc-h {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 10px; margin-bottom: 10px;
    }
    .mfc-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: ${navy}; letter-spacing: -0.01em; }
    .mfc-sub { color: ${muted}; font-size: 0.82rem; }
    .mfc-muted { color: ${muted}; font-size: 0.88rem; }
    .mfc-empty { margin: 0; color: ${muted}; }
    .mfc-list { margin: 8px 0 0; padding-left: 18px; font-size: 0.9rem; line-height: 1.45; }
    .mfc-list li + li { margin-top: 4px; }
    .mfc-stat { margin: 0; font-size: 1.15rem; }
    .mfc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .mfc-chip {
      font-size: 0.75rem; font-weight: 600; padding: 3px 8px; border-radius: 999px;
      background: ${bg}; border: 1px solid ${border}; color: ${text};
    }
    .mfc-chip.late { color: #dc2626; border-color: rgba(220,38,38,.35); }
    .mfc-chip.early { color: #16a34a; border-color: rgba(22,163,74,.35); }
    .mfc-chip.ontime, .mfc-chip.on-time { color: ${magenta}; }
    .mfc-error { color: #dc2626; font-size: 0.88rem; }
    .mfc-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
      gap: 8px; margin-top: 8px;
    }
    .mfc-cell { background: ${bg}; border: 1px solid ${border}; border-radius: 10px; padding: 8px; text-align: center; }
    .mfc-cell strong { display: block; font-size: 1.05rem; }
    .mfc-cell span { color: ${muted}; font-size: 0.72rem; }
    .mfc-progress {
      position: relative; height: 8px; border-radius: 999px; background: ${bg};
      border: 1px solid ${border}; margin: 14px 0 10px;
    }
    .mfc-progress-fill {
      position: absolute; inset: 0 auto 0 0; width: var(--p, 0%);
      background: ${magenta}; border-radius: inherit; opacity: .35;
    }
    .mfc-plane {
      position: absolute; top: 50%; left: var(--p, 0%);
      width: 0; height: 0; transform: translate(-50%, -50%);
      border-left: 10px solid ${magenta};
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
    }
    .mfc-ends { display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 700; }
    .mfc-times { display: flex; justify-content: space-between; color: ${muted}; font-size: 0.78rem; margin-top: 2px; }
    .mfc-map { height: 180px; margin-top: 10px; border-radius: 12px; overflow: hidden; border: 1px solid ${border}; z-index: 0; }
    .mfc-map.leaflet-container { background: ${bg}; }
    a { color: ${magenta}; }
  `;
}

function mfcProgress(display) {
  if (!display || !display.departure) return "";
  const pct = Math.round(Math.max(0, Math.min(1, Number(display.progress) || 0)) * 100);
  const depChip = display.depDelayText
    ? `<span class="mfc-chip ${mfcEsc(display.depDelayTone || "")}">Dep · ${mfcEsc(display.depDelayText)}</span>`
    : "";
  const arrChip = display.arrDelayText
    ? `<span class="mfc-chip ${mfcEsc(display.arrDelayTone || "")}">Arr · ${mfcEsc(display.arrDelayText)}</span>`
    : "";
  return `
    <div class="mfc-ends"><span>${mfcEsc(display.departure)}</span><span>${mfcEsc(display.arrival)}</span></div>
    <div class="mfc-progress" style="--p:${pct}%">
      <div class="mfc-progress-fill"></div>
      <div class="mfc-plane" title="${pct}%"></div>
    </div>
    <div class="mfc-times">
      <span>${mfcEsc(display.leftTimeLabel || "STD")} ${mfcEsc(mfcClock(display.leftTime))}</span>
      <span>${mfcEsc(display.rightTimeLabel || "STA")} ${mfcEsc(mfcClock(display.rightTime))}</span>
    </div>
    <div class="mfc-chips">${depChip}${arrChip}</div>
  `;
}

let mfcLeafletPromise = null;
function mfcLoadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (mfcLeafletPromise) return mfcLeafletPromise;
  mfcLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MFC_LEAFLET_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MFC_LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const existing = document.querySelector(`script[src="${MFC_LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      return;
    }
    const script = document.createElement("script");
    script.src = MFC_LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return mfcLeafletPromise;
}

function mfcInjectLeafletCss(root) {
  if (root.querySelector("link[data-mfc-leaflet]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = MFC_LEAFLET_CSS;
  link.dataset.mfcLeaflet = "1";
  root.appendChild(link);
}

function mfcPlaneIcon(L, heading) {
  const rot = Number(heading) || 0;
  return L.divIcon({
    className: "mfc-ac-icon",
    html: `<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid #c6007e;transform:rotate(${rot}deg)"></div>`,
    iconSize: [16, 18],
    iconAnchor: [8, 9],
  });
}

function mfcMountMap(host, mapData) {
  if (!host) return;
  mfcInjectLeafletCss(host.getRootNode());
  const data = mapData || {};
  mfcLoadLeaflet().then((L) => {
    if (host._mfcMap) {
      host._mfcMap.remove();
      host._mfcMap = null;
    }
    const map = L.map(host, { zoomControl: false, attributionControl: false });
    host._mfcMap = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 13,
    }).addTo(map);
    const bounds = [];
    const dep = data.departure;
    const arr = data.arrival;
    if (dep?.lat != null && dep?.lon != null) {
      bounds.push([dep.lat, dep.lon]);
      L.circleMarker([dep.lat, dep.lon], { radius: 5, color: "#0a1f44", fillOpacity: 1 }).addTo(map);
    }
    if (arr?.lat != null && arr?.lon != null) {
      bounds.push([arr.lat, arr.lon]);
      L.circleMarker([arr.lat, arr.lon], { radius: 5, color: "#c6007e", fillOpacity: 1 }).addTo(map);
    }
    if (dep?.lat != null && arr?.lat != null) {
      L.polyline([[dep.lat, dep.lon], [arr.lat, arr.lon]], {
        color: "#c6007e",
        weight: 2,
        dashArray: "6 6",
        opacity: 0.7,
      }).addTo(map);
    }
    const trail = Array.isArray(data.trail) ? data.trail : [];
    if (trail.length > 1) {
      L.polyline(
        trail.map((p) => [p.latitude, p.longitude]),
        { color: "#0a1f44", weight: 2 },
      ).addTo(map);
    }
    if (data.latitude != null && data.longitude != null) {
      const here = [data.latitude, data.longitude];
      bounds.push(here);
      L.marker(here, { icon: mfcPlaneIcon(L, data.heading) }).addTo(map);
    }
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 8 });
    } else {
      map.setView([47.4, 19.2], 4);
    }
    setTimeout(() => map.invalidateSize(), 50);
  }).catch(() => {
    host.innerHTML = `<p class="mfc-muted" style="padding:12px">Map unavailable</p>`;
  });
}

function mfcProgressFromLeg(leg, extra) {
  if (!leg) return null;
  const net = extra || {};
  return {
    departure: leg.departure || net.departure,
    arrival: leg.arrival || net.arrival,
    progress: extra?.progress ?? 0,
    leftTimeLabel: "STD",
    leftTime: net.std || leg.std,
    rightTimeLabel: "STA",
    rightTime: net.sta || leg.sta,
    depDelayText: net.departure_delay_text,
    depDelayTone: net.departure_delay_tone,
    arrDelayText: net.arrival_delay_text,
    arrDelayTone: net.arrival_delay_tone,
  };
}

class MyFlightBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  static getStubConfig() {
    return { entity: "sensor.myflight_status", theme: "brand" };
  }

  static getConfigElement() {
    return document.createElement("myflight-card-editor");
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid config");
    this._config = { theme: "brand", ...config };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  _entity() {
    return this._config.entity || mfcPickDefaultEntity(this._hass);
  }

  _renderShell(title, body, { map = null, subtitle = "" } = {}) {
    const dark = mfcIsDark(this._hass);
    this.shadowRoot.innerHTML = `
      <style>${mfcStyles(dark, this._config.theme)}</style>
      <div class="mfc">
        <div class="mfc-h">
          <div>
            <h2 class="mfc-title">${mfcEsc(title)}</h2>
            ${subtitle ? `<div class="mfc-sub">${mfcEsc(subtitle)}</div>` : ""}
          </div>
        </div>
        ${body}
        ${map ? `<div class="mfc-map" id="mfc-map"></div>` : ""}
      </div>
    `;
    if (map) mfcMountMap(this.shadowRoot.getElementById("mfc-map"), map);
  }
}

class MyFlightNextDutyCard extends MyFlightBaseCard {
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const duty = a.next_duty;
    const changes = a.roster_changes || [];
    if (!duty) {
      this._renderShell("Next duty", `<p class="mfc-empty">No upcoming duty.</p>`);
      return;
    }
    const legs = (duty.legs || [])
      .map((leg) => `<li><strong>${mfcEsc(leg.flight_number)}</strong> ${mfcEsc(leg.departure)} → ${mfcEsc(leg.arrival)} <span class="mfc-muted">${mfcEsc(mfcClock(leg.std))}–${mfcEsc(mfcClock(leg.sta))}</span></li>`)
      .join("");
    const pending = changes.length
      ? `<p class="mfc-error">${changes.length} roster change${changes.length === 1 ? "" : "s"} pending</p><ul class="mfc-list">${changes.map((c) => `<li>${mfcEsc(c.date)} · ${mfcEsc(c.new_summary || c.old_summary)}</li>`).join("")}</ul>`
      : "";
    this._renderShell(duty.label || "Next duty", `
      <div class="mfc-sub">${mfcEsc(mfcDateLabel(duty.date))}</div>
      <p class="mfc-stat"><strong>${mfcEsc(duty.duty_text || duty.duty_roster_code || "Duty")}</strong></p>
      <p class="mfc-muted">Report ${mfcEsc(mfcClock(duty.report_time || duty.check_in))} · Debrief ${mfcEsc(mfcClock(duty.debrief_time || duty.check_out))}</p>
      ${legs ? `<ul class="mfc-list">${legs}</ul>` : ""}
      ${pending}
    `, { subtitle: a.profile?.display_name || "" });
  }
}

class MyFlightMissionCard extends MyFlightBaseCard {
  getCardSize() { return 5; }
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const mission = a.mission;
    const duty = mission?.duty || a.next_duty;
    if (!mission && !duty) {
      this._renderShell("Your mission", `<p class="mfc-empty">No flight duty loaded.</p>`);
      return;
    }
    const leg = mission?.leg;
    const crew = (duty?.crew || [])
      .slice(0, 8)
      .map((m) => `<li>${mfcEsc(m.rank || "")} ${mfcEsc(m.name)}${m.checked_in ? " ✓" : ""}</li>`)
      .join("");
    const progress = mfcProgressFromLeg(leg, { ...leg, progress: mission?.progress });
    this._renderShell("Your mission", `
      <p class="mfc-stat"><strong>${mfcEsc(mission?.registration || duty?.duty_text || "Duty")}</strong>
        <span class="mfc-muted">${mfcEsc(mfcDateLabel(duty?.date))}</span></p>
      ${mfcProgress(progress)}
      ${crew ? `<ul class="mfc-list">${crew}</ul>` : ""}
    `, { map: mission?.map, subtitle: duty?.duty_text || "" });
  }
}

class MyFlightFlightTrackCard extends MyFlightBaseCard {
  getCardSize() { return 4; }
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const track = a.flight_track;
    if (!track?.registration) {
      this._renderShell("Live flight track", `<p class="mfc-empty">No aircraft selected. Set a tail in the myFlight integration or on the home card.</p>`);
      return;
    }
    const pos = track.tracking?.position;
    const route = {
      departure: track.tracking?.route_departure,
      arrival: track.tracking?.route_arrival,
      progress: track.progress,
      leftTime: null,
      rightTime: null,
    };
    const alt = pos?.altitude_ft != null ? `${pos.altitude_ft} ft` : "";
    const gs = pos?.ground_speed_kt != null ? `${Math.round(pos.ground_speed_kt)} kt` : "";
    this._renderShell("Live flight track", `
      <p class="mfc-stat"><strong>${mfcEsc(track.registration)}</strong>
        <span class="mfc-muted">${mfcEsc([alt, gs].filter(Boolean).join(" · "))}</span></p>
      ${mfcProgress(route.departure ? route : null)}
      ${track.tracking?.found ? "" : `<p class="mfc-muted">${mfcEsc(track.tracking?.message || "No live ADS-B")}</p>`}
    `, { map: track.map, subtitle: pos?.on_ground ? "On ground" : "En route" });
  }
}

class MyFlightAirportStatsCard extends MyFlightBaseCard {
  getCardSize() { return 2; }
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const stats = a.airport_stats;
    if (!stats?.airport) {
      this._renderShell("Airport departures", `<p class="mfc-empty">Set an airport IATA on the myFlight integration (or use your base).</p>`);
      return;
    }
    if (stats.error) {
      this._renderShell("Airport departures", `<p class="mfc-error">${mfcEsc(stats.error)}</p>`, { subtitle: stats.airport });
      return;
    }
    const cells = [
      ["Total", stats.total],
      ["On time", stats.on_time],
      ["Delayed", stats.delayed],
      ["Cancelled", stats.cancelled],
      ["Punctual", stats.punctuality_percent != null ? `${stats.punctuality_percent}%` : "—"],
    ];
    this._renderShell("Airport departures", `
      <div class="mfc-grid">${cells.map(([l, v]) => `<div class="mfc-cell"><strong>${mfcEsc(v ?? "—")}</strong><span>${mfcEsc(l)}</span></div>`).join("")}</div>
    `, { subtitle: `${stats.airport} · ${stats.date || ""}` });
  }
}

class MyFlightLiveFleetCard extends MyFlightBaseCard {
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const fleet = a.live_fleet;
    if (!fleet) {
      this._renderShell("Live fleet", `<p class="mfc-empty">Fleet data not available.</p>`);
      return;
    }
    const rows = (fleet.aircraft || [])
      .map((ac) => `<li><strong>${mfcEsc(ac.registration)}</strong> <span class="mfc-muted">${mfcEsc(ac.route_departure || "")}${ac.route_arrival ? " → " + mfcEsc(ac.route_arrival) : ""}</span></li>`)
      .join("");
    const extra = fleet.airborne > 5 ? `<li class="mfc-muted">+ ${fleet.airborne - 5} more in flight</li>` : "";
    this._renderShell("Live fleet", `
      <p class="mfc-stat"><strong>${fleet.airborne ?? 0}</strong> <span class="mfc-muted">of ${fleet.total ?? "—"} airborne</span></p>
      ${rows ? `<ul class="mfc-list">${rows}${extra}</ul>` : ""}
    `);
  }
}

class MyFlightPartnerFlightCard extends MyFlightBaseCard {
  getCardSize() { return 5; }
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const live = a.partner_flight;
    if (!live || live.configured === false) {
      this._renderShell("Partner live flight", `<p class="mfc-empty">Partner B is not configured.</p>`);
      return;
    }
    if (!live.status) {
      this._renderShell(`${live.partner_label || "Partner"} · Live flight`, `<p class="mfc-empty">No live sector right now.</p>`);
      return;
    }
    const net = live.network || {};
    const progress = mfcProgressFromLeg(live.leg, { ...net, progress: live.progress });
    this._renderShell(`${live.partner_label || "Partner"} · Live flight`, `
      ${mfcProgress(progress)}
    `, { map: live.map, subtitle: live.status.replace("_", " ") });
  }
}

class MyFlightPartnerAccountsCard extends MyFlightBaseCard {
  getCardSize() { return 2; }
  _render() {
    const a = mfcAttrs(this._hass, this._entity());
    const accounts = a.partner_accounts || [];
    if (!accounts.length) {
      this._renderShell("Partner accounts", `<p class="mfc-empty">No ourRoster access for this user.</p>`);
      return;
    }
    const configured = accounts.filter((x) => x.configured).length;
    const rows = accounts.map((acc) => `<li><strong>${mfcEsc(acc.label)}</strong> <span class="mfc-muted">${acc.configured ? "connected" : "not configured"}${acc.last_error ? " · sync error" : ""}</span></li>`).join("");
    this._renderShell("Partner accounts", `
      <p class="mfc-muted">${configured} of ${accounts.length} connected</p>
      <ul class="mfc-list">${rows}</ul>
    `);
  }
}

const MFC_CARD_TYPES = [
  ["myflight-next-duty-card", MyFlightNextDutyCard, "myFlight Next duty", "Upcoming roster duty"],
  ["myflight-mission-card", MyFlightMissionCard, "myFlight Your mission", "Duty on the assigned tail with map"],
  ["myflight-flight-track-card", MyFlightFlightTrackCard, "myFlight Live flight track", "Tracked aircraft progress and map"],
  ["myflight-airport-stats-card", MyFlightAirportStatsCard, "myFlight Airport departures", "Delay and punctuality for a pinned airport"],
  ["myflight-live-fleet-card", MyFlightLiveFleetCard, "myFlight Live fleet", "Airborne Wizz Air count"],
  ["myflight-partner-flight-card", MyFlightPartnerFlightCard, "myFlight Partner live flight", "Partner B sector with map"],
  ["myflight-partner-accounts-card", MyFlightPartnerAccountsCard, "myFlight Partner accounts", "ourRoster connection status"],
];

class MyFlightCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { theme: "brand", ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }
  _set(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }
  _render() {
    if (!this._config) return;
    this._rendered = true;
    const entity = this._config.entity || "";
    const theme = this._config.theme || "brand";
    this.innerHTML = `
      <div style="display:grid;gap:10px;padding:4px 0">
        <label>Entity
          <input type="text" class="ent" value="${mfcEsc(entity)}" placeholder="sensor.myflight_status" style="width:100%">
        </label>
        <label>Theme
          <select class="thm">
            <option value="brand" ${theme === "brand" ? "selected" : ""}>myFlight brand</option>
            <option value="ha" ${theme === "ha" ? "selected" : ""}>Home Assistant</option>
          </select>
        </label>
      </div>
    `;
    this.querySelector(".ent").onchange = (e) => this._set("entity", e.target.value.trim());
    this.querySelector(".thm").onchange = (e) => this._set("theme", e.target.value);
  }
}

customElements.define("myflight-card-editor", MyFlightCardEditor);
MFC_CARD_TYPES.forEach(([tag, cls]) => {
  if (!customElements.get(tag)) customElements.define(tag, cls);
});

function mfcRegisterCards() {
  if (!window.customCards) window.customCards = [];
  const upsert = (def) => {
    const i = window.customCards.findIndex((c) => c && c.type === def.type);
    if (i >= 0) window.customCards[i] = def;
    else window.customCards.push(def);
  };
  MFC_CARD_TYPES.forEach(([type, , name, description]) => {
    upsert({
      type,
      name,
      description,
      preview: true,
      version: MFC_VERSION,
      documentationURL: MFC_DOC,
    });
  });
}

mfcRegisterCards();
