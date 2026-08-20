# myFlight Card

Lovelace cards for the [myFlight Home Assistant integration](https://github.com/benalfoldi/myflight-home-assistant).

## Install

1. HACS → Frontend → **Custom repositories**
2. URL: `https://github.com/benalfoldi/myflight-card`
3. Category: **Lovelace** → install **myFlight Card** → hard-refresh the dashboard (Ctrl+F5)

Add a myFlight card from the Lovelace card picker, or:

```yaml
type: custom:myflight-next-duty-card
entity: sensor.myflight_status
theme: brand
```

Other types: `myflight-mission-card`, `myflight-live-badge-card`, `myflight-live-flight-card`, `myflight-airport-board-card`, `myflight-roster-changes-card`, `myflight-roster-card`, `myflight-partner-flight-card`, `myflight-partner-badge-card`.

`theme`: `brand` (default) or `ha`. Calendar cards: Codes (default) or Details, and Compact density, in the card editor. Departure board: Height Full page (default) or Card.
