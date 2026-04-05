# Hass Weather Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Current version](https://img.shields.io/github/v/release/amirandap/clock-weather-card)](https://github.com/amirandap/clock-weather-card/releases/latest)
[![Total downloads](https://img.shields.io/github/downloads/amirandap/clock-weather-card/total)](https://github.com/amirandap/clock-weather-card/releases)

A [Home Assistant Dashboard Card](https://www.home-assistant.io/dashboards/) featuring a **dynamic animated coastal weather scene** with:

- **SVG sky** that transitions progressively based on real sun elevation (no hard-coded time slots)
- **Lottie overlays** for clouds, rain, and wind — speed driven by actual `wind_speed` data
- **Cloud coverage integration** — cloud opacity and sky desaturation react to `cloud_coverage`
- **Visibility-based fog** — low visibility adds a semi-transparent haze overlay
- **15 HA weather conditions** mapped to unique visual scenes (sunny, cloudy, rainy, stormy, snowy, foggy, windy, etc.)
- **Moon with glow halo** for night scenes, properly visible city/ocean landscape at night
- **Hourly + daily forecasts** with animated weather icons

Works with **any** HA weather integration (Tomorrow.io, Open-Meteo, Met.no, OpenWeatherMap, AccuWeather, etc.).

Credits to [basmilius](https://github.com/basmilius) for the [weather icons](https://github.com/basmilius/weather-icons).

---

## Installation

### Via HACS (recommended)

1. Open HACS in Home Assistant.
2. Click the three-dot menu (⋮) → **Custom repositories**.
3. Add `https://github.com/amirandap/clock-weather-card` with category **Frontend**.
4. Click **Install** on **Hass Weather Card**.
5. Add to your dashboard:
   ```yaml
   type: custom:hass-weather-card
   entity: weather.home
   ```

### Manual Installation

1. Download [`hass-weather-card.js`](https://github.com/amirandap/clock-weather-card/releases/latest/download/hass-weather-card.js).
2. Place it in your Home Assistant `config/www` folder.
3. Add the resource:
   ```yaml
   resources:
     - url: /local/hass-weather-card.js
       type: module
   ```
4. Add the card configuration to your dashboard.

---

## Configuration

### Minimal

```yaml
type: custom:hass-weather-card
entity: weather.home
```

### Full example

```yaml
type: custom:hass-weather-card
entity: weather.home
title: Home
sun_entity: sun.sun
climate_entity: climate.living_room
temperature_sensor: sensor.outdoor_temp
humidity_sensor: sensor.outdoor_humidity
apparent_sensor: sensor.real_feel_temperature
aqi_sensor: sensor.air_quality_index
weather_icon_type: line
animated_icon: true
forecast_rows: 5
hourly_forecast: true
hero_display: temperature
sub_font_size: 1.7
locale: en-GB
time_format: 24
time_pattern: HH:mm
date_pattern: ccc, d.MM.yy
hide_today_section: false
hide_forecast_section: false
hide_clock: false
hide_date: false
show_humidity: false
show_decimal: false
use_browser_time: false
time_zone: null
```

### Options

| Name                  | Type                         | Required     | Description                                                                                                                                 | Default         |
|-----------------------|------------------------------|--------------|---------------------------------------------------------------------------------------------------------------------------------------------|-----------------|
| `type`                | string                       | **Required** | `custom:hass-weather-card`                                                                                                                  |                 |
| `entity`              | string                       | **Required** | Weather entity ID (e.g. `weather.home`)                                                                                                     |                 |
| `title`               | string                       | Optional     | Card title                                                                                                                                  | `''`            |
| `sun_entity`          | string                       | Optional     | Sun entity for elevation/azimuth-based sky rendering and day/night icon selection                                                            | `sun.sun`       |
| `climate_entity`      | string                       | Optional     | Climate/thermostat entity ID for future HVAC integration                                                                                    | `''`            |
| `temperature_sensor`  | string                       | Optional     | Override current temperature from a sensor entity                                                                                           | `''`            |
| `humidity_sensor`     | string                       | Optional     | Override humidity from a sensor entity (used when `show_humidity` is `true`)                                                                | `''`            |
| `apparent_sensor`     | string                       | Optional     | Apparent (feels-like) temperature sensor entity                                                                                             | `''`            |
| `aqi_sensor`          | string                       | Optional     | Air Quality Index sensor entity                                                                                                             | `''`            |
| `hero_display`        | `temperature` \| `time`      | Optional     | What the large hero text displays — the current temperature or the clock time                                                                | `temperature`   |
| `sub_font_size`       | number                       | Optional     | Font size in `rem` for the condition + sub-text row below the hero                                                                          | `1.7`           |
| `weather_icon_type`   | `line` \| `fill`             | Optional     | Style of the large weather icon                                                                                                             | `line`          |
| `animated_icon`       | boolean                      | Optional     | Whether the large weather icon is animated (Lottie)                                                                                         | `true`          |
| `forecast_rows`       | number                       | Optional     | Number of forecast rows to display                                                                                                          | `5`             |
| `hourly_forecast`     | boolean                      | Optional     | Show hourly forecast strip above daily forecast                                                                                             | `false`         |
| `locale`              | string[^1]                   | Optional     | Language for text and date/time. Falls back to HA locale or `en-GB`                                                                         | `en-GB`         |
| `time_format`         | `24` \| `12`                 | Optional     | Time display format. Ignored if `time_pattern` is set                                                                                       | `24`            |
| `time_pattern`        | string                       | Optional     | Custom [luxon](https://moment.github.io/luxon/#/formatting?id=table-of-tokens) time pattern                                                | `null`          |
| `date_pattern`        | string                       | Optional     | Custom [luxon](https://moment.github.io/luxon/#/formatting?id=table-of-tokens) date pattern                                                | `D`             |
| `show_humidity`       | boolean                      | Optional     | Display humidity in the hero section                                                                                                        | `false`         |
| `show_decimal`        | boolean                      | Optional     | Display temperature with decimals (no rounding)                                                                                             | `false`         |
| `hide_today_section`  | boolean                      | Optional     | Hide the hero section (icon, temp, clock)                                                                                                   | `false`         |
| `hide_forecast_section` | boolean                    | Optional     | Hide the forecast section                                                                                                                   | `false`         |
| `hide_clock`          | boolean                      | Optional     | Hide the clock display                                                                                                                      | `false`         |
| `hide_date`           | boolean                      | Optional     | Hide the date display                                                                                                                       | `false`         |
| `use_browser_time`    | boolean                      | Optional     | Use browser timezone instead of HA timezone                                                                                                 | `false`         |
| `time_zone`           | string                       | Optional     | Override [timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)                                                           | `null`          |

---

## Features

### Data-Driven Sky Rendering

The card reads real-time data from your weather entity and `sun.sun` to render the scene:

| Data Point        | Visual Effect                                                    |
|-------------------|------------------------------------------------------------------|
| `sun.elevation`   | Continuous sky color interpolation + sun/moon Y position         |
| `sun.azimuth`     | Sun/moon X position (east→west arc)                              |
| `sun.rising`      | Disambiguates dawn vs dusk at the same elevation angle           |
| `cloud_coverage`  | Cloud opacity, sky desaturation, overcast threshold              |
| `visibility`      | Fog/haze overlay when < 8.5 km                                   |
| `wind_speed`      | Lottie cloud/wind animation speed (0.3×–2.5×)                   |

No hard-coded time thresholds — the sky transitions smoothly based on actual solar position.

### Weather Conditions

All 15 Home Assistant weather conditions are mapped to visual scenes:

| Condition          | Scene                            | Lottie Layers         |
|--------------------|----------------------------------|-----------------------|
| `sunny`            | Blue sky + sun                   | —                     |
| `clear-night`      | Star field + moon with glow      | —                     |
| `partlycloudy`     | Blue sky + scattered clouds      | Clouds                |
| `cloudy`           | Overcast (progressive by `cloud_coverage`) | Clouds      |
| `fog`              | Overcast + fog overlay           | Clouds                |
| `windy`            | Breezy sky                       | Clouds + Wind streaks |
| `windy-variant`    | Breezy sky                       | Clouds + Wind streaks |
| `rainy`            | Dark overcast                    | Rain                  |
| `lightning-rainy`  | Dark overcast                    | Rain                  |
| `hail`             | Dark overcast                    | Rain                  |
| `snowy-rainy`      | Dark overcast                    | Rain                  |
| `pouring`          | Very dark overcast               | Heavy rain            |
| `lightning`        | Storm sky + lightning bolts      | Rain                  |
| `snowy`            | Grey sky + snow particles        | Clouds                |
| `exceptional`      | Overcast fallback                | Clouds                |

### Integration Compatibility

The card works with **any** HA weather integration. Gracefully falls back to condition-based defaults when optional attributes are not provided.

| Integration     | `cloud_coverage` | `visibility` | `wind_gust` | `uv_index` | `dew_point` |
|-----------------|:-:|:-:|:-:|:-:|:-:|
| Tomorrow.io     | ✅ | ✅ | ✅ | ✅ | ✅ |
| Open-Meteo      | ✅ | ✅ | ✅ | ✅ | ✅ |
| Met.no          | ✅ | — | — | ✅ | — |
| OpenWeatherMap  | ✅ | ✅ | ✅ | ✅ | ✅ |
| AccuWeather     | ✅ | ✅ | ✅ | ✅ | ✅ |

For a comprehensive list of every data point the card can consume, see [DATA-POINTS.md](DATA-POINTS.md).

---

## FAQ

### Why don't I see the current day in my weather forecast?

Your weather provider may not include today's forecast. Try [Open-Meteo](https://www.home-assistant.io/integrations/open_meteo/) which provides today's weather by default.

### Can I show the clock as the hero instead of the temperature?

Yes — set `hero_display: time` in your card config. The temperature and condition will swap to the sub-text row.

### How do I make the sub-text larger or smaller?

Set `sub_font_size` to a value in `rem`. Default is `1.7`. For example, `sub_font_size: 2.0` for larger text.

---

## Footnotes

[^1]: Supported languages: `ar`, `bg`, `ca`, `cs`, `cy`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `he`, `hu`, `hr`, `id`, `is`, `it`, `ko`, `lb`, `lt`, `nb`, `nl`, `pl`, `pt`, `pt-BR`, `ro`, `ru`, `sk`, `sl`, `sr`, `sr-Latn`, `sv`, `th`, `tr`, `uk`, `ur`, `vi`, `zh-CN`, `zh-TW`
