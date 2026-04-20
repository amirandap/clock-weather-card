import { LitElement, html, css, type CSSResultGroup, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { type HomeAssistant, fireEvent } from 'custom-card-helpers'
import { type ClockWeatherCardConfig } from './types'

// ── Defaults mirrored here so sliders show correct initial value ──────────
const CONFIG_DEFAULTS: Partial<ClockWeatherCardConfig> = {
  hero_display: 'time',
  time_format: '12',
  time_pattern: 'h:mm',
  day_name_format: 'short',
  weather_icon_type: 'line',
  animated_icon: true,
  icon_size: 48,
  sub_font_size: 1.3,
  day_forecast_columns: 5,
  hourly_forecast_columns: 4,
  daily_forecast_size: 100,
  hourly_forecast_size: 100,
  card_padding: 4,
  hourly_padding: 6,
  hourly_time_font_size: 0.65,
  hourly_forecast: false,
  hide_today_section: false,
  hide_forecast_section: false,
  hide_daily_section: false,
  hide_clock: false,
  hide_date: false,
  show_humidity: false,
  show_daily_temp: true,
  show_hourly_temp: false,
  show_decimal: false,
  use_browser_time: false,
  show_clouds: true,
  show_humidity_daily: false,
  show_humidity_hourly: false
}

const SCHEMA = [
  // ── Entities ─────────────────────────────────────────────────────────────
  { name: 'entity', required: true, selector: { entity: { domain: 'weather' } } },
  { name: 'sun_entity', selector: { entity: { domain: 'sun' } } },
  { name: 'moon_entity', selector: { entity: { domain: ['moon', 'sensor'] } } },
  { name: 'temperature_sensor', selector: { entity: { domain: 'sensor', device_class: 'temperature' } } },
  { name: 'humidity_sensor', selector: { entity: { domain: 'sensor', device_class: 'humidity' } } },
  { name: 'apparent_sensor', selector: { entity: { domain: 'sensor', device_class: 'temperature' } } },

  // ── Header section ────────────────────────────────────────────────────────
  {
    name: '_header',
    type: 'expandable',
    title: 'Header',
    schema: [
      { name: 'hide_today_section', selector: { boolean: {} } },
      { name: 'hide_clock', selector: { boolean: {} } },
      { name: 'hide_date', selector: { boolean: {} } },
      { name: 'show_humidity', selector: { boolean: {} } },
      {
        name: 'hero_display',
        selector: {
          select: {
            options: [
              { value: 'time', label: 'Time' },
              { value: 'temperature', label: 'Temperature' }
            ],
            mode: 'dropdown'
          }
        }
      },
      {
        name: 'time_format',
        selector: {
          select: {
            options: [
              { value: '12', label: '12h (AM/PM)' },
              { value: '24', label: '24h' }
            ],
            mode: 'dropdown'
          }
        }
      },
      { name: 'time_pattern', selector: { text: {} } },
      { name: 'icon_size', selector: { number: { min: 16, max: 120, unit_of_measurement: 'px', mode: 'slider' } } },
      { name: 'sub_font_size', selector: { number: { min: 0.8, max: 3, step: 0.05, unit_of_measurement: 'rem', mode: 'slider' } } }
    ]
  },

  // ── Hourly Forecast section ───────────────────────────────────────────────
  {
    name: '_hourly',
    type: 'expandable',
    title: 'Hourly Forecast',
    schema: [
      { name: 'hourly_forecast', selector: { boolean: {} } },
      { name: 'show_hourly_temp', selector: { boolean: {} } },
      { name: 'show_humidity_hourly', selector: { boolean: {} } },
      { name: 'hourly_forecast_columns', selector: { number: { min: 1, max: 12, mode: 'box' } } },
      { name: 'hourly_forecast_size', selector: { number: { min: 50, max: 200, unit_of_measurement: '%', mode: 'slider' } } },
      { name: 'hourly_padding', selector: { number: { min: 0, max: 32, unit_of_measurement: 'px', mode: 'slider' } } },
      { name: 'hourly_time_font_size', selector: { number: { min: 0.5, max: 2, step: 0.05, unit_of_measurement: 'rem', mode: 'slider' } } }
    ]
  },

  // ── Daily Forecast section ────────────────────────────────────────────────
  {
    name: '_daily',
    type: 'expandable',
    title: 'Daily Forecast',
    schema: [
      { name: 'hide_daily_section', selector: { boolean: {} } },
      { name: 'hide_forecast_section', selector: { boolean: {} } },
      { name: 'show_daily_temp', selector: { boolean: {} } },
      { name: 'show_humidity_daily', selector: { boolean: {} } },
      { name: 'day_forecast_columns', selector: { number: { min: 1, max: 10, mode: 'box' } } },
      {
        name: 'day_name_format',
        selector: {
          select: {
            options: [
              { value: 'long', label: 'Long (Monday)' },
              { value: 'short', label: 'Short (Mon)' }
            ],
            mode: 'dropdown'
          }
        }
      },
      { name: 'daily_forecast_size', selector: { number: { min: 50, max: 200, unit_of_measurement: '%', mode: 'slider' } } }
    ]
  },

  // ── Overall / Card section ────────────────────────────────────────────────
  {
    name: '_overall',
    type: 'expandable',
    title: 'Overall',
    schema: [
      {
        name: 'weather_icon_type',
        selector: {
          select: {
            options: [
              { value: 'line', label: 'Line' },
              { value: 'fill', label: 'Fill' }
            ],
            mode: 'dropdown'
          }
        }
      },
      { name: 'animated_icon', selector: { boolean: {} } },
      { name: 'show_clouds', selector: { boolean: {} } },
      { name: 'show_decimal', selector: { boolean: {} } },
      { name: 'use_browser_time', selector: { boolean: {} } },
      { name: 'card_padding', selector: { number: { min: 0, max: 48, unit_of_measurement: 'px', mode: 'slider' } } },
      { name: 'locale', selector: { text: {} } },
      { name: 'time_zone', selector: { text: {} } }
    ]
  }
]

const LABELS: Record<string, string> = {
  entity: 'Weather Entity',
  sun_entity: 'Sun Entity',
  moon_entity: 'Moon Entity',
  temperature_sensor: 'Temperature Sensor (override)',
  humidity_sensor: 'Humidity Sensor (override)',
  apparent_sensor: 'Apparent Temperature Sensor',
  _header: 'Header',
  _hourly: 'Hourly Forecast',
  _daily: 'Daily Forecast',
  _overall: 'Overall',
  weather_icon_type: 'Icon Style',
  animated_icon: 'Animated Icons',
  time_format: 'Time Format',
  day_name_format: 'Day Name Format',
  time_pattern: 'Time Pattern',
  hero_display: 'Hero Displays',
  day_forecast_columns: 'Columns',
  hourly_forecast_columns: 'Columns',
  daily_forecast_size: 'Icon Size',
  hourly_forecast_size: 'Icon Size',
  card_padding: 'Card Padding',
  hourly_padding: 'Vertical Padding',
  hourly_time_font_size: 'Time Label Size',
  icon_size: 'Icon Size',
  hero_gap: 'Hero Gap',
  sub_font_size: 'Condition Font Size',
  hourly_forecast: 'Show Hourly',
  show_hourly_temp: 'Show Hourly Temp',
  show_humidity_hourly: 'Show Humidity (hourly)',
  show_daily_temp: 'Show Daily Temp',
  show_humidity_daily: 'Show Humidity (daily)',
  show_clouds: 'Show Clouds / Rain Animation',
  show_humidity: 'Show Humidity',
  show_decimal: 'Show Decimal',
  hide_today_section: 'Hide Header',
  hide_forecast_section: 'Hide All Forecasts',
  hide_daily_section: 'Hide Daily',
  hide_clock: 'Hide Clock',
  hide_date: 'Hide Date',
  use_browser_time: 'Use Browser Time',
  locale: 'Locale',
  time_zone: 'Time Zone'
}

@customElement('hass-weather-card-editor')
export class HassWeatherCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant
  @state() private _config!: ClockWeatherCardConfig

  public setConfig (config: ClockWeatherCardConfig): void {
    // Spread defaults first so sliders always show a value, then overlay user config.
    // ha-form-expandable passes the FULL flat data to inner ha-form, so no nesting needed.
    const merged: Partial<ClockWeatherCardConfig> = { ...CONFIG_DEFAULTS, ...config }
    // Normalize time_format to string — YAML may deserialise it as the number 12 or 24
    if (merged.time_format != null) {
      merged.time_format = String(merged.time_format) as '12' | '24'
    }
    this._config = merged as ClockWeatherCardConfig
  }

  private _computeLabel (schema: { name: string }): string {
    return LABELS[schema.name] ?? schema.name
  }

  private _valueChanged (ev: CustomEvent): void {
    // Merge onto original config to preserve fields not in schema (e.g. type, tap_action)
    const config = { ...this._config, ...(ev.detail.value as ClockWeatherCardConfig) }
    fireEvent(this, 'config-changed', { config })
  }

  protected render (): TemplateResult {
    if (!this.hass || !this._config) {
      return html``
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${(schema: { name: string }) => this._computeLabel(schema)}
        @value-changed=${(ev: CustomEvent) => { this._valueChanged(ev) }}
      ></ha-form>
    `
  }

  static readonly styles: CSSResultGroup = css`
      ha-form {
        display: block;
      }
    `
}
