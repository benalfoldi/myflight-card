/**
 * myFlight Lovelace cards.
 */
const MFC_VERSION = "0.2.9";
const MFC_LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const MFC_LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const MFC_DOC = "https://github.com/benalfoldi/myflight-card";
const MFC_PLANE_PNG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>')}`;
const MFC_WX_KEY = "mfc-map-weather";
const MFC_TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const MFC_TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MFC_CAT_COLOR = {
  flight: "#2563eb",
  standby: "#d97706",
  off: "#64748b",
  paid_leave: "#16a34a",
  training: "#7c3aed",
  unknown: "#06b6d4",
};
const MFC_CAT_BG = {
  flight: "rgba(37,99,235,.12)",
  standby: "rgba(217,119,6,.12)",
  off: "rgba(100,116,139,.12)",
  paid_leave: "rgba(22,163,74,.12)",
  training: "rgba(124,58,237,.12)",
  unknown: "rgba(6,182,212,.12)",
};

function mfcIsSnapshot(attrs) {
  if (!attrs || typeof attrs !== "object") return false;
  return Boolean(
    attrs.profile
    || attrs.version
    || Object.prototype.hasOwnProperty.call(attrs, "next_duty")
    || Object.prototype.hasOwnProperty.call(attrs, "partner_flight")
    || Object.prototype.hasOwnProperty.call(attrs, "airport_stats")
  );
}

function mfcSnapshotIds(hass, pool) {
  const ids = [...new Set([
    ...(pool || []),
    ...(hass ? Object.keys(hass.states || {}) : []),
  ])];
  return ids.filter((id) => mfcIsSnapshot(hass?.states?.[id]?.attributes));
}

function mfcPickDefaultEntity(hass, pool) {
  const snapshots = mfcSnapshotIds(hass, pool);
  const preferred = snapshots.find((id) => id.includes("myflight") && id.endsWith("_status") && !id.includes("partner_status"))
    || snapshots.find((id) => id.endsWith("myflight_status") || id === "sensor.myflight_status")
    || snapshots[0];
  if (preferred) return preferred;
  return "sensor.myflight_status";
}

function mfcResolveEntity(hass, configured) {
  const requested = (configured || "").trim();
  if (requested && mfcIsSnapshot(hass?.states?.[requested]?.attributes)) {
    return requested;
  }
  return mfcPickDefaultEntity(hass, requested ? [requested] : []);
}

