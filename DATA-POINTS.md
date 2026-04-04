# Hass Weather Card — Data Points Reference

Complete reference of every Home Assistant data point the card can consume,
which ones are currently integrated, and how they affect the visual scene.

---

## 1. Weather Entity (`weather.*`)

The card's primary entity. Works with **any** HA weather integration
(Tomorrow.io, OpenMeteo, Met.no, OpenWeatherMap, etc.).

### 1.1 State (condition)

The `state` determines the overall SVG scene and Lottie overlays.

| HA Condition       | Visual Group    | SVG Scene         | Lottie Layers          | Status        |
|--------------------|-----------------|--------------------|-----------------------|---------------|
| `sunny`            | `sunny`         | Blue sky + sun     | —                     | ✅ Integrated |
| `clear-night`      | `sunny` (night) | Star field + moon  | —                     | ✅ Integrated |
| `partlycloudy`     | `partly-cloudy` | Blue sky + clouds  | Clouds                | ✅ Integrated |
| `cloudy`           | `cloudy`        | Overcast           | Clouds                | ✅ Integrated |
| `fog`              | `foggy`         | Overcast + fog     | Clouds + fog overlay  | ✅ Integrated |
| `windy`            | `windy`         | Breezy sky         | Clouds + Wind streaks | ✅ Integrated |
| `windy-variant`    | `windy`         | Breezy sky         | Clouds + Wind streaks | ✅ Integrated |
| `rainy`            | `rainy`         | Dark overcast      | Rain                  | ✅ Integrated |
| `lightning-rainy`  | `rainy`         | Dark overcast      | Rain                  | ✅ Integrated |
| `hail`             | `rainy`         | Dark overcast      | Rain                  | ✅ Integrated |
| `snowy-rainy`      | `rainy`         | Dark overcast      | Rain                  | ✅ Integrated |
| `pouring`          | `pouring`       | Very dark overcast | Heavy rain            | ✅ Integrated |
| `lightning`        | `stormy`        | Storm sky + bolts  | Rain                  | ✅ Integrated |
| `snowy`            | `snowy`         | Grey sky + snow    | Clouds                | ✅ Integrated |
| `exceptional`      | `cloudy`        | Overcast fallback  | Clouds                | ✅ Integrated |

### 1.2 State Attributes

| Attribute              | Type     | Unit     | Visual Effect                                                                 | Status        |
|------------------------|----------|----------|-------------------------------------------------------------------------------|---------------|
| `temperature`          | number   | °C / °F  | Displayed as hero temperature                                                 | ✅ Integrated |
| `temperature_unit`     | string   | —        | Unit conversion                                                               | ✅ Integrated |
| `humidity`             | number   | %        | Passed to scene renderer (future: haze overlay)                               | ✅ Passed     |
| `apparent_temperature` | number   | °C / °F  | Available via `apparent_sensor` config                                        | ✅ Integrated |
| `cloud_coverage`       | number   | %        | **Modulates cloud opacity**, sky desaturation, and overcast threshold          | ✅ Integrated |
| `dew_point`            | number   | °C / °F  | Passed to scene renderer (future: condensation effects)                       | ✅ Passed     |
| `pressure`             | number   | hPa      | Passed to scene renderer (future: barometric indicators)                      | ✅ Passed     |
| `uv_index`             | number   | 0–11+    | Passed to scene renderer (future: sun glow intensity)                         | ✅ Passed     |
| `visibility`           | number   | km / mi  | **Adds fog/haze overlay** when < 8.5 km                                       | ✅ Integrated |
| `wind_bearing`         | number   | °        | Available (future: wind streak direction)                                     | 🔲 Available  |
| `wind_speed`           | number   | km/h     | **Drives Lottie cloud & wind animation speed** (scaled 0.3x–2.5x)            | ✅ Integrated |
| `wind_gust_speed`      | number   | km/h     | Passed to scene renderer (future: gust burst effects)                         | ✅ Passed     |
| `precipitation_unit`   | string   | —        | Unit display                                                                  | ✅ Integrated |

