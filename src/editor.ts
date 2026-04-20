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
  use_browser_time: false
}

const SCHEMA = [
  // ── Entities ─────────────────────────────────────────────────────────────
  { name: 'entity', required: true, selector: { entity: { domain: 'weather' } } },
  { name: 'sun_entity', selector: { entity: { domain: 'sun' } } },
  { name: 'moon_entity', selector: { entity: { domain: 'moon' } } },
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
  show_daily_temp: 'Show Daily Temp',
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
    // Spread defaults first so sliders always show a value, then overlay user config
    const merged: Partial<ClockWeatherCardConfig> = { ...CONFIG_DEFAULTS, ...config }
    this._config = merged as ClockWeatherCardConfig
  }

  // ── ha-form expandable sections use data[name] as sub-object context.
  // We must nest the flat config into sub-objects matching section names.
  private get _formData (): Record<string, unknown> {
    const empty: Partial<ClockWeatherCardConfig> = {}
    const c: ClockWeatherCardConfig = this._config ?? (empty as ClockWeatherCardConfig)
    return {
      entity: (c as any).entity,
      sun_entity: (c as any).sun_entity,
      moon_entity: (c as any).moon_entity,
      temperature_sensor: (c as any).temperature_sensor,
      humidity_sensor: (c as any).humidity_sensor,
      apparent_sensor: (c as any).apparent_sensor,
      _header: {
        hide_today_section: c.hide_today_section,
        hide_clock: c.hide_clock,
        hide_date: c.hide_date,
        show_humidity: c.show_humidity,
        hero_display: c.hero_display,
        time_format: c.time_format,
        time_pattern: c.time_pattern,
        icon_size: c.icon_size,
        sub_font_size: c.sub_font_size
      },
      _hourly: {
        hourly_forecast: c.hourly_forecast,
        show_hourly_temp: (c as any).show_hourly_temp,
        hourly_forecast_columns: c.hourly_forecast_columns,
        hourly_forecast_size: c.hourly_forecast_size,
        hourly_padding: c.hourly_padding,
        hourly_time_font_size: c.hourly_time_font_size
      },
      _daily: {
        hide_daily_section: c.hide_daily_section,
        hide_forecast_section: c.hide_forecast_section,
        show_daily_temp: (c as any).show_daily_temp,
        day_forecast_columns: c.day_forecast_columns,
        day_name_format: c.day_name_format,
        daily_forecast_size: c.daily_forecast_size
      },
      _overall: {
        weather_icon_type: c.weather_icon_type,
        animated_icon: c.animated_icon,
        show_decimal: c.show_decimal,
        use_browser_time: c.use_browser_time,
        card_padding: c.card_padding,
        locale: (c as any).locale,
        time_zone: (c as any).time_zone
      }
    }
  }

  private _computeLabel (schema: { name: string }): string {
    return LABELS[schema.name] ?? schema.name
  }

  // ── Flatten nested expandable data back to flat config before firing event
  private _valueChanged (ev: CustomEvent): void {
    const d: Record<string, any> = ev.detail.value as Record<string, any>
    const flat: Record<string, any> = { ...d }
    for (const section of ['_header', '_hourly', '_daily', '_overall']) {
      if (flat[section] && typeof flat[section] === 'object') {
        Object.assign(flat, flat[section])
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete flat[section]
      }
    }
    fireEvent(this, 'config-changed', { config: flat as ClockWeatherCardConfig })
  }

  protected render (): TemplateResult {
    if (!this.hass || !this._config) {
      return html``
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._formData}
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