function mfcIsDark(hass) {
  try {
    if (hass?.themes?.darkMode) return true;
  } catch (_e) { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

function mfcIsFlightDuty(duty) {
  const type = String(duty?.duty_type || "").toLowerCase();
  if (type === "flight") return true;
  if (type && type !== "flight") return false;
  return Array.isArray(duty?.legs) && duty.legs.length > 0;
}

function mfcEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mfcClock(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text || text === "-" || text === "—") return "—";
  if (text.includes("T")) {
    const clock = text.split("T")[1]?.slice(0, 5);
    return clock || text;
  }
  const colon = text.match(/^(\d{1,2}):(\d{2})/);
  if (colon) {
    const hours = Number(colon[1]);
    const minutes = Number(colon[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${colon[2]}`;
    }
  }
  if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2)}`;
  const digits = text.replace(/\D/g, "");
  const clock = digits.length >= 4 ? digits.slice(0, 4) : digits.length === 3 ? `0${digits}` : "";
  if (clock.length === 4) {
    const hours = Number(clock.slice(0, 2));
    const minutes = Number(clock.slice(2, 4));
    if (hours <= 23 && minutes <= 59) return `${clock.slice(0, 2)}:${clock.slice(2)}`;
  }
  return String(value ?? "").trim() || "—";
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

function mfcWho(attrs) {
  const profile = attrs?.profile || {};
  return profile.display_name || profile.username || "";
}

function mfcTitled(base, attrs) {
  const who = mfcWho(attrs);
  return who ? `${base} · ${who}` : base;
}

function mfcIconPlane(color) {
  return `<span class="mfc-ico" style="background:${color}" aria-hidden="true"></span>`;
}

function mfcStatusLabel(status) {
  return String(status || "").replace(/_/g, " ").trim();
}

function mfcStatusClass(status) {
  const key = String(status || "").toLowerCase().replace(/\s+/g, "_");
  if (key === "preflight" || key === "on_ground" || key === "on ground") return "preflight";
  if (key === "landed") return "landed";
  return "en-route";
}

function mfcIsActivityCode(token) {
  return /^[A-Z][A-Z0-9]{1,5}$/i.test(token) && !String(token).includes("-");
}

function mfcShortDutyLabel(row, compact) {
  const code = String(row?.code || "").replace(/[\r\n]/g, " ").trim();
  const text = String(row?.text || "").replace(/[\r\n]/g, " ").trim();
  const blob = `${code} ${text}`.toUpperCase();
  const route = blob.match(/\b([A-Z]{3}(?:-[A-Z]{3})+)\b/);
  if (route) {
    const flight = blob.match(/\b(\d{3,5})\b/);
    if (compact) return route[1];
    return flight ? `${flight[1]}\n${route[1]}` : route[1];
  }
  const tokens = (code || text).split(/[\s/·]+/).filter(Boolean).map((t) => t.toUpperCase());
  if (tokens.length && tokens.every((t) => mfcIsActivityCode(t))) return tokens.join(" ");
  const first = tokens.find((t) => mfcIsActivityCode(t));
  return first || tokens[0] || "";
}

function mfcCalLabelHtml(label) {
  return mfcEsc(label).replace(/\n/g, "<br>").replace(/-/g, "-<wbr>");
}

function mfcLocalIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function mfcRemainingMins(times) {
  if (!times || times.arr_label === "ATA") return null;
  if (times.eta_at) {
    const ms = Date.parse(times.eta_at);
    if (Number.isFinite(ms)) return Math.round((ms - Date.now()) / 60000);
  }
  if (times.eta_in_minutes == null || times.eta_in_minutes === "") return null;
  const mins = Number(times.eta_in_minutes);
  return Number.isFinite(mins) ? mins : null;
}

function mfcFormatDuration(mins) {
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours > 0) return `${hours}h ${String(rest).padStart(2, "0")}m`;
  return `${mins}m`;
}

function mfcTimesLegend(attrs) {
  const label = attrs?.time_display?.label;
  if (!label) return "";
  return `<span class="mfc-tz">${mfcEsc(`Times ${label}`)}</span>`;
}

function mfcEtaLeft(times) {
  if (!times || times.arr_label === "ATA" || times.departed === false) return "";
  const mins = mfcRemainingMins(times);
  if (mins == null) return "";
  if (mins <= 0) return "Arriving now";
  return `Arriving in ${mfcFormatDuration(mins)}`;
}

function mfcWeatherPrefs(config) {
  let storms = config.weather_storms;
  let rain = config.weather_rain;
  let wind = config.weather_wind;
  try {
    const stored = JSON.parse(localStorage.getItem(MFC_WX_KEY) || "null");
    if (stored && typeof stored === "object") {
      if (storms == null) storms = stored.thunderstorms;
      if (rain == null) rain = stored.precipitation;
      if (wind == null) wind = stored.winds;
    }
  } catch (_e) { /* ignore */ }
  return {
    thunderstorms: storms !== false,
    precipitation: rain !== false,
    winds: wind === true,
  };
}

function mfcSaveWeather(prefs) {
  try { localStorage.setItem(MFC_WX_KEY, JSON.stringify(prefs)); } catch (_e) { /* ignore */ }
}

function mfcStyles(dark, theme) {
  const brand = theme !== "ha";
  const navyFill = brand ? "#0a1f44" : "var(--primary-color)";
  const navy = brand
    ? (dark ? "var(--primary-text-color, #f1f5f9)" : "#0a1f44")
    : "var(--primary-text-color)";
  const magenta = brand ? "#c6007e" : "var(--primary-color)";
  const card = "var(--ha-card-background, var(--card-background-color, var(--primary-background-color, #fff)))";
  const text = "var(--primary-text-color, #0f172a)";
  const muted = "var(--secondary-text-color, #64748b)";
  const border = "var(--ha-card-border-color, var(--divider-color, #e2e8f0))";
  const bg = "color-mix(in srgb, var(--primary-text-color) 8%, transparent)";
  const ok = dark ? "#86efac" : "#166534";
  const tight = dark ? "#fca5a5" : "#991b1b";
  const early = dark ? "#4ade80" : "#16a34a";
  const late = dark ? "#f87171" : "#dc2626";
  return `
    :host { display: block; }
    ha-card {
      background: ${card};
      color: ${text};
    }
    .mfc-status[hidden], .mfc-sub[hidden], .mfc-map[hidden] { display: none !important; }
    .mfc {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: transparent;
      color: ${text};
      border: 0;
      border-radius: 0;
      padding: 14px 16px;
      box-sizing: border-box;
    }
    .mfc-h {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 10px; margin-bottom: 10px;
    }
    .mfc-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: ${navy}; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
    .mfc-ico {
      display: inline-block; width: 18px; height: 18px; flex: 0 0 18px;
      background-color: currentColor;
      -webkit-mask: url("${MFC_PLANE_PNG}") center / contain no-repeat;
      mask: url("${MFC_PLANE_PNG}") center / contain no-repeat;
    }
    .mfc-sub { color: ${muted}; font-size: 0.82rem; }
    .mfc-h-main { min-width: 0; }
    .mfc-h-extra { flex: 0 0 auto; }
    .mfc-tz { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${muted}; }
    .mfc-status {
      display: inline-flex; align-items: center; margin-top: 6px;
      font-size: 0.78rem; font-weight: 800; letter-spacing: 0.04em;
      text-transform: uppercase; padding: 4px 10px; border-radius: 999px;
      background: rgba(198, 0, 126, 0.16); color: ${magenta};
      border: 1px solid rgba(198, 0, 126, 0.45);
    }
    .mfc-status.preflight {
      background: color-mix(in srgb, ${navyFill} 14%, transparent); color: ${navy};
      border-color: color-mix(in srgb, ${navyFill} 35%, transparent);
    }
    .mfc-status.landed {
      background: rgba(13, 148, 136, 0.14); color: ${dark ? "#5eead4" : "#0d9488"};
      border-color: rgba(13, 148, 136, 0.4);
    }
    .mfc-eta { margin: 8px 0 0; font-size: 0.92rem; font-weight: 700; color: ${navy}; }
    .mfc-toggle { display: flex; border: 1px solid ${border}; border-radius: 8px; overflow: hidden; }
    .mfc-toggle button {
      font: inherit; font-size: 0.72rem; font-weight: 700; padding: 6px 10px;
      min-height: 32px; border: 0; background: ${bg}; color: ${muted}; cursor: pointer;
    }
    .mfc-toggle button.on { background: ${navyFill}; color: #fff; }
    .mfc-h-toggles { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
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
    .mfc-chip.late { color: ${late}; border-color: color-mix(in srgb, ${late} 40%, transparent); }
    .mfc-chip.early { color: ${early}; border-color: color-mix(in srgb, ${early} 40%, transparent); }
    .mfc-chip.ontime, .mfc-chip.on-time { color: ${magenta}; }
    .mfc-chip.tight { color: ${tight}; border-color: color-mix(in srgb, ${tight} 45%, transparent); background: color-mix(in srgb, ${tight} 14%, transparent); }
    .mfc-chip.ok { color: ${ok}; border-color: color-mix(in srgb, ${ok} 45%, transparent); background: color-mix(in srgb, ${ok} 14%, transparent); }
    .mfc-chip.long, .mfc-chip.unknown { color: ${muted}; }
    .mfc-error { color: #dc2626; font-size: 0.88rem; }
    .mfc-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
      gap: 8px; margin-top: 8px;
    }
    .mfc-cell { background: ${bg}; border: 1px solid ${border}; border-radius: 10px; padding: 8px; text-align: center; }
    .mfc-cell strong { display: block; font-size: 1.05rem; }
    .mfc-cell span { color: ${muted}; font-size: 0.72rem; }
    .mfc-cell.late strong { color: ${late}; }
    .mfc-cell.early strong { color: ${early}; }
    .mfc-cell.ok strong { color: ${navy}; }
    .mfc-cell.cancel strong { color: ${magenta}; }
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
      width: 20px; height: 20px; transform: translate(-50%, -50%) rotate(90deg);
      background-color: ${magenta};
      -webkit-mask: url("${MFC_PLANE_PNG}") center / contain no-repeat;
      mask: url("${MFC_PLANE_PNG}") center / contain no-repeat;
    }
    .mfc-ends { display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 700; }
    .mfc-times { display: flex; justify-content: space-between; color: ${muted}; font-size: 0.78rem; margin-top: 2px; }
    .mfc-map { height: 220px; margin-top: 10px; border-radius: 12px; overflow: hidden; border: 1px solid ${border}; z-index: 0; position: relative; }
    .mfc-map.leaflet-container { background: ${dark ? "#1b1b1b" : "#e8eef4"}; }
    .mfc-wx {
      position: absolute; top: 8px; right: 8px; z-index: 500;
      display: flex; gap: 4px;
    }
    .mfc-wx button {
      font: inherit; font-size: 0.72rem; font-weight: 700; min-width: 28px; height: 28px;
      border-radius: 8px; border: 1px solid ${border}; background: ${card}; color: ${muted}; cursor: pointer;
    }
    .mfc-wx button.on { color: ${magenta}; border-color: ${magenta}; }
    .mfc-board { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 8px; }
    .mfc-board th { text-align: left; color: ${muted}; font-weight: 600; padding: 4px 6px; }
    .mfc-board td { padding: 5px 6px; border-top: 1px solid ${border}; }
    .mfc-board .late { color: ${late}; font-weight: 600; }
    .mfc-board .early { color: ${early}; font-weight: 600; }
    .mfc-board .cancel { color: ${magenta}; text-decoration: line-through; }
    .mfc-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: 8px; }
    .mfc-cal-h { text-align: center; font-size: 0.68rem; color: ${muted}; font-weight: 600; padding: 2px 0; }
    .mfc-cal-d {
      height: 64px; min-height: 64px; max-height: 64px; box-sizing: border-box;
      overflow: hidden; border-radius: 8px; padding: 3px 4px; font-size: 0.62rem; line-height: 1.15;
      border: 1px solid ${border}; background: ${bg};
      display: flex; flex-direction: column;
    }
    .mfc-cal-d .num { font-weight: 700; display: block; margin-bottom: 1px; flex: 0 0 auto; }
    .mfc-cal-d .lbl {
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden; overflow-wrap: anywhere; word-break: break-word; min-height: 0;
    }
    .mfc-cal--codes .mfc-cal-d .lbl {
      white-space: normal; text-overflow: unset; font-size: 0.58rem; line-height: 1.12;
      -webkit-line-clamp: 4;
    }
    .mfc-cal-d.today { box-shadow: inset 0 0 0 2px ${magenta}; opacity: 1; }
    .mfc-cal-d.today .num { color: ${magenta}; }
    .mfc.compact { padding: 8px 10px; }
    .mfc.compact .mfc-h { margin-bottom: 4px; gap: 6px; }
    .mfc.compact .mfc-title { font-size: 0.92rem; }
    .mfc.compact .mfc-sub { font-size: 0.72rem; }
    .mfc.compact .mfc-cal { gap: 2px; margin-top: 4px; }
    .mfc.compact .mfc-cal-h { font-size: 0.6rem; padding: 0; }
    .mfc.compact .mfc-cal-d {
      height: 44px; min-height: 44px; max-height: 44px; padding: 2px 3px; font-size: 0.58rem; border-radius: 6px;
    }
    .mfc.compact .mfc-cal-d .num { margin-bottom: 0; font-size: 0.62rem; }
    .mfc.compact .mfc-cal--codes .mfc-cal-d .lbl { -webkit-line-clamp: 2; font-size: 0.52rem; }
    .mfc.compact .mfc-stat { font-size: 0.98rem; }
    .mfc.compact .mfc-muted { font-size: 0.78rem; }
    .mfc.compact .mfc-chips { margin-top: 4px; gap: 4px; }
    .mfc.compact .mfc-chip { font-size: 0.68rem; padding: 2px 6px; }
    .mfc.compact .mfc-sector { margin-top: 4px; }
    .mfc.compact .mfc-sector-k { font-size: 0.62rem; margin-bottom: 0; }
    .mfc.compact .mfc-sector-v { font-size: 0.8rem; gap: 6px; }
    .mfc.compact .mfc-eta { margin: 4px 0 0; font-size: 0.82rem; }
    .mfc.compact .mfc-list { margin-top: 4px; font-size: 0.78rem; line-height: 1.3; }
    .mfc.compact .mfc-list li + li { margin-top: 1px; }
    .mfc.compact .mfc-map { height: 168px; margin-top: 8px; border-radius: 10px; }
    .mfc.compact .mfc-crew { margin: 6px 0 0; font-size: 0.72rem; line-height: 1.35; }
    .mfc.compact .mfc-status { margin-top: 2px; padding: 2px 8px; font-size: 0.7rem; }
    .mfc.compact .mfc-ends { font-size: 0.75rem; }
    .mfc.compact .mfc-times { font-size: 0.7rem; }
    .mfc.compact .mfc-progress { height: 6px; margin: 6px 0 4px; }
    .mfc.compact .mfc-plane { width: 16px; height: 16px; }
    .mfc-sector { margin-top: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid ${border}; }
    .mfc-sector.inbound {
      background: color-mix(in srgb, ${navyFill} 8%, ${card});
      border-left: 3px solid ${navyFill};
    }
    .mfc-sector.outbound {
      background: color-mix(in srgb, ${magenta} 8%, ${card});
      border-left: 3px solid ${magenta};
    }
    .mfc-sector-k {
      display: block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; color: ${muted}; margin-bottom: 2px;
    }
    .mfc-sector-v { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; font-size: 0.88rem; }
    .mfc-crew { margin: 8px 0 0; line-height: 1.4; }
    .mfc-crew strong { color: ${navy}; font-weight: 800; }
    .mfc-duty-list { margin: 6px 0; }
    .mfc-duty-sec { margin-top: 6px; }
    .mfc-duty-sec.done .mfc-duty-sec-v { color: ${muted}; }
    .mfc-duty-sec-v { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; font-size: 0.82rem; }
    .mfc.compact .mfc-duty-sec { margin-top: 4px; }
    .mfc.compact .mfc-duty-sec-v { font-size: 0.78rem; }
    .mfc-change-alert {
      margin: 0 0 8px; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.04em;
      text-transform: uppercase; color: ${magenta};
    }
    .mfc-change-list { list-style: none; margin: 0; padding: 0; }
    .mfc-change + .mfc-change { margin-top: 8px; padding-top: 8px; border-top: 1px solid ${border}; }
    .mfc-change-date { font-size: 0.72rem; font-weight: 700; color: ${muted}; margin-bottom: 4px; }
    .mfc-change-pair { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; font-size: 0.86rem; }
    .mfc-change-old { color: ${muted}; text-decoration: line-through; }
    .mfc-change-arrow { color: ${magenta}; font-weight: 800; }
    .mfc-change-new { font-weight: 700; color: ${navy}; }
    .mfc-fids {
      margin-top: 8px; border-radius: 12px; overflow: hidden;
      background: ${dark ? "#070b14" : "#eef2f8"};
      color: ${dark ? "#f3e2a0" : "#0a1f44"};
      border: 1px solid ${dark ? "#1c2740" : "#c5d0e0"};
      font-variant-numeric: tabular-nums;
    }
    .mfc-fids-head {
      display: flex; justify-content: space-between; gap: 8px; align-items: baseline;
      padding: 10px 12px 8px;
      background: ${dark ? "#0c1424" : "#0a1f44"};
      border-bottom: 1px solid ${dark ? "#24304a" : "#14284f"};
    }
    .mfc-fids-airport { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.08em; color: #fff; }
    .mfc-fids-meta { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em; color: ${dark ? "#8ea0c0" : "#b8c6de"}; text-transform: uppercase; }
    .mfc-fids-cols, .mfc-fids-row {
      display: grid; grid-template-columns: 3.2rem 3rem minmax(0, 1.5fr) 3.2rem minmax(4.6rem, 0.9fr);
      gap: 6px; align-items: center;
    }
    .mfc-fids-cols {
      padding: 4px 12px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em;
      text-transform: uppercase; color: ${dark ? "#7f91b3" : "#5b6d8a"};
    }
    .mfc-fids-scroll { max-height: 380px; overflow: auto; }
    .mfc-fids-row {
      padding: 7px 12px; font-size: 0.78rem;
      border-top: 1px solid ${dark ? "#182238" : "#d5deea"};
      color: ${dark ? "#f3e2a0" : "#0a1f44"};
    }
    .mfc-fids-row .dest { color: ${dark ? "#fff" : "#0a1f44"}; font-weight: 700; min-width: 0; }
    .mfc-fids-row .dest small { display: block; color: ${dark ? "#8ea0c0" : "#5b6d8a"}; font-weight: 600; font-size: 0.66rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mfc-fids-status { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; }
    .mfc-fids-lamp {
      width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: 0 0 8px;
      box-shadow: 0 0 6px currentColor;
    }
    .mfc-fids-row.ontime .mfc-fids-status { color: ${dark ? "#7dffa8" : "#15803d"}; }
    .mfc-fids-row.ontime .mfc-fids-lamp,
    .mfc-fids-row.early .mfc-fids-lamp {
      animation: mfc-fids-pulse 1.6s ease-in-out infinite;
    }
    .mfc-fids-row.late { color: ${dark ? "#ffb347" : "#b45309"}; }
    .mfc-fids-row.late .mfc-fids-status { color: ${dark ? "#ff5a5a" : "#dc2626"}; }
    .mfc-fids-row.late .mfc-fids-lamp { animation: mfc-fids-blink 1.05s step-end infinite; }
    .mfc-fids-row.early .mfc-fids-status { color: ${dark ? "#7dffa8" : "#15803d"}; }
    .mfc-fids-row.departed { color: ${dark ? "#6d7c96" : "#64748b"}; }
    .mfc-fids-row.departed .dest { color: ${dark ? "#9aa8c2" : "#64748b"}; }
    .mfc-fids-row.cancel { color: ${dark ? "#ff5a5a" : "#dc2626"}; text-decoration: line-through; }
    .mfc-fids-row.next, .mfc-fids-row.now {
      background: ${dark ? "rgba(198, 0, 126, 0.16)" : "rgba(198, 0, 126, 0.10)"};
      box-shadow: inset 3px 0 0 ${magenta};
    }
    .mfc-fids-now-mark {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 12px; font-size: 0.62rem; font-weight: 800;
      letter-spacing: 0.16em; color: ${magenta};
      background: ${dark ? "#10182a" : "#f4e7f1"};
    }
    .mfc-fids-now-line { flex: 1; height: 1px; background: ${magenta}; opacity: 0.7; }
    @keyframes mfc-fids-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }
    @keyframes mfc-fids-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor; }
      50% { opacity: 0.35; box-shadow: 0 0 2px currentColor; }
    }
    @media (prefers-reduced-motion: reduce) {
      .mfc-fids-row.late .mfc-fids-lamp,
      .mfc-fids-row.ontime .mfc-fids-lamp,
      .mfc-fids-row.early .mfc-fids-lamp { animation: none; }
    }
    .mfc-cal-d.empty { background: transparent; border-color: transparent; }
    .mfc-cal-d.weekend { opacity: .85; }
    .mfc-badge { padding: 10px 12px; }
    a { color: ${magenta}; }
  `;
}

function mfcProgress(display) {
  if (!display || !display.departure) return "";
  const pct = Math.round(Math.max(0, Math.min(1, Number(display.progress) || 0)) * 100);
  const times = display.times || {};
  const leftLabel = times.dep_label || display.leftTimeLabel || "STD";
  const rightLabel = times.arr_label || display.rightTimeLabel || "STA";
  const leftTime = times.dep_time || display.leftTime;
  const rightTime = times.arr_time || display.rightTime;
  const eta = mfcEtaLeft(times);
  const depChip = display.depDelayText && display.depDelayText !== "On time"
    ? `<span class="mfc-chip ${mfcEsc(display.depDelayTone || "")}">Dep · ${mfcEsc(display.depDelayText)}</span>`
    : "";
  const arrChip = display.arrDelayText && display.arrDelayText !== "On time"
    ? `<span class="mfc-chip ${mfcEsc(display.arrDelayTone || "")}">Arr · ${mfcEsc(display.arrDelayText)}</span>`
    : "";
  return `
    <div class="mfc-ends"><span>${mfcEsc(display.departure)}</span><span>${mfcEsc(display.arrival)}</span></div>
    <div class="mfc-progress" style="--p:${pct}%">
      <div class="mfc-progress-fill"></div>
      <div class="mfc-plane" title="${pct}%"></div>
    </div>
    <div class="mfc-times">
      <span>${mfcEsc(leftLabel)} ${mfcEsc(mfcClock(leftTime))}</span>
      <span>${mfcEsc(rightLabel)} ${mfcEsc(mfcClock(rightTime))}</span>
    </div>
    ${eta ? `<p class="mfc-eta" data-eta-at="${mfcEsc(times.eta_at || "")}" data-mins="${times.eta_in_minutes ?? ""}" data-arr-label="${mfcEsc(times.arr_label || "ETA")}">${mfcEsc(eta)}</p>` : ""}
    ${(depChip || arrChip) ? `<div class="mfc-chips">${depChip}${arrChip}</div>` : ""}
  `;
}

function mfcDelayChips(net) {
  if (!net) return "";
  const chips = [];
  if (net.departure_delay_text && net.departure_delay_text !== "On time") {
    chips.push(`<span class="mfc-chip ${mfcEsc(net.departure_delay_tone || "")}">Dep · ${mfcEsc(net.departure_delay_text)}</span>`);
  }
  if (net.arrival_delay_text && net.arrival_delay_text !== "On time") {
    chips.push(`<span class="mfc-chip ${mfcEsc(net.arrival_delay_tone || "")}">Arr · ${mfcEsc(net.arrival_delay_text)}</span>`);
  }
  return chips.join("");
}

function mfcNetClock(net, side) {
  if (!net) return "";
  if (side === "arr") {
    const label = net.arrival_is_actual && net.ata ? "ATA" : (net.eta && net.eta !== net.sta ? "ETA" : "STA");
    return `${label} ${mfcClock(net.ata || net.eta || net.sta)}`;
  }
  const label = net.departure_is_actual && net.atd ? "ATD" : (net.etd && net.etd !== net.std ? "ETD" : "STD");
  return `${label} ${mfcClock(net.atd || net.etd || net.std)}`;
}

function mfcNeighbor(title, net, side, extra) {
  if (!net || !net.departure) return "";
  const opts = extra || {};
  const num = net.flight_number ? `${mfcEsc(net.flight_number)} · ` : "";
  const delay = mfcDelayChips(net);
  const turn = mfcTurnaroundChip(opts.turnaround, true);
  const chips = `${delay}${turn}`;
  const variant = opts.variant ? ` ${opts.variant}` : "";
  return `<div class="mfc-sector${variant}">
    <span class="mfc-sector-k">${mfcEsc(title)}</span>
    <span class="mfc-sector-v"><strong>${num}${mfcEsc(net.departure)} → ${mfcEsc(net.arrival)}</strong>
      <span class="mfc-muted">${mfcEsc(mfcNetClock(net, side))}</span></span>
    ${chips ? `<div class="mfc-chips">${chips}</div>` : ""}
  </div>`;
}

function mfcLeadRank(rank) {
  const text = String(rank || "").toUpperCase();
  return /\bCP\b/.test(text) || /\bSC\b/.test(text);
}

function mfcCrewLine(crewList) {
  if (!Array.isArray(crewList) || !crewList.length) return "";
  const parts = crewList.map((member) => {
    const label = `${member.rank || ""} ${member.name || ""}`.trim();
    if (!label) return "";
    return mfcLeadRank(member.rank) ? `<strong>${mfcEsc(label)}</strong>` : mfcEsc(label);
  }).filter(Boolean);
  return parts.length ? `<p class="mfc-muted mfc-crew">${parts.join(" · ")}</p>` : "";
}

function mfcDutySectors(sectors, mission) {
  if (!Array.isArray(sectors) || !sectors.length) {
    return mfcProgress(mfcProgressFromLeg(mission?.leg, {
      ...(mission?.network || {}),
      progress: mission?.progress,
      times: mission?.times,
    }));
  }
  const blocks = sectors.map((sec) => {
    const net = sec.network || {};
    const merged = { ...(sec.leg || {}), ...net };
    const ta = mfcTurnaroundChip(sec.turnaround_after);
    if (sec.active) {
      const progress = mfcProgressFromLeg(merged, {
        ...merged,
        progress: mission?.progress ?? sec.progress,
        times: mission?.times,
      });
      return `<div class="mfc-duty-sec active">${mfcProgress(progress)}${ta ? `<div class="mfc-chips">${ta}</div>` : ""}</div>`;
    }
    const done = Number(sec.progress) >= 1;
    const num = merged.flight_number ? `${mfcEsc(merged.flight_number)} · ` : "";
    const delay = mfcDelayChips(net);
    const clock = mfcNetClock(merged, done ? "arr" : "dep")
      || `${done ? "STA" : "STD"} ${mfcClock(done ? merged.sta : merged.std)}`;
    return `<div class="mfc-duty-sec${done ? " done" : ""}">
      <div class="mfc-duty-sec-v"><strong>${num}${mfcEsc(merged.departure || "")} → ${mfcEsc(merged.arrival || "")}</strong>
        <span class="mfc-muted">${mfcEsc(clock)}</span></div>
      ${delay || ta ? `<div class="mfc-chips">${delay}${ta}</div>` : ""}
    </div>`;
  });
  return `<div class="mfc-duty-list">${blocks.join("")}</div>`;
}

function mfcClockMinutes(value) {
  const clock = mfcClock(value);
  const match = String(clock).match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function mfcNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function mfcNowClock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function mfcFidsStatus(flight) {
  if (flight.cancelled) return { text: "CNL", cls: "cancel" };
  if (flight.atd) return { text: "DEP", cls: "departed" };
  const tone = String(flight.delay_tone || "");
  if (tone === "late") return { text: String(flight.delay_text || "Delayed").toUpperCase(), cls: "late" };
  if (tone === "early") return { text: String(flight.delay_text || "Early").toUpperCase(), cls: "early" };
  return { text: "ON TIME", cls: "ontime" };
}

function mfcFidsSortKey(flight) {
  return mfcClockMinutes(flight.std) ?? 9999;
}

function mfcFidsEffectiveMinutes(flight) {
  return mfcClockMinutes(flight.atd || flight.etd || flight.std);
}

function mfcFidsBoard(stats) {
  const flights = (stats.flights || []).slice().sort((left, right) => mfcFidsSortKey(left) - mfcFidsSortKey(right));
  const nowMins = mfcNowMinutes();
  const nowClock = mfcNowClock();
  let insertAt = flights.findIndex((flight) => {
    const mins = mfcFidsEffectiveMinutes(flight);
    return mins != null && mins > nowMins;
  });
  if (insertAt < 0) insertAt = flights.length;
  const rows = [];
  flights.forEach((flight, index) => {
    if (index === insertAt) {
      rows.push(`<div class="mfc-fids-now-mark"><span>NOW</span><span class="mfc-fids-now-line"></span><span>${mfcEsc(nowClock)}</span></div>`);
    }
    const status = mfcFidsStatus(flight);
    const marker = index === insertAt ? " now next" : "";
    const extras = [flight.destination_name, flight.gate, flight.registration || flight.aircraft_type]
      .filter(Boolean)
      .join(" · ");
    rows.push(`<div class="mfc-fids-row ${status.cls}${marker}">
      <span>${mfcEsc(mfcClock(flight.std))}</span>
      <span>${mfcEsc(flight.flight_number || "")}</span>
      <span class="dest">${mfcEsc(flight.destination || "")}${extras ? `<small>${mfcEsc(extras)}</small>` : ""}</span>
      <span>${mfcEsc(mfcClock(flight.atd || flight.etd))}</span>
      <span class="mfc-fids-status"><span class="mfc-fids-lamp"></span>${mfcEsc(status.text)}</span>
    </div>`);
  });
  if (insertAt === flights.length && flights.length) {
    rows.push(`<div class="mfc-fids-now-mark"><span>NOW</span><span class="mfc-fids-now-line"></span><span>${mfcEsc(nowClock)}</span></div>`);
  }
  return `<div class="mfc-fids">
    <div class="mfc-fids-head">
      <span class="mfc-fids-airport">${mfcEsc(stats.airport)}</span>
      <span class="mfc-fids-meta">Departures · ${mfcEsc(stats.date || "")} · ${flights.length}</span>
    </div>
    <div class="mfc-fids-cols">
      <span>STD</span><span>Flt</span><span>To</span><span>ETD</span><span>Status</span>
    </div>
    <div class="mfc-fids-scroll">${rows.join("") || `<div class="mfc-fids-row">No departures</div>`}</div>
  </div>`;
}

function mfcTurnaroundChip(ta) {
  if (!ta || !ta.text) return "";
  return `<span class="mfc-chip ${mfcEsc(ta.tone || "long")}">Turnaround · ${mfcEsc(ta.text)}</span>`;
}

function mfcTurnaroundRow(items) {
  const chips = (items || []).map((ta) => mfcTurnaroundChip(ta)).filter(Boolean).join("");
  return chips ? `<div class="mfc-chips">${chips}</div>` : "";
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
    html: `<div style="width:18px;height:18px;background:#c6007e;-webkit-mask:url('${MFC_PLANE_PNG}') center / contain no-repeat;mask:url('${MFC_PLANE_PNG}') center / contain no-repeat;transform:rotate(${rot}deg)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function mfcGeodesic(start, end, steps) {
  if (!start || !end || start[0] == null || end[0] == null) return [];
  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;
  const sinLat = Math.sin((lat2 - lat1) / 2);
  const sinLon = Math.sin((lon2 - lon1) / 2);
  const delta = 2 * Math.asin(Math.sqrt(
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon,
  ));
  if (!Number.isFinite(delta) || delta < 1e-12) return [start, end];
  const count = steps || 16;
  const out = [];
  for (let i = 0; i <= count; i += 1) {
    const frac = i / count;
    const a = Math.sin((1 - frac) * delta) / Math.sin(delta);
    const b = Math.sin(frac * delta) / Math.sin(delta);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    out.push([lat * 180 / Math.PI, lon * 180 / Math.PI]);
  }
  return out;
}

function mfcKm(a, b) {
  if (!a || !b) return 0;
  const lat1 = a[0] * Math.PI / 180;
  const lon1 = a[1] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const lon2 = b[1] * Math.PI / 180;
  const hav = Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(hav)));
}

function mfcPointFraction(pt, origin, dest, routeKm) {
  const fromDep = mfcKm(pt, origin);
  const fromArr = mfcKm(pt, dest);
  if (fromDep + fromArr > routeKm + 180) return null;
  if (routeKm < 1) return fromDep <= 80 ? 0 : 1;
  return fromDep / routeKm;
}

function mfcFilterTrailToSector(points, dep, arr) {
  if (!dep || !arr || dep.lat == null || arr.lat == null || !points.length) return points;
  const origin = [dep.lat, dep.lon];
  const dest = [arr.lat, arr.lon];
  const routeKm = mfcKm(origin, dest);
  let lastNear = -1;
  for (let i = 0; i < points.length; i += 1) {
    if (mfcKm(points[i], origin) <= 80) lastNear = i;
  }
  let sliced = points;
  if (lastNear >= 0) {
    let start = lastNear;
    while (start > 0 && mfcKm(points[start - 1], origin) <= 80) start -= 1;
    sliced = points.slice(start);
  }
  if (!sliced.length) return sliced;
  const last = sliced[sliced.length - 1];
  const aircraftT = mfcPointFraction(last, origin, dest, routeKm) ?? 1;
  const filtered = sliced.filter((pt) => {
    const fraction = mfcPointFraction(pt, origin, dest, routeKm);
    return fraction != null && fraction <= aircraftT + 0.12;
  });
  return filtered.length ? filtered : sliced.slice(-8);
}

function mfcShouldFillFromDep(origin, first, dest) {
  const gap = mfcKm(origin, first);
  if (gap <= 2) return false;
  if (!dest) return true;
  const fromArr = mfcKm(first, dest);
  const routeKm = mfcKm(origin, dest);
  const onCorridor = gap + fromArr <= routeKm + 180;
  const closerToDep = gap <= fromArr || gap <= 80;
  return onCorridor && closerToDep;
}

function mfcTeardownMap(host) {
  if (!host) return;
  if (host._mfcWxStop) {
    try { host._mfcWxStop(); } catch (_e) { /* ignore */ }
    host._mfcWxStop = null;
  }
  if (host._mfcMap) {
    try { host._mfcMap.remove(); } catch (_e) { /* ignore */ }
    host._mfcMap = null;
  }
  host._mfcLayers = null;
  host._mfcRouteKey = null;
  host._mfcPending = false;
  host._mfcPendingData = null;
  host._mfcBaseTiles = null;
  host._mfcDark = null;
}

function mfcRouteKey(data) {
  const dep = data?.departure || {};
  const arr = data?.arrival || {};
  return `${dep.lat ?? ""},${dep.lon ?? ""}|${arr.lat ?? ""},${arr.lon ?? ""}`;
}

function mfcEnsureBaseTiles(L, map, host, dark) {
  if (host._mfcDark === Boolean(dark) && host._mfcBaseTiles) return;
  host._mfcDark = Boolean(dark);
  if (host._mfcBaseTiles) {
    try { map.removeLayer(host._mfcBaseTiles); } catch (_e) { /* ignore */ }
    host._mfcBaseTiles = null;
  }
  host._mfcBaseTiles = L.tileLayer(dark ? MFC_TILE_DARK : MFC_TILE_LIGHT, {
    maxZoom: 13,
    subdomains: "abcd",
  }).addTo(map);
  host._mfcBaseTiles.bringToBack();
}

function mfcSyncMapLayers(L, map, host, data, dark) {
  const layers = host._mfcLayers || {};
  const bounds = [];
  const dep = data.departure;
  const arr = data.arrival;
  const routeKey = mfcRouteKey(data);
  const routeChanged = host._mfcRouteKey !== routeKey;
  host._mfcRouteKey = routeKey;
  const ink = dark ? "#e2e8f8" : "#0a1f44";

  const setCircle = (key, lat, lon, opts) => {
    if (lat == null || lon == null) {
      if (layers[key]) { map.removeLayer(layers[key]); layers[key] = null; }
      return;
    }
    const latlng = [lat, lon];
    bounds.push(latlng);
    if (layers[key]) {
      layers[key].setLatLng(latlng);
      layers[key].setStyle(opts);
    } else {
      layers[key] = L.circleMarker(latlng, opts).addTo(map);
    }
  };

  setCircle("dep", dep?.lat, dep?.lon, { radius: 5, color: ink, fillColor: ink, fillOpacity: 1 });
  setCircle("arr", arr?.lat, arr?.lon, { radius: 5, color: "#c6007e", fillColor: "#c6007e", fillOpacity: 1 });

  const here = data.latitude != null && data.longitude != null
    ? [data.latitude, data.longitude]
    : null;
  const remaining = here && arr?.lat != null
    ? mfcGeodesic(here, [arr.lat, arr.lon], 16)
    : (dep?.lat != null && arr?.lat != null ? mfcGeodesic([dep.lat, dep.lon], [arr.lat, arr.lon], 16) : []);
  if (remaining.length > 1) {
    if (layers.route) layers.route.setLatLngs(remaining);
    else {
      layers.route = L.polyline(remaining, {
        color: "#c6007e",
        weight: 2,
        dashArray: "6 6",
        opacity: 0.7,
      }).addTo(map);
    }
  } else if (layers.route) {
    map.removeLayer(layers.route);
    layers.route = null;
  }

  let trailLatLngs = (Array.isArray(data.trail) ? data.trail : [])
    .filter((p) => p && p.latitude != null && p.longitude != null)
    .map((p) => [p.latitude, p.longitude]);
  trailLatLngs = mfcFilterTrailToSector(trailLatLngs, dep, arr);
  const origin = dep?.lat != null ? [dep.lat, dep.lon] : null;
  const dest = arr?.lat != null ? [arr.lat, arr.lon] : null;
  if (origin && trailLatLngs.length && mfcShouldFillFromDep(origin, trailLatLngs[0], dest)) {
    if (mfcKm(origin, trailLatLngs[0]) > 25) {
      trailLatLngs = mfcGeodesic(origin, trailLatLngs[0], 10).slice(0, -1).concat(trailLatLngs);
    } else {
      trailLatLngs = [origin, ...trailLatLngs];
    }
  } else if (origin && here && trailLatLngs.length < 2 && mfcShouldFillFromDep(origin, here, dest)) {
    trailLatLngs = mfcGeodesic(origin, here, 16);
  }
  if (here && trailLatLngs.length) {
    const last = trailLatLngs[trailLatLngs.length - 1];
    if (last[0] !== here[0] || last[1] !== here[1]) trailLatLngs.push(here);
  }
  if (trailLatLngs.length > 1) {
    trailLatLngs.forEach((pt) => bounds.push(pt));
    if (layers.trail) {
      layers.trail.setLatLngs(trailLatLngs);
      layers.trail.setStyle({ color: ink, weight: 2 });
    } else {
      layers.trail = L.polyline(trailLatLngs, { color: ink, weight: 2 }).addTo(map);
    }
  } else if (layers.trail) {
    map.removeLayer(layers.trail);
    layers.trail = null;
  }

  if (here) {
    bounds.push(here);
    if (layers.plane) {
      layers.plane.setLatLng(here);
      layers.plane.setIcon(mfcPlaneIcon(L, data.heading));
    } else {
      layers.plane = L.marker(here, { icon: mfcPlaneIcon(L, data.heading) }).addTo(map);
    }
  } else if (layers.plane) {
    map.removeLayer(layers.plane);
    layers.plane = null;
  }

  host._mfcLayers = layers;
  const camera = [];
  if (origin) camera.push(origin);
  if (dest) camera.push(dest);
  if (here) camera.push(here);
  if (routeChanged && camera.length) {
    map.fitBounds(camera, { padding: [18, 18], maxZoom: 10 });
  } else if (routeChanged && !camera.length) {
    map.setView([47.4, 19.2], 5);
  }
}

function mfcMountMap(host, mapData, weatherPrefs, dark) {
  if (!host) return;
  mfcInjectLeafletCss(host.getRootNode());
  const data = mapData || {};
  const wx = weatherPrefs || mfcWeatherPrefs({});
  host._mfcPendingData = data;
  host._mfcPendingDark = Boolean(dark);
  if (host._mfcMap && window.L) {
    mfcEnsureBaseTiles(window.L, host._mfcMap, host, dark);
    mfcSyncMapLayers(window.L, host._mfcMap, host, data, dark);
    return;
  }
  if (host._mfcPending) return;
  host._mfcPending = true;
  mfcLoadLeaflet().then((L) => {
    host._mfcPending = false;
    if (!host.isConnected) return;
    const latest = host._mfcPendingData || data;
    const latestDark = host._mfcPendingDark;
    if (host._mfcMap) {
      mfcEnsureBaseTiles(L, host._mfcMap, host, latestDark);
      mfcSyncMapLayers(L, host._mfcMap, host, latest, latestDark);
      return;
    }
    const map = L.map(host, { zoomControl: false, attributionControl: false });
    host._mfcMap = map;
    mfcEnsureBaseTiles(L, map, host, latestDark);
    host._mfcLayers = {};
    host._mfcRouteKey = "";
    mfcSyncMapLayers(L, map, host, latest, latestDark);
    mfcAttachWeather(map, host, wx);
    setTimeout(() => {
      if (!host._mfcMap) return;
      host._mfcMap.invalidateSize();
      host._mfcRouteKey = "";
      mfcSyncMapLayers(L, host._mfcMap, host, host._mfcPendingData || latest, host._mfcPendingDark);
    }, 80);
  }).catch(() => {
    host._mfcPending = false;
    if (!host._mfcMap) host.innerHTML = `<p class="mfc-muted" style="padding:12px">Map unavailable</p>`;
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
    times: extra?.times,
  };
}

function mfcAttachWeather(map, host, prefs) {
  if (host._mfcWxStop) return;
  const wrap = document.createElement("div");
  wrap.className = "mfc-wx";
  wrap.innerHTML = `
    <button type="button" data-k="thunderstorms" class="${prefs.thunderstorms ? "on" : ""}" title="Storms">S</button>
    <button type="button" data-k="precipitation" class="${prefs.precipitation ? "on" : ""}" title="Rain">R</button>
    <button type="button" data-k="winds" class="${prefs.winds ? "on" : ""}" title="Wind">W</button>
  `;
  host.appendChild(wrap);
  const state = { ...prefs };
  let radar = null;
  let stormLayer = null;
  let windLayer = null;
  let socket = null;

  const ensurePane = (name, z) => {
    if (!map.getPane(name)) {
      const pane = map.createPane(name);
      pane.style.zIndex = String(z);
      pane.style.pointerEvents = "none";
    }
  };

  const stopRadar = () => {
    if (radar) { map.removeLayer(radar); radar = null; }
  };
  const stopStorms = () => {
    if (socket) { try { socket.close(); } catch (_e) { /* ignore */ } socket = null; }
    if (stormLayer) { map.removeLayer(stormLayer); stormLayer = null; }
  };
  const stopWind = () => {
    if (windLayer) { map.removeLayer(windLayer); windLayer = null; }
  };

  const startRadar = async () => {
    stopRadar();
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const payload = await res.json();
      const frames = payload.radar?.past || [];
      const latest = frames[frames.length - 1];
      if (!payload.host || !latest?.path) return;
      const hostUrl = String(payload.host).replace(/\/$/, "");
      ensurePane("weatherRasterPane", 350);
      radar = window.L.tileLayer(`${hostUrl}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`, {
        pane: "weatherRasterPane",
        opacity: 0.72,
        tileSize: 256,
        maxNativeZoom: 7,
        maxZoom: 18,
      }).addTo(map);
    } catch (_e) { /* ignore */ }
  };

  const startStorms = () => {
    stopStorms();
    ensurePane("weatherVectorPane", 550);
    stormLayer = window.L.layerGroup().addTo(map);
    try {
      socket = new WebSocket("wss://ws1.blitzortung.org/");
      socket.onopen = () => { try { socket.send('{"a":111}'); } catch (_e) { /* ignore */ } };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data);
          const row = Array.isArray(parsed) ? parsed[0] : parsed;
          const lat = Number(row?.lat);
          const lon = Number(row?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !stormLayer) return;
          window.L.circleMarker([lat, lon], {
            pane: "weatherVectorPane",
            radius: 3,
            color: "#f59e0b",
            fillColor: "#fde047",
            fillOpacity: 0.8,
            weight: 1,
            interactive: false,
          }).addTo(stormLayer);
        } catch (_e) { /* ignore */ }
      };
    } catch (_e) { /* ignore */ }
  };

  const startWind = async () => {
    stopWind();
    const b = map.getBounds();
    const lats = [];
    const lons = [];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        lats.push((b.getSouth() + ((i + 0.5) / 4) * (b.getNorth() - b.getSouth())).toFixed(3));
        lons.push((b.getWest() + ((j + 0.5) / 5) * (b.getEast() - b.getWest())).toFixed(3));
      }
    }
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&current=wind_speed_250hPa,wind_direction_250hPa&wind_speed_unit=kn&forecast_days=1`;
      const res = await fetch(url);
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : [payload];
      windLayer = window.L.layerGroup().addTo(map);
      rows.forEach((station) => {
        const lat = Number(station.latitude);
        const lon = Number(station.longitude);
        const from = Number(station.current?.wind_direction_250hPa);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(from)) return;
        const to = (from + 180) % 360;
        window.L.marker([lat, lon], {
          icon: window.L.divIcon({
            className: "mfc-wind",
            html: `<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:12px solid #334155;transform:rotate(${to}deg)"></div>`,
            iconSize: [8, 12],
          }),
          interactive: false,
        }).addTo(windLayer);
      });
    } catch (_e) { /* ignore */ }
  };

  const apply = () => {
    if (state.precipitation) void startRadar(); else stopRadar();
    if (state.thunderstorms) startStorms(); else stopStorms();
    if (state.winds) void startWind(); else stopWind();
  };

  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = btn.getAttribute("data-k");
      state[key] = !state[key];
      btn.classList.toggle("on", state[key]);
      mfcSaveWeather(state);
      apply();
    });
  });
  apply();
  host._mfcWxStop = () => {
    stopRadar();
    stopStorms();
    stopWind();
    wrap.remove();
    host._mfcWxStop = null;
  };
}

class MyFlightBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  static getStubConfig() {
    return { theme: "brand" };
  }

  static getConfigElement() {
    return document.createElement("myflight-card-editor");
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid config");
    this._config = { theme: "brand", ...config };
    this._hassKey = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const snap = this._snapshot();
    const key = [
      snap.entity,
      snap.state?.last_updated || "",
      JSON.stringify(this._config),
      mfcIsDark(hass) ? "d" : "l",
    ].join("|");
    if (key === this._hassKey) return;
    this._hassKey = key;
    this._render();
  }

  disconnectedCallback() {
    if (this._etaTimer) {
      clearInterval(this._etaTimer);
      this._etaTimer = null;
    }
    mfcTeardownMap(this.shadowRoot?.querySelector(".mfc-map"));
    this._hassKey = "";
  }

  getCardSize() {
    return 3;
  }

  _entity() {
    return mfcResolveEntity(this._hass, this._config.entity);
  }

  _snapshot() {
    const entity = this._entity();
    const state = this._hass?.states?.[entity];
    const attrs = state?.attributes || {};
    return { entity, state, attrs, ok: Boolean(state) && mfcIsSnapshot(attrs) };
  }

  _renderMissing() {
    this._renderShell("myFlight", `<p class="mfc-empty">No status data. Edit this card and pick the myFlight Status sensor.</p>`);
  }

  _renderShell(title, body, { map = null, subtitle = "", status = "", icon = false, headerExtra = "", compact = false } = {}) {
    const dark = mfcIsDark(this._hass);
    const root = this.shadowRoot;
    const css = mfcStyles(dark, this._config.theme);
    let wrap = root.querySelector(".mfc");
    if (!wrap) {
      root.innerHTML = `
        <style></style>
        <ha-card>
          <div class="mfc">
            <div class="mfc-h">
              <div class="mfc-h-main">
                <h2 class="mfc-title"></h2>
                <div class="mfc-status" hidden></div>
                <div class="mfc-sub" hidden></div>
              </div>
              <div class="mfc-h-extra"></div>
            </div>
            <div class="mfc-body"></div>
            <div class="mfc-map" hidden></div>
          </div>
        </ha-card>
      `;
      wrap = root.querySelector(".mfc");
    }
    wrap.classList.toggle("compact", Boolean(compact));
    const style = root.querySelector("style");
    if (style && style.textContent !== css) style.textContent = css;
    wrap.querySelector(".mfc-title").innerHTML = `${icon ? mfcIconPlane("currentColor") : ""}${mfcEsc(title)}`;
    const sub = wrap.querySelector(".mfc-sub");
    if (subtitle) {
      sub.hidden = false;
      sub.textContent = subtitle;
    } else {
      sub.hidden = true;
      sub.textContent = "";
    }
    const st = wrap.querySelector(".mfc-status");
    const statusText = mfcStatusLabel(status);
    if (statusText) {
      st.hidden = false;
      st.textContent = statusText;
      st.className = `mfc-status ${mfcStatusClass(status)}`;
    } else {
      st.hidden = true;
      st.textContent = "";
      st.className = "mfc-status";
    }
    wrap.querySelector(".mfc-h-extra").innerHTML = headerExtra || "";
    wrap.querySelector(".mfc-body").innerHTML = body;
    const mapEl = wrap.querySelector(".mfc-map");
    if (map) {
      const wasHidden = mapEl.hidden;
      mapEl.hidden = false;
      mfcMountMap(mapEl, map, mfcWeatherPrefs(this._config), dark);
      if (wasHidden && mapEl._mfcMap) {
        setTimeout(() => mapEl._mfcMap.invalidateSize(), 50);
      }
    } else {
      mapEl.hidden = true;
      mfcTeardownMap(mapEl);
    }
    this._syncEtaTick();
  }

  _rosterDetails() {
    return this._config.details === true;
  }

  _rosterCompact() {
    return this._config.compact === true;
  }

  _syncEtaTick() {
    const el = this.shadowRoot?.querySelector(".mfc-eta");
    if (!el) {
      if (this._etaTimer) {
        clearInterval(this._etaTimer);
        this._etaTimer = null;
      }
      return;
    }
    if (this._etaTimer) return;
    this._etaTimer = setInterval(() => {
      const node = this.shadowRoot?.querySelector(".mfc-eta");
      if (!node) return;
      const minsRaw = node.getAttribute("data-mins");
      node.textContent = mfcEtaLeft({
        eta_at: node.getAttribute("data-eta-at") || undefined,
        eta_in_minutes: minsRaw === "" || minsRaw == null ? null : Number(minsRaw),
        arr_label: node.getAttribute("data-arr-label") || "ETA",
      });
    }, 15000);
  }
}