### 1.3 Forecast Data (via `weather.get_forecasts`)

Available for `daily`, `hourly`, and `twice_daily` forecast types.

| Forecast Field              | Type    | Used In                     | Status        |
|-----------------------------|---------|-----------------------------|---------------|
| `datetime`                  | string  | Forecast row labels         | ✅ Integrated |
| `condition`                 | string  | Forecast icons              | ✅ Integrated |
| `temperature`               | number  | Forecast high bars          | ✅ Integrated |
| `templow`                   | number  | Forecast low bars           | ✅ Integrated |
| `humidity`                  | number  | —                           | 🔲 Available  |
| `precipitation`             | number  | Forecast display            | ✅ Integrated |
| `precipitation_probability` | number  | Forecast display            | ✅ Integrated |
| `pressure`                  | number  | —                           | 🔲 Available  |
| `wind_bearing`              | number  | —                           | 🔲 Available  |
| `wind_speed`                | number  | —                           | 🔲 Available  |
| `wind_gust_speed`           | number  | —                           | 🔲 Available  |
| `cloud_coverage`            | number  | —                           | 🔲 Available  |
| `uv_index`                  | number  | —                           | 🔲 Available  |
| `apparent_temperature`      | number  | —                           | 🔲 Available  |
| `dew_point`                 | number  | —                           | 🔲 Available  |
| `is_daytime`                | boolean | Twice-daily only            | 🔲 Available  |

---

## 2. Sun Entity (`sun.sun`)

Built-in HA integration. Provides solar position data for accurate scene rendering.

| Attribute / Sensor | Type    | Visual Effect                                                              | Status        |
|--------------------|---------|----------------------------------------------------------------------------|---------------|
| `state`            | string  | `above_horizon` / `below_horizon` → day/night icon selection               | ✅ Integrated |
| `elevation`        | number  | **Sun Y position** in SVG; **drives period detection** (night/dawn/day/dusk); **progressive sky color blending** | ✅ Integrated |
| `azimuth`          | number  | **Sun X position** in SVG (east → west arc)                                | ✅ Integrated |
| `rising`           | boolean | Disambiguates dawn vs dusk at same elevation                               | ✅ Integrated |
| `next_rising`      | datetime| Future: pre-calculate dawn palette timing                                  | 🔲 Available  |
| `next_setting`     | datetime| Future: pre-calculate dusk palette timing                                  | 🔲 Available  |
| `next_dawn`        | datetime| Future: civil dawn trigger                                                 | 🔲 Available  |
| `next_dusk`        | datetime| Future: civil dusk trigger                                                 | 🔲 Available  |
| `next_noon`        | datetime| Future: solar noon indicator                                               | 🔲 Available  |
| `next_midnight`    | datetime| Future: deepest night point                                                | 🔲 Available  |

### Sun Elevation → Period Mapping

The card uses sun elevation for **continuous** period detection (no hard-coded times):

| Elevation Range | Period      | Day Factor | Sky Behaviour                         |
|-----------------|-------------|------------|---------------------------------------|
| ≤ −18°          | `night`     | 0.00       | Deep night, star field                 |
| −18° to −6°     | `night`     | 0.00–0.23  | Astronomical → nautical twilight       |
| −6° to 0°       | `dawn/dusk` | 0.23–0.35  | Civil twilight, horizon glow appears   |
| 0° to 1°        | `dawn/dusk` | 0.35–0.36  | Sun at horizon                         |
| 1° to 25°       | `morning`   | 0.36–0.62  | Low sun, warm tones                    |
| 25° to 60°      | `afternoon` | 0.62–1.00  | Full daylight                          |
| ≥ 60°           | `afternoon` | 1.00       | Zenith (tropical latitudes)            |

Sky colors are **interpolated** using the day factor — no abrupt transitions.

---

## 3. Tomorrow.io Additional Sensors

When using the Tomorrow.io integration, these **extra sensor entities** are
created alongside the standard `weather.*` entity. They can be used via
custom config options or future extensions.

