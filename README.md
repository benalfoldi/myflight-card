# myFlight Card

Lovelace cards for the [myFlight Home Assistant integration](https://github.com/benalfoldi/myflight-home-assistant). Same tiles as the myFlight home page: next duty, your mission, live flight track, airport departures, live fleet, partner live flight, and partner accounts.

Requires the integration to be installed and configured with *your* myFlight server URL, API key, and username.

## Install via HACS

1. **HACS → Frontend → ⋮ → Custom repositories**
2. URL: `https://github.com/benalfoldi/myflight-card` — category **Lovelace**
3. Install **myFlight Card** → hard-refresh the dashboard (Ctrl+F5)

## Cards

```yaml
type: custom:myflight-next-duty-card
entity: sensor.myflight_status
theme: brand
```

| Type | Home card |
|------|-----------|
| `custom:myflight-next-duty-card` | Next duty |
| `custom:myflight-mission-card` | Your mission (map) |
| `custom:myflight-flight-track-card` | Live flight track (map) |
| `custom:myflight-airport-stats-card` | Airport departures |
| `custom:myflight-live-fleet-card` | Live fleet |
| `custom:myflight-partner-flight-card` | Partner live flight (map) |
| `custom:myflight-partner-accounts-card` | Partner accounts |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `entity` | `sensor.myflight_status` | Status sensor from the integration |
| `theme` | `brand` | `brand` = myFlight navy/magenta; `ha` = native HA colors |

Mission, flight-track, and partner-flight cards embed a Leaflet map (OSM tiles). Airport and track tail come from the integration config when the browser-pinned home values are not available.