class MyFlightNextDutyCard extends MyFlightBaseCard {
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
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
      ? `<p class="mfc-change-alert">${changes.length} eCREW update${changes.length === 1 ? "" : "s"}</p>`
      : "";
    this._renderShell(duty.label || "Next duty", `
      <div class="mfc-sub">${mfcEsc(mfcDateLabel(duty.date))}</div>
      <p class="mfc-stat"><strong>${mfcEsc(duty.duty_text || duty.duty_roster_code || "Duty")}</strong></p>
      <p class="mfc-muted">Report ${mfcEsc(mfcClock(duty.report_time || duty.check_in))} · Debrief ${mfcEsc(mfcClock(duty.debrief_time || duty.check_out))}</p>
      ${legs ? `<ul class="mfc-list">${legs}</ul>` : ""}
      ${pending}
    `, { subtitle: mfcWho(a), icon: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightMissionCard extends MyFlightBaseCard {
  getCardSize() {
    const a = this._snapshot().attrs || {};
    const duty = a.mission?.duty || a.next_duty;
    return (mfcIsFlightDuty(duty) || a.mission?.leg)
      ? 3 + Math.min(4, (a.mission?.sectors || []).length || 1)
      : 2;
  }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const mission = a.mission;
    const duty = mission?.duty || a.next_duty;
    if (!mission && !duty) {
      this._renderShell("Your mission", `<p class="mfc-empty">No flight duty loaded.</p>`, { compact: true });
      return;
    }
    const flightDuty = mfcIsFlightDuty(duty) || Boolean(mission?.leg);
    const checkIn = duty?.check_in || duty?.report_time;
    const crewList = duty?.crew || [];
    const crew = mfcCrewLine(crewList);
    const meta = [mfcDateLabel(duty?.date), checkIn ? `Check-in ${mfcClock(checkIn)}` : ""]
      .filter(Boolean)
      .join(" · ");
    const sectors = mission?.sectors || [];
    this._renderShell(mfcTitled("Your mission", a), `
      <p class="mfc-stat"><strong>${mfcEsc(mission?.registration || duty?.duty_text || "Duty")}</strong>
        ${meta ? `<span class="mfc-muted">${mfcEsc(meta)}</span>` : ""}</p>
      ${flightDuty ? mfcNeighbor("Coming from", mission?.previous, "arr", { variant: "inbound", turnaround: mission?.turnaround_before }) : ""}
      ${flightDuty ? mfcDutySectors(sectors, mission) : ""}
      ${flightDuty ? mfcNeighbor("Then", mission?.next, "dep", { variant: "outbound", turnaround: mission?.turnaround_after }) : ""}
      ${crew}
    `, { map: flightDuty ? mission?.map : null, subtitle: duty?.duty_text || "", icon: true, compact: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightFlightTrackCard extends MyFlightBaseCard {
  getCardSize() { return 4; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const track = a.flight_track;
    const wanted = (this._config.registration || "").trim().toUpperCase();
    const current = (track?.registration || "").toUpperCase();
    if (wanted && this._hass?.callService && wanted !== current && this._pushedTrack !== wanted) {
      this._pushedTrack = wanted;
      this._hass.callService("myflight", "set_track", {
        entity_id: snap.entity,
        registration: wanted,
      });
    }
    if (!track?.registration) {
      this._renderShell(mfcTitled("Live flight track", a), `<p class="mfc-empty">Enter a tail in the card editor (or integration options).</p>`, { icon: true });
      return;
    }
    const pos = track.tracking?.position;
    const route = {
      departure: track.tracking?.route_departure,
      arrival: track.tracking?.route_arrival,
      progress: track.progress,
      times: track.times,
      depDelayText: track.network?.departure_delay_text,
      depDelayTone: track.network?.departure_delay_tone,
      arrDelayText: track.network?.arrival_delay_text,
      arrDelayTone: track.network?.arrival_delay_tone,
    };
    const alt = pos?.altitude_ft != null ? `${pos.altitude_ft} ft` : "";
    const gs = pos?.ground_speed_kt != null ? `${Math.round(pos.ground_speed_kt)} kt` : "";
    this._renderShell(mfcTitled("Live flight track", a), `
      <p class="mfc-stat"><strong>${mfcEsc(track.registration)}</strong>
        <span class="mfc-muted">${mfcEsc([alt, gs].filter(Boolean).join(" · "))}</span></p>
      ${mfcProgress(route.departure ? route : null)}
      ${track.tracking?.found ? "" : `<p class="mfc-muted">${mfcEsc(track.tracking?.message || "No live position")}</p>`}
    `, { map: track.map, status: pos?.on_ground ? "on ground" : "en route", icon: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightAirportStatsCard extends MyFlightBaseCard {
  getCardSize() { return 2; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const stats = a.airport_stats;
    if (!stats?.airport) {
      this._renderShell("Airport departures", `<p class="mfc-empty">No airport in this snapshot yet.</p>`);
      return;
    }
    if (stats.error) {
      this._renderShell("Airport departures", `<p class="mfc-error">${mfcEsc(stats.error)}</p>`, { subtitle: stats.airport });
      return;
    }
    const cells = [
      ["Delayed", stats.delayed, "late"],
      ["Cancelled", stats.cancelled, stats.cancelled > 0 ? "cancel" : ""],
      ["On time", stats.on_time, "ok"],
      ["Early", stats.early, "early"],
      ["Avg delay", stats.average_delay_text || "—", stats.average_delay_minutes != null ? "late" : ""],
      ["Max delay", stats.max_delay_text || "—", ""],
    ];
    const heading = `${stats.total ?? 0} flight${stats.total === 1 ? "" : "s"}${
      stats.punctuality_percent != null ? ` · ${stats.punctuality_percent}% punctual` : ""
    }`;
    this._renderShell("Airport departures", `
      <div class="mfc-grid">${cells.map(([l, v, tone]) => `<div class="mfc-cell ${tone}"><strong>${mfcEsc(v ?? "—")}</strong><span>${mfcEsc(l)}</span></div>`).join("")}</div>
    `, { subtitle: `${stats.airport} · ${stats.date || ""} · ${heading}`, icon: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightLiveFleetCard extends MyFlightBaseCard {
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
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
  getCardSize() { return 4; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const live = a.partner_flight;
    if (!live || live.configured === false) {
      this._renderShell("Partner live", `<p class="mfc-empty">Partner account is not connected.</p>`, { compact: true, icon: true });
      return;
    }
    if (!live.status) {
      this._renderShell(`${live.partner_label || "Partner"} · Live`, `<p class="mfc-empty">No live sector right now.</p>`, { compact: true, icon: true });
      return;
    }
    const net = live.network || {};
    const progress = mfcProgressFromLeg(live.leg, { ...net, progress: live.progress, times: live.times });
    this._renderShell(`${live.partner_label || "Partner"} · Live`, `
      ${mfcProgress(progress)}
    `, { map: live.map, status: live.status, icon: true, compact: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightPartnerAccountsCard extends MyFlightBaseCard {
  getCardSize() { return 2; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const accounts = a.partner_accounts || [];
    if (!accounts.length) {
      this._renderShell("Partner accounts", `<p class="mfc-empty">No partner accounts configured.</p>`);
      return;
    }
    const configured = accounts.filter((x) => x.configured).length;
    const rows = accounts.map((acc) => `<li><strong>${mfcEsc(acc.label)}</strong> <span class="mfc-muted">${acc.configured ? "connected" : "not configured"}${acc.last_error ? " · sync error" : ""}</span></li>`).join("");
    this._renderShell(mfcTitled("Partner accounts", a), `
      <p class="mfc-muted">${configured} of ${accounts.length} connected</p>
      <ul class="mfc-list">${rows}</ul>
    `);
  }
}

class MyFlightPartnerBadgeCard extends MyFlightBaseCard {
  getCardSize() { return 1; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const live = a.partner_flight;
    const title = `${live?.partner_label || "Partner"} · Live`;
    if (!live || live.configured === false || !live.status) {
      this._renderShell(title, `<p class="mfc-empty">No live sector.</p>`, { icon: true, compact: true });
      return;
    }
    const net = live.network || {};
    const progress = mfcProgressFromLeg(live.leg, { ...net, progress: live.progress, times: live.times });
    this._renderShell(title, mfcProgress(progress), { status: live.status, icon: true, compact: true, headerExtra: mfcTimesLegend(a) });
  }
}

class MyFlightRosterCard extends MyFlightBaseCard {
  getCardSize() { return this._rosterCompact() ? 4 : 6; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const month = a.roster_month;
    if (!month?.year) {
      this._renderShell(mfcTitled("Roster", a), `<p class="mfc-empty">No roster loaded.</p>`);
      return;
    }
    const weekStart = this._config.week_start === "sunday" ? "sunday" : "monday";
    const details = this._rosterDetails();
    const compact = this._rosterCompact();
    const labels = weekStart === "monday"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const first = new Date(month.year, month.month - 1, 1);
    const pad = weekStart === "monday" ? (first.getDay() + 6) % 7 : first.getDay();
    const last = new Date(month.year, month.month, 0).getDate();
    const byDate = {};
    (month.days || []).forEach((d) => { byDate[d.date] = d; });
    const weekend = weekStart === "monday" ? [5, 6] : [0, 6];
    const todayIso = mfcLocalIsoDate();
    const cells = [];
    for (let i = 0; i < pad; i += 1) cells.push(`<div class="mfc-cal-d empty"></div>`);
    for (let day = 1; day <= last; day += 1) {
      const iso = `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const row = byDate[iso];
      const col = (pad + day - 1) % 7;
      const cat = row?.category || "unknown";
      const color = MFC_CAT_COLOR[cat] || MFC_CAT_COLOR.unknown;
      const bg = row ? (MFC_CAT_BG[cat] || MFC_CAT_BG.unknown) : "";
      const style = row ? `style="background:${bg};border-color:${color};color:${color}"` : "";
      const full = row ? (row.text || row.code || "") : "";
      const label = !row ? "" : (details ? full : mfcShortDutyLabel(row, compact));
      const today = iso === todayIso ? " today" : "";
      const weekendCls = weekend.includes(col) ? " weekend" : "";
      cells.push(`<div class="mfc-cal-d${weekendCls}${today}" ${style}><span class="num">${day}</span>${label ? `<span class="lbl" title="${mfcEsc(full)}">${mfcCalLabelHtml(label)}</span>` : ""}</div>`);
    }
    const titleDate = new Date(month.year, month.month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    this._renderShell(mfcTitled("Roster", a), `
      <div class="mfc-cal ${details ? "mfc-cal--details" : "mfc-cal--codes"}">${labels.map((l) => `<div class="mfc-cal-h">${l}</div>`).join("")}${cells.join("")}</div>
    `, { subtitle: titleDate, icon: true, compact });
  }
}

class MyFlightAirportBoardCard extends MyFlightBaseCard {
  getCardSize() { return 6; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const stats = a.airport_stats;
    const wanted = (this._config.airport || "").trim().toUpperCase();
    if (wanted && this._hass?.callService && wanted !== (stats?.airport || "") && this._pushedAirport !== wanted) {
      this._pushedAirport = wanted;
      this._hass.callService("myflight", "set_airport", {
        entity_id: snap.entity,
        airport: wanted,
      });
    }
    if (!stats?.airport) {
      this._renderShell("Airport board", `<p class="mfc-empty">No airport yet. Default is your base.</p>`, { icon: true });
      return;
    }
    this._renderShell(`${stats.airport} departures`, mfcFidsBoard(stats), { icon: true });
    const snapKey = `${stats.airport}|${stats.date}`;
    if (this._fidsSnapKey === snapKey) return;
    this._fidsSnapKey = snapKey;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = this.shadowRoot?.querySelector(".mfc-fids-scroll");
        const mark = scroller?.querySelector(".mfc-fids-now-mark");
        if (!scroller || !mark) return;
        const top = mark.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3);
      });
    });
  }
}

class MyFlightRosterChangesCard extends MyFlightBaseCard {
  getCardSize() { return 2; }
  _render() {
    const snap = this._snapshot();
    if (!snap.ok) { this._renderMissing(); return; }
    const a = snap.attrs;
    const changes = a.roster_changes || [];
    if (!changes.length) {
      this._renderShell(mfcTitled("eCREW changes", a), `<p class="mfc-empty">No roster updates.</p>`, {
        icon: true,
        compact: true,
      });
      return;
    }
    const rows = changes.map((change) => `
      <li class="mfc-change">
        <div class="mfc-change-date">${mfcEsc(mfcDateLabel(change.date))}</div>
        <div class="mfc-change-pair">
          <span class="mfc-change-old">${mfcEsc(change.old_summary || "—")}</span>
          <span class="mfc-change-arrow" aria-hidden="true">→</span>
          <span class="mfc-change-new">${mfcEsc(change.new_summary || "—")}</span>
        </div>
      </li>`).join("");
    this._renderShell(mfcTitled("eCREW changes", a), `
      <p class="mfc-change-alert">${changes.length} update${changes.length === 1 ? "" : "s"}</p>
      <ul class="mfc-change-list">${rows}</ul>
    `, { icon: true, compact: true });
  }
}

const MFC_CARD_TYPES = [
  ["myflight-next-duty-card", MyFlightNextDutyCard, "myFlight Next", "Next scheduled item"],
  ["myflight-mission-card", MyFlightMissionCard, "myFlight Current", "Current assignment with map"],
  ["myflight-flight-track-card", MyFlightFlightTrackCard, "myFlight Track", "Tracked item with map"],
  ["myflight-airport-stats-card", MyFlightAirportStatsCard, "myFlight Location", "Pinned location day stats"],
  ["myflight-airport-board-card", MyFlightAirportBoardCard, "myFlight Board", "Day list for a location"],
  ["myflight-roster-changes-card", MyFlightRosterChangesCard, "myFlight eCREW changes", "Read-only roster updates"],
  ["myflight-roster-card", MyFlightRosterCard, "myFlight Calendar", "Month calendar"],
  ["myflight-live-fleet-card", MyFlightLiveFleetCard, "myFlight Count", "Active count"],
  ["myflight-partner-flight-card", MyFlightPartnerFlightCard, "myFlight Partner live", "Partner live with map"],
  ["myflight-partner-badge-card", MyFlightPartnerBadgeCard, "myFlight Partner badge", "Partner progress, no map"],
  ["myflight-partner-accounts-card", MyFlightPartnerAccountsCard, "myFlight Partner accounts", "Partner connection status"],
];

class MyFlightCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { theme: "brand", ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    const key = mfcSnapshotIds(hass).join("|");
    if (!this._rendered || key !== this._snapshotKey) {
      this._snapshotKey = key;
      this._render();
    }
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
    const type = String(this._config.type || "");
    const snapshots = mfcSnapshotIds(this._hass);
    const options = snapshots.length
      ? snapshots.map((id) => {
        const who = mfcWho(this._hass?.states?.[id]?.attributes);
        const label = who ? `${id} · ${who}` : id;
        return `<option value="${mfcEsc(id)}" ${id === entity ? "selected" : ""}>${mfcEsc(label)}</option>`;
      }).join("")
      : `<option value="${mfcEsc(entity)}" selected>${mfcEsc(entity || "sensor.myflight_status")}</option>`;
    const extra = [];
    if (type.includes("flight-track")) {
      extra.push(`<label>Tail to follow
        <input class="reg" type="text" value="${mfcEsc(this._config.registration || "")}" placeholder="HA-LZT" style="width:100%">
      </label>`);
    }
    if (type.includes("airport-board") || type.includes("airport-stats")) {
      extra.push(`<label>Airport (blank = base)
        <input class="apt" type="text" maxlength="3" value="${mfcEsc(this._config.airport || "")}" placeholder="BUD" style="width:100%">
      </label>`);
    }
    if (type.includes("roster")) {
      const week = this._config.week_start === "sunday" ? "sunday" : "monday";
      const details = this._config.details === true;
      const compact = this._config.compact === true;
      extra.push(`<label>Week starts
        <select class="wk" style="width:100%">
          <option value="monday" ${week === "monday" ? "selected" : ""}>Monday</option>
          <option value="sunday" ${week === "sunday" ? "selected" : ""}>Sunday</option>
        </select>
      </label>`);
      extra.push(`<label>Duty labels
        <select class="det" style="width:100%">
          <option value="codes" ${details ? "" : "selected"}>Codes</option>
          <option value="details" ${details ? "selected" : ""}>Details</option>
        </select>
      </label>`);
      extra.push(`<label>Density
        <select class="cmp" style="width:100%">
          <option value="comfortable" ${compact ? "" : "selected"}>Comfortable</option>
          <option value="compact" ${compact ? "selected" : ""}>Compact</option>
        </select>
      </label>`);
    }
    this.innerHTML = `
      <div style="display:grid;gap:10px;padding:4px 0">
        <label>Account (Status sensor)
          <select class="ent" style="width:100%">
            ${entity && !snapshots.includes(entity) ? `<option value="${mfcEsc(entity)}" selected>${mfcEsc(entity)}</option>` : ""}
            ${options}
          </select>
        </label>
        ${extra.join("")}
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
    const reg = this.querySelector(".reg");
    if (reg) reg.onchange = (e) => this._set("registration", e.target.value.trim().toUpperCase());
    const apt = this.querySelector(".apt");
    if (apt) apt.onchange = (e) => this._set("airport", e.target.value.trim().toUpperCase());
    const wk = this.querySelector(".wk");
    if (wk) wk.onchange = (e) => this._set("week_start", e.target.value);
    const det = this.querySelector(".det");
    if (det) det.onchange = (e) => this._set("details", e.target.value === "details");
    const cmp = this.querySelector(".cmp");
    if (cmp) cmp.onchange = (e) => this._set("compact", e.target.value === "compact");
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