### 3.1 Core Weather Sensors

| Sensor Entity                               | Unit     | Potential Use                                  | Status         |
|---------------------------------------------|----------|------------------------------------------------|----------------|
| `sensor.*_feels_like`                       | °C / °F  | Use via `apparent_sensor` config               | ✅ Configurable|
| `sensor.*_dew_point`                        | °C / °F  | Condensation/fog prediction                    | 🔲 Available   |
| `sensor.*_cloud_base`                       | km / mi  | Cloud altitude rendering                       | 🔲 Available   |
| `sensor.*_cloud_ceiling`                    | km / mi  | Overcast ceiling height                        | 🔲 Available   |
| `sensor.*_cloud_cover`                      | %        | Same as `cloud_coverage`, alternative source   | 🔲 Available   |
| `sensor.*_wind_gust`                        | km/h     | Gust burst Lottie effects                      | 🔲 Available   |
| `sensor.*_precipitation_type`               | enum     | none / rain / snow / freezing_rain / ice_pellets| 🔲 Available  |
| `sensor.*_uv_index`                         | 0–11+    | Sun glow intensity                             | 🔲 Available   |
| `sensor.*_uv_health_concern`                | enum     | low / moderate / high / very_high / extreme    | 🔲 Available   |
| `sensor.*_visibility`                       | km / mi  | Alternative to weather entity visibility       | 🔲 Available   |
| `sensor.*_pressure_surface_level`           | hPa      | Alternative pressure source                    | 🔲 Available   |
| `sensor.*_global_horizontal_irradiance`     | W/m²     | Solar radiation → sun brightness               | 🔲 Available   |

### 3.2 Air Quality Sensors (paid plan)

| Sensor Entity                          | Unit    | Potential Use                             |
|----------------------------------------|---------|-------------------------------------------|
| `sensor.*_pm2_5`                       | µg/m³   | Haze overlay opacity                      |
| `sensor.*_pm10`                        | µg/m³   | Haze overlay opacity                      |
| `sensor.*_o3_ozone`                    | ppb     | Sky tint                                  |
| `sensor.*_no2_nitrogen_dioxide`        | ppb     | Sky tint                                  |
| `sensor.*_co_carbon_monoxide`          | ppm     | —                                         |
| `sensor.*_so2_sulfur_dioxide`          | ppb     | —                                         |
| `sensor.*_epa_aqi`                     | index   | Use via `aqi_sensor` config               |
| `sensor.*_epa_health_concern`          | enum    | —                                         |
| `sensor.*_epa_primary_pollutant`       | enum    | —                                         |

### 3.3 Pollen Sensors (paid plan)

| Sensor Entity            | Scale     | Potential Use         |
|--------------------------|-----------|------------------------|
| `sensor.*_tree_pollen`   | 0–5 index | Info badge             |
| `sensor.*_weed_pollen`   | 0–5 index | Info badge             |
| `sensor.*_grass_pollen`  | 0–5 index | Info badge             |

### 3.4 Fire Index (paid plan)

| Sensor Entity            | Scale   | Potential Use               |
|--------------------------|---------|-----------------------------|
| `sensor.*_fire_index`    | index   | Warm tint on extreme values |

---

## 4. Card Configuration Options

Current `type: custom:hass-weather-card` YAML properties:

