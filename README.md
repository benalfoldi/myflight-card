# myFlight Card

Lovelace cards for the [myFlight Home Assistant integration](https://github.com/benalfoldi/myflight-home-assistant).

## Install

1. HACS → Frontend → **Custom repositories**
2. URL: `https://github.com/benalfoldi/myflight-card`
3. Category: **Lovelace** → install **myFlight Card** → hard-refresh the dashboard (Ctrl+F5)

```yaml
type: custom:myflight-next-duty-card
entity: sensor.myflight_status
theme: brand
```

Card types (all use `entity: sensor.myflight_status`):

- `custom:myflight-next-duty-card`
- `custom:myflight-mission-card`
- `custom:myflight-flight-track-card`
- `custom:myflight-airport-stats-card`
- `custom:myflight-live-fleet-card`
- `custom:myflight-partner-flight-card`
- `custom:myflight-partner-accounts-card`

`theme`: `brand` (default) or `ha`.
