import { LitElement, html, css, type CSSResultGroup, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { type HomeAssistant, fireEvent } from 'custom-card-helpers'
import { type ClockWeatherCardConfig } from './types'

const SCHEMA = [
  {
    name: 'entity',
    required: true,
    selector: { entity: { domain: 'weather' } }
  },
  {
    name: 'sun_entity',
    selector: { entity: { domain: 'sun' } }
  },
  {
    name: 'moon_entity',
    selector: { entity: { domain: 'moon' } }
  },
  {
    name: 'temperature_sensor',
    selector: { entity: { domain: 'sensor', device_class: 'temperature' } }
  },
  {
    name: 'humidity_sensor',
    selector: { entity: { domain: 'sensor', device_class: 'humidity' } }
  },
  {
    name: 'apparent_sensor',
    selector: { entity: { domain: 'sensor', device_class: 'temperature' } }
  },
  {
    name: '',
    type: 'grid',
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
      {
        name: 'animated_icon',
        selector: { boolean: {} }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
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
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'time_pattern',
        selector: { text: {} }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'hero_display',
        selector: {
          select: {
            options: [
              { value: 'temperature', label: 'Temperature' },
              { value: 'time', label: 'Time' }
            ],
            mode: 'dropdown'
          }
        }
      },
      {
        name: 'day_forecast_columns',
        selector: { number: { min: 1, max: 10, mode: 'box' } }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'icon_size',
        selector: { number: { min: 20, max: 200, unit_of_measurement: 'px', mode: 'box' } }
      },
      {
        name: 'hero_gap',
        selector: { number: { min: 0, max: 50, unit_of_measurement: 'px', mode: 'box' } }
      },
      {
        name: 'sub_font_size',
        selector: { number: { min: 0.5, max: 5, step: 0.1, unit_of_measurement: 'rem', mode: 'box' } }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'hourly_forecast',
        selector: { boolean: {} }
      },
      {
        name: 'hourly_forecast_columns',
        selector: { number: { min: 1, max: 12, mode: 'box' } }
      },
      {
        name: 'show_decimal',
        selector: { boolean: {} }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'daily_forecast_size',
        selector: { number: { min: 50, max: 200, unit_of_measurement: '%', mode: 'slider' } }
      },
      {
        name: 'hourly_forecast_size',
        selector: { number: { min: 50, max: 200, unit_of_measurement: '%', mode: 'slider' } }
      },
      {
        name: 'card_padding',
        selector: { number: { min: 0, max: 48, unit_of_measurement: 'px', mode: 'slider' } }
      },
      {
        name: 'hourly_padding',
        selector: { number: { min: 0, max: 24, unit_of_measurement: 'px', mode: 'slider' } }
      },
      {
        name: 'hourly_time_font_size',
        selector: { number: { min: 0.5, max: 2, step: 0.05, unit_of_measurement: 'rem', mode: 'slider' } }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'show_humidity',
        selector: { boolean: {} }
      },
      {
        name: 'hide_today_section',
        selector: { boolean: {} }
      },
      {
        name: 'hide_forecast_section',
        selector: { boolean: {} }
      },
      {
        name: 'hide_clock',
        selector: { boolean: {} }
      }
    ]
  },
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'use_browser_time',
        selector: { boolean: {} }
      },
      {
        name: 'locale',
        selector: { text: {} }
      },
      {
        name: 'time_zone',
        selector: { text: {} }
      }
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
  weather_icon_type: 'Icon Style',
  animated_icon: 'Animated Icon',
  time_format: 'Time Format',
  day_name_format: 'Day Name Format',
  time_pattern: 'Time Pattern',
  hero_display: 'Hero Display',
  day_forecast_columns: 'Daily Columns',
  hourly_forecast_columns: 'Hourly Columns',
  daily_forecast_size: 'Daily Forecast Size',
  hourly_forecast_size: 'Hourly Forecast Size',
  card_padding: 'Card Padding',
  hourly_padding: 'Hourly Strip Padding',
  hourly_time_font_size: 'Hourly Time Font Size',
  icon_size: 'Icon Size',
  hero_gap: 'Hero Gap',
  sub_font_size: 'Sub Font Size',
  hourly_forecast: 'Hourly Forecast',
  show_humidity: 'Show Humidity',
  show_decimal: 'Show Decimal',
  hide_today_section: 'Hide Today Section',
  hide_forecast_section: 'Hide Forecast Section',
  hide_clock: 'Hide Clock',
  use_browser_time: 'Use Browser Time',
  locale: 'Locale',
  time_zone: 'Time Zone'
}

@customElement('hass-weather-card-editor')
export class HassWeatherCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant
  @state() private _config!: ClockWeatherCardConfig

  public setConfig (config: ClockWeatherCardConfig): void {
    this._config = config
  }

  private _computeLabel (schema: { name: string }): string {
    return LABELS[schema.name] ?? schema.name
  }

  private _valueChanged (ev: CustomEvent): void {
    const newConfig = ev.detail.value as ClockWeatherCardConfig
    fireEvent(this, 'config-changed', { config: newConfig })
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