| Property              | Type    | Default    | Description                                      |
|-----------------------|---------|------------|--------------------------------------------------|
| `entity`              | string  | (required) | Weather entity ID (`weather.home`)               |
| `sun_entity`          | string  | `sun.sun`  | Sun entity for elevation/azimuth/rising           |
| `title`               | string  | —          | Card title                                        |
| `temperature_sensor`  | string  | —          | Override temperature from a sensor entity          |
| `humidity_sensor`     | string  | —          | Override humidity from a sensor entity             |
| `apparent_sensor`     | string  | —          | Feels-like temperature sensor                      |
| `aqi_sensor`          | string  | —          | Air quality index sensor                           |
| `weather_icon_type`   | string  | `line`     | `fill` or `line` icon style                        |
| `animated_icon`       | boolean | `true`     | Lottie animated icons                              |
| `forecast_rows`       | number  | `5`        | Number of forecast rows to display                 |
| `hourly_forecast`     | boolean | `false`    | Show hourly forecast strip                         |
| `hide_forecast_section` | boolean | `false`  | Hide forecast entirely                             |
| `hide_today_section`  | boolean | `false`    | Hide hero section                                  |
| `hide_clock`          | boolean | `false`    | Hide clock display                                 |
| `hide_date`           | boolean | `false`    | Hide date display                                  |
| `show_humidity`       | boolean | `false`    | Show humidity in hero                              |
| `show_decimal`        | boolean | `false`    | Show decimal temperatures                          |
| `time_format`         | string  | auto       | `12` or `24`                                       |
| `time_pattern`        | string  | —          | Luxon format pattern                               |
| `date_pattern`        | string  | `D`        | Luxon date format pattern                          |
| `locale`              | string  | auto       | Locale override                                    |
| `use_browser_time`    | boolean | `false`    | Use browser timezone instead of HA                 |
| `time_zone`           | string  | auto       | Override timezone                                  |

---

## 5. Visual Rendering Pipeline

```
┌─────────────────────────────────────┐
│  HA Weather Entity  +  Sun Entity   │
│  (state, attributes, forecasts)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  getTimePeriod()                      │
│  sun.elevation → period + dayFactor   │
│  (night/dawn/morning/afternoon/dusk)  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  buildBackground(condition, period)   │
│                                       │
│  1. condition → visual group          │
│  2. dayFactor → progressive sky lerp  │
│  3. cloud_coverage → cloud opacity    │
│  4. visibility → fog overlay          │
│  5. sun elevation + azimuth → sun pos │
│  6. Compose SVG layers:              │
│     sky gradient                      │
│     celestial bodies                  │
│     clouds / overcast / snow / thunder│
│     coastal scene (land + ocean)      │
│     fog overlay                       │
│     scrim gradient                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  updateLottie(group)                  │
│                                       │
│  wind_speed → cloud drift speed       │
│  condition → rain speed               │
│  condition → show/hide layers         │
│  condition → CSS filter tint          │
└──────────────────────────────────────┘
```

---

## 6. Weather Integrations Compatibility

The card works with **any** HA weather integration.
Below are the most common ones and which extra attributes they provide:

| Integration     | `cloud_coverage` | `visibility` | `wind_gust` | `uv_index` | `dew_point` | `apparent_temp` | Extra Sensors |
|-----------------|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Tomorrow.io     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | AQI, pollen, fire, irradiance |
| Open-Meteo      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Met.no          | ✅ | — | — | ✅ | — | — | — |
| OpenWeatherMap  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | AQI |
| Pirate Weather  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| AccuWeather     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Weather.gov     | — | ✅ | ✅ | — | ✅ | — | — |

All attributes gracefully fall back to condition-based defaults when not provided.

---

## 7. Future Possibilities

Data points that are **passed through** but not yet visually rendered:

| Data Point         | Planned Effect                                           |
|--------------------|----------------------------------------------------------|
| `humidity`         | Haze/mist overlay when humidity > 85%                    |
| `uv_index`        | Sun glow radius and intensity scaling                     |
| `dew_point`        | Condensation shimmer on ocean surface                    |
| `pressure`         | Subtle atmospheric distortion effect                      |
| `wind_bearing`     | Directional wind streaks and cloud movement              |
| `wind_gust_speed`  | Momentary speed burst pulses on wind Lottie              |
| `precipitation_type` | Switch rain Lottie to snow/ice variants                |
| `cloud_base`       | Adjust cloud vertical position in SVG                    |
| `solar_irradiance` | Drive sun opacity/glow from actual radiation             |
| `pm2_5` / `pm10`   | Brownish haze overlay proportional to particulate count  |
| `next_rising/setting` | Pre-animate dawn/dusk transition                      |
