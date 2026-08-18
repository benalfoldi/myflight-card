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

`theme`: `brand` (default) or `ha`. Calendar cards can switch between short codes and full labels, and Compact density.
