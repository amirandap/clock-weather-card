import { type LovelaceCard, type LovelaceCardConfig, type LovelaceCardEditor } from 'custom-card-helpers'
import { type HassEntity } from 'home-assistant-js-websocket/dist/types'
import { type DateTime } from 'luxon'

declare global {
  interface HTMLElementTagNameMap {
    'hass-weather-card-editor': LovelaceCardEditor
    'hui-error-card': LovelaceCard
  }
}

export interface ClockWeatherCardConfig extends LovelaceCardConfig {
  entity: string
  title?: string
  sun_entity?: string
  moon_entity?: string
  climate_entity?: string
  temperature_sensor?: string
  humidity_sensor?: string
  weather_icon_type?: 'fill' | 'line'
  animated_icon?: boolean
  /** Number of daily forecast columns (default: 5) */
  day_forecast_columns?: number
  /** Number of hourly forecast columns (default: 4) */
  hourly_forecast_columns?: number
  locale?: string
  time_format?: '12' | '24'
  time_pattern?: string
  date_pattern?: string
  hide_today_section?: boolean
  hide_forecast_section?: boolean
  show_humidity?: boolean
  hourly_forecast?: boolean
  hide_clock?: boolean
  hide_date?: boolean
  use_browser_time?: boolean
  time_zone?: string
  show_decimal?: boolean
  apparent_sensor?: string
  aqi_sensor?: string
  /** What the hero shows: 'temperature' (default) or 'time' */
  hero_display?: 'temperature' | 'time'
  /** Sub-text font size in rem (default: 1.7) */
  sub_font_size?: number
  /** Hero icon size in px (default: 90) */
  icon_size?: number
  /** Gap between hero columns in px (default: 8) */
  hero_gap?: number
  /** Day name format: 'long' (full name) or 'short' (abbreviated) — default: 'long' */
  day_name_format?: 'long' | 'short'
  /** Daily forecast icon/element size as percentage (default: 100) */
  daily_forecast_size?: number
  /** Hourly forecast icon/element size as percentage (default: 100) */
  hourly_forecast_size?: number
  /** Card body padding in px (default: 16) */
  card_padding?: number
  /** Hourly forecast strip vertical padding in px (default: 6) */
  hourly_padding?: number
  /** Hour-slot time label font size in rem (default: 0.9) */
  hourly_time_font_size?: number
  /** Hide the daily forecast strip (default: false) */
  hide_daily_section?: boolean
  /** Show temperature in daily forecast slots (default: true) */
  show_daily_temp?: boolean
  /** Show temperature in hourly forecast slots (default: false) */
  show_hourly_temp?: boolean
}

export interface MergedClockWeatherCardConfig extends LovelaceCardConfig {
  entity: string
  title?: string
  sun_entity: string
  moon_entity?: string
  climate_entity?: string
  temperature_sensor?: string
  humidity_sensor?: string
  weather_icon_type: 'fill' | 'line'
  animated_icon: boolean
  day_forecast_columns: number
  hourly_forecast_columns: number
  locale?: string
  time_format?: '12' | '24'
  time_pattern?: string
  date_pattern: string
  hide_today_section: boolean
  hide_forecast_section: boolean
  show_humidity: boolean
  hourly_forecast: boolean
  hide_clock: boolean
  hide_date: boolean
  use_browser_time: boolean
  time_zone?: string
  show_decimal: boolean
  apparent_sensor?: string
  aqi_sensor?: string
  hero_display: 'temperature' | 'time'
  sub_font_size: number
  icon_size: number
  hero_gap: number
  day_name_format: 'long' | 'short'
  daily_forecast_size: number
  hourly_forecast_size: number
  card_padding: number
  hourly_padding: number
  hourly_time_font_size: number
  hide_daily_section: boolean
  show_daily_temp: boolean
  show_hourly_temp: boolean
}

export const enum WeatherEntityFeature {
  FORECAST_DAILY = 1,
  FORECAST_HOURLY = 2,
  FORECAST_TWICE_DAILY = 4,
}

export interface Weather extends HassEntity {
  state: string
  attributes: {
    temperature?: number
    temperature_unit: TemperatureUnit
    humidity?: number
    precipitation_unit: string
    forecast?: WeatherForecast[]
    supported_features: WeatherEntityFeature
  }
}

export type TemperatureUnit = '°C' | '°F'

export interface WeatherForecast {
  datetime: string
  condition: string
  temperature: number | null
  humidity?: number | null
  precipitation: number | null
  precipitation_probability: number | null
  templow: number | null
}

export interface MergedWeatherForecast {
  datetime: DateTime
  condition: string
  temperature: number
  precipitation: number
  precipitation_probability: number
  templow: number
}

export class Rgb {
  r: number
  g: number
  b: number

  constructor (r: number, g: number, b: number) {
    this.r = r
    this.g = g
    this.b = b
  }

  toRgbString (): string {
    return `rgb(${this.r}, ${this.g}, ${this.b})`
  }
}

export interface TemperatureSensor extends HassEntity {
  state: string
  attributes: {
    unit_of_measurement?: TemperatureUnit
  }
}

export interface HumiditySensor extends HassEntity {
  state: string
}

export interface WeatherForecastEvent {
  forecast?: WeatherForecast[]
  type: 'hourly' | 'daily' | 'twice_daily'
}
