import { LitElement, html, type TemplateResult, type PropertyValues, type CSSResultGroup } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { customElement, property, state } from 'lit/decorators.js'
import {
  type HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  type ActionHandlerEvent,
  handleAction,
  TimeFormat,
  type ActionConfig
} from 'custom-card-helpers'

import {
  type ClockWeatherCardConfig,
  type MergedClockWeatherCardConfig,
  type MergedWeatherForecast,
  type TemperatureSensor,
  type TemperatureUnit,
  type HumiditySensor,
  type Weather,
  WeatherEntityFeature,
  type WeatherForecast,
  type WeatherForecastEvent
} from './types'
import styles from './styles'
import { actionHandler } from './action-handler-directive'
import { localize } from './localize/localize'
import { type HassEntity, type HassEntityBase } from 'home-assistant-js-websocket'
import { extractMostOccuring, max, min, roundIfNotNull, roundUp } from './utils'
import { animatedIcons, staticIcons } from './images'
import { version } from '../package.json'
import { safeRender } from './helpers'
import { DateTime } from 'luxon'
import { DotLottie } from '@lottiefiles/dotlottie-web'
import { CLOUDS_LOTTIE, RAIN_LOTTIE, WIND_LOTTIE } from './lottie-assets'
import { buildBackground, type SkyOpts, elevationToPeriod, computeCardGradient } from './svg-scene'
import './editor'

// Point DotLottie at the co-located WASM file so it doesn't fetch from CDN
// In HACS the JS lives at /hacsfiles/clock-weather-card/hass-weather-card.js
// so the WASM will be at /hacsfiles/clock-weather-card/dotlottie-player.wasm
try {
  const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ??
    new URL(import.meta.url).href
  const wasmUrl = new URL('dotlottie-player.wasm', scriptUrl).href
  DotLottie.setWasmUrl(wasmUrl)
} catch (_e) {
  // Fallback: let DotLottie try the CDN
}

console.info(
  `%c  HASS-WEATHER-CARD \n%c Version: ${version}`,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'hass-weather-card',
  name: 'Hass Weather Card',
  description: 'Time-of-day theming, lottie backgrounds, and full HA weather integration.'
})

// ── Condition → CSS slug mapping (15 HA conditions → 8 slugs) ──────────
const CONDITION_GROUP: Record<string, string> = {
  'clear-night': 'sunny',
  sunny: 'sunny',
  partlycloudy: 'partly-cloudy',
  cloudy: 'cloudy',
  windy: 'windy',
  'windy-variant': 'windy',
  fog: 'foggy',
  rainy: 'rainy',
  'lightning-rainy': 'rainy',
  hail: 'rainy',
  'snowy-rainy': 'rainy',
  pouring: 'pouring',
  lightning: 'stormy',
  snowy: 'snowy',
  exceptional: 'cloudy'
}

// Condition groups that trigger cloud / rain / wind lottie layers
const LOTTIE_CLOUDS_GROUPS = new Set(['sunny', 'partly-cloudy', 'cloudy', 'foggy', 'snowy', 'windy'])
const LOTTIE_RAIN_GROUPS = new Set(['rainy', 'pouring', 'stormy'])
const LOTTIE_WIND_GROUPS = new Set(['windy'])

// CSS filter tints the cloud canvas to match sky mood
const CLOUD_FILTER: Record<string, string> = {
  sunny: 'none',
  'partly-cloudy': 'none',
  cloudy: 'brightness(0.78) saturate(0.30)',
  foggy: 'brightness(0.84) saturate(0.05)',
  snowy: 'brightness(1.15) saturate(0.15) hue-rotate(180deg)',
  rainy: 'brightness(0.66) saturate(0.55) hue-rotate(195deg)',
  pouring: 'brightness(0.52) saturate(0.65) hue-rotate(202deg)',
  stormy: 'brightness(0.38) saturate(0.70) hue-rotate(212deg)',
  windy: 'brightness(1.08) saturate(0.40)'
}

// Playback speed: clouds drift faster in storms; rain speed matches intensity
const CLOUD_SPEED: Record<string, number> = {
  sunny: 0.50,
  'partly-cloudy': 0.65,
  cloudy: 0.90,
  foggy: 0.40,
  snowy: 0.55,
  rainy: 1.00,
  pouring: 1.30,
  stormy: 1.80,
  windy: 1.60
}
const RAIN_SPEED: Record<string, number> = { rainy: 0.85, pouring: 1.55, stormy: 2.30 }

@customElement('hass-weather-card')
export class HassWeatherCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant

  @state() private config!: MergedClockWeatherCardConfig
  @state() private currentDate!: DateTime
  @state() private forecasts?: WeatherForecast[]
  @state() private hourlyForecasts?: WeatherForecast[]
  @state() private error?: TemplateResult
  private forecastSubscriber?: () => Promise<void>
  private forecastSubscriberHourly?: () => Promise<void>
  private forecastSubscriberLock = false
  private _lottieCloud?: DotLottie
  private _lottieRain?: DotLottie
  private _lottieWind?: DotLottie
  private _lottieCloud2?: DotLottie
  private _lottieRain2?: DotLottie
  private currentDateInterval?: ReturnType<typeof setInterval>

  constructor () {
    super()
    this.currentDate = DateTime.now()
  }

  public static async getConfigElement (): Promise<HTMLElement> {
    return document.createElement('hass-weather-card-editor')
  }

  public static getStubConfig (_hass: HomeAssistant, entities: string[], entitiesFallback: string[]): Record<string, unknown> {
    const entity = entities.find(e => e.startsWith('weather.')) ?? entitiesFallback.find(e => e.startsWith('weather.'))
    if (entity) {
      return { entity }
    }
    return {}
  }

  public getCardSize (): number {
    return 3 + roundUp(this.config.day_forecast_columns / 2)
  }

  public setConfig (config?: ClockWeatherCardConfig): void {
    if (!config) {
      throw this.createError('Invalid configuration.')
    }
    if (!config.entity) {
      throw this.createError('Attribute "entity" must be present.')
    }
    if (config.day_forecast_columns && config.day_forecast_columns < 1) {
      throw this.createError('Attribute "day_forecast_columns" must be greater than 0.')
    }
    if (config.time_format && config.time_format.toString() !== '24' && config.time_format.toString() !== '12') {
      throw this.createError('Attribute "time_format" must either be "12" or "24".')
    }
    this.config = this.mergeConfig(config)
  }

  protected shouldUpdate (changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false
    }
    // Always re-render when config changes (editor toggles, sliders, etc.)
    if (changedProps.has('config')) {
      return true
    }
    if (changedProps.has('forecasts') || changedProps.has('hourlyForecasts')) {
      return true
    }
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined
    if (oldHass) {
      const oldSun = oldHass.states[this.config.sun_entity]
      const newSun = this.hass.states[this.config.sun_entity]
      if (oldSun !== newSun) {
        return true
      }
      // Re-render when weather entity attributes change (cloud_coverage, wind, etc.)
      const oldWeather = oldHass.states[this.config.entity]
      const newWeather = this.hass.states[this.config.entity]
      if (oldWeather !== newWeather) {
        return true
      }
      return false
    }
    return hasConfigOrEntityChanged(this, changedProps, false)
  }

  protected firstUpdated (changedProps: PropertyValues): void {
    super.firstUpdated(changedProps)
    this.initLottie()
    this.applyTheme()
  }

  protected updated (changedProps: PropertyValues): void {
    super.updated(changedProps)
    if (changedProps.has('config')) {
      void this.subscribeForecastEvents()
    }
    if (changedProps.has('hass') || changedProps.has('currentDate')) {
      this.applyTheme()
    }
  }

  // ── Lottie lifecycle ────────────────────────────────────────────────────

  private initLottie (): void {
    const haCard = this.shadowRoot?.querySelector('ha-card')
    const canvasClouds = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds')
    const canvasClouds2 = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds2')
    const canvasRain = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain')
    const canvasRain2 = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain2')
    const canvasWind = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasWind')
    if (!canvasClouds || !canvasRain || !haCard) return

    // Set canvas drawing buffer to full card dimensions
    const w = haCard.clientWidth || 460
    const h = haCard.clientHeight || 560
    const rowH = Math.round(h * 0.65)
    canvasClouds.width = w; canvasClouds.height = rowH
    canvasRain.width = w; canvasRain.height = h

    this._lottieCloud = new DotLottie({
      canvas: canvasClouds,
      src: CLOUDS_LOTTIE,
      loop: true,
      autoplay: true,
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
    })

    this._lottieRain = new DotLottie({
      canvas: canvasRain,
      src: RAIN_LOTTIE,
      loop: true,
      autoplay: true,
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
    })

    if (canvasClouds2) {
      canvasClouds2.width = w; canvasClouds2.height = rowH
      this._lottieCloud2 = new DotLottie({
        canvas: canvasClouds2,
        src: CLOUDS_LOTTIE,
        loop: true,
        autoplay: true,
        renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
      })
    }

    if (canvasRain2) {
      canvasRain2.width = w; canvasRain2.height = h
      this._lottieRain2 = new DotLottie({
        canvas: canvasRain2,
        src: RAIN_LOTTIE,
        loop: true,
        autoplay: true,
        renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
      })
    }

    if (canvasWind) {
      canvasWind.width = w
      canvasWind.height = Math.round(h * 0.65)
      this._lottieWind = new DotLottie({
        canvas: canvasWind,
        src: WIND_LOTTIE,
        loop: true,
        autoplay: true,
        renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
      })
    }
  }

  private updateLottie (group: string): void {
    const canvasClouds = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds')
    const canvasClouds2 = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds2')
    const canvasRain = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain')
    const canvasRain2 = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain2')
    const canvasWind = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasWind')
    if (!canvasClouds || !canvasRain) return

    const showClouds = LOTTIE_CLOUDS_GROUPS.has(group) && this.config.show_clouds
    const showRain = LOTTIE_RAIN_GROUPS.has(group) && this.config.show_clouds
    const showWind = LOTTIE_WIND_GROUPS.has(group) && this.config.show_clouds

    canvasClouds.classList.toggle('is-visible', showClouds)
    canvasClouds2?.classList.toggle('is-visible', showClouds)
    canvasRain.classList.toggle('is-visible', showRain)
    canvasRain2?.classList.toggle('is-visible', showRain)
    canvasWind?.classList.toggle('is-visible', showWind)

    // CSS filter tints the cloud canvases to match the sky mood
    const cloudFilter = CLOUD_FILTER[group] ?? 'none'
    canvasClouds.style.filter = cloudFilter
    if (canvasClouds2) canvasClouds2.style.filter = cloudFilter

    // Use actual wind_speed from weather entity when available for cloud/wind speed
    const weather = this.hass?.states?.[this.config?.entity]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wAttrs = ((weather as any)?.attributes ?? {}) as Record<string, unknown>
    const windKmh = typeof wAttrs.wind_speed === 'number' ? wAttrs.wind_speed : undefined

    // Playback speed: use real wind data or fall back to condition-based lookup
    // Row 2 runs at 72% speed for a parallax depth effect
    if (windKmh !== undefined) {
      // Scale: 0 km/h → 0.3x, 30 km/h → 1.0x, 80+ km/h → 2.5x
      const windFactor = Math.min(2.5, 0.3 + (windKmh / 30) * 0.7)
      this._lottieCloud?.setSpeed(windFactor)
      this._lottieCloud2?.setSpeed(windFactor * 0.72)
      if (showWind) this._lottieWind?.setSpeed(windFactor * 1.2)
    } else {
      const baseSpeed = CLOUD_SPEED[group] ?? 1.0
      this._lottieCloud?.setSpeed(baseSpeed)
      this._lottieCloud2?.setSpeed(baseSpeed * 0.72)
      if (showWind) this._lottieWind?.setSpeed(1.8)
    }
    const rainSpeed = RAIN_SPEED[group] ?? 1.0
    if (showRain) this._lottieRain?.setSpeed(rainSpeed)
    if (showRain) this._lottieRain2?.setSpeed(rainSpeed * 0.80)
  }

  // ── SVG scene background ────────────────────────────────────────────

  /**
   * Returns the SVG HTML string for the coastal scene background.
   * Uses the HA sun.sun entity attributes (elevation, azimuth) when
   * available to precisely position the sun/moon, plus weather entity
   * attributes for data-driven rendering.
   */
  private renderSceneBg (): string {
    try {
      const weather = this.getWeather()
      const condition = weather.state
      const period = this.getTimePeriod()
      const sun = this.getSun()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sunAttrs = (sun?.attributes ?? {}) as Record<string, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wAttrs = (weather.attributes ?? {}) as Record<string, unknown>

      const moonEntity = this.config.moon_entity
        ? this.hass.states[this.config.moon_entity]
        : undefined

      const opts: SkyOpts = {
        sunElevation: typeof sunAttrs.elevation === 'number' ? sunAttrs.elevation : undefined,
        sunAzimuth: typeof sunAttrs.azimuth === 'number' ? sunAttrs.azimuth : undefined,
        sunRising: typeof sunAttrs.rising === 'boolean' ? sunAttrs.rising : undefined,
        cloudCoverage: typeof wAttrs.cloud_coverage === 'number' ? wAttrs.cloud_coverage : undefined,
        windSpeed: typeof wAttrs.wind_speed === 'number' ? wAttrs.wind_speed : undefined,
        windGustSpeed: typeof wAttrs.wind_gust_speed === 'number' ? wAttrs.wind_gust_speed : undefined,
        visibility: typeof wAttrs.visibility === 'number' ? wAttrs.visibility : undefined,
        uvIndex: typeof wAttrs.uv_index === 'number' ? wAttrs.uv_index : undefined,
        humidity: typeof wAttrs.humidity === 'number' ? wAttrs.humidity : undefined,
        dewPoint: typeof wAttrs.dew_point === 'number' ? wAttrs.dew_point : undefined,
        pressure: typeof wAttrs.pressure === 'number' ? wAttrs.pressure : undefined,
        moonPhase: typeof moonEntity?.state === 'string' ? moonEntity.state : undefined
      }
      return buildBackground(condition, period, opts)
    } catch (_e) {
      return buildBackground('sunny', 'afternoon', {})
    }
  }

  // ── Theme ───────────────────────────────────────────────────────────────

  private getTimePeriod (): string {
    // Prefer sun.sun entity elevation for accurate period detection
    const sun = this.getSun()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attrs = (sun?.attributes ?? {}) as Record<string, unknown>
    if (typeof attrs.elevation === 'number') {
      const rising = typeof attrs.rising === 'boolean' ? attrs.rising : undefined
      return elevationToPeriod(attrs.elevation, rising).period
    }
    // Fallback to time-based detection
    const totalMinutes = this.currentDate.hour * 60 + this.currentDate.minute
    if (totalMinutes >= 1260 || totalMinutes < 330) return 'night' // 21:00–05:29
    if (totalMinutes < 450) return 'dawn' // 05:30–07:29
    if (totalMinutes < 720) return 'morning' // 07:30–11:59
    if (totalMinutes < 1020) return 'afternoon' // 12:00–16:59
    return 'dusk' // 17:00–20:59
  }

  private getConditionGroup (condition: string): string {
    return CONDITION_GROUP[condition] ?? 'cloudy'
  }

  private applyTheme (): void {
    const haCard = this.shadowRoot?.querySelector('ha-card')
    if (!haCard) return
    try {
      const state = this.getWeather().state
      const period = this.getTimePeriod()
      const group = this.getConditionGroup(state)
      haCard.setAttribute('data-theme', `${period}-${group}`)
      this.updateLottie(group)
      // Progressive gradient: interpolate continuously by sun elevation
      const sun = this.getSun()
      const attrs = (sun?.attributes ?? {}) as Record<string, unknown>
      const elev = typeof attrs.elevation === 'number' ? attrs.elevation : undefined
      const rising = typeof attrs.rising === 'boolean' ? attrs.rising : undefined
      ;(haCard as HTMLElement).style.setProperty('--widget-gradient', computeCardGradient(group, elev, rising))
    } catch (_e) {
      // Weather entity not ready yet — leave existing theme
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  protected render (): TemplateResult {
    if (this.error) {
      if (this.hass && this.config && this.hass.states[this.config.entity]) {
        this.error = undefined
        this.forecastSubscriber = undefined
        this.forecastSubscriberHourly = undefined
      } else return this.error
    }

    const showForecast = !this.config.hide_forecast_section
    const showHourlyStrip = this.config.hourly_forecast && (this.hourlyForecasts?.length ?? 0) > 0
    const showDailyStrip = showForecast && !this.config.hide_daily_section

    return html`
      <ha-card
        @action=${(e: ActionHandlerEvent) => { this.handleAction(e) }}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this.config.hold_action as ActionConfig | undefined),
          hasDoubleClick: hasAction(this.config.double_tap_action as ActionConfig | undefined)
        })}
        tabindex="0"
        .label=${`Hass Weather Card: ${this.config.entity || 'No Entity Defined'}`}
      >
        <!-- SVG coastal scene background, z-index 0 -->
        <div class="card-bg" aria-hidden="true">
          ${unsafeHTML(this.renderSceneBg())}
        </div>

        <!-- Full-card lottie BG, z-index 0 -->
        <div class="lottie-layer" aria-hidden="true">
          <canvas id="lottieCanvasClouds"></canvas>
          <canvas id="lottieCanvasClouds2"></canvas>
          <canvas id="lottieCanvasRain"></canvas>
          <canvas id="lottieCanvasRain2"></canvas>
          <canvas id="lottieCanvasWind"></canvas>
        </div>

        <!-- All text content, z-index 2 -->
        <div class="card-body" style="padding: ${this.config.card_padding}px">
          ${this.config.hide_today_section ? '' : safeRender(() => this.renderHero())}
          ${(showDailyStrip || showHourlyStrip)
            ? html`
            <div class="forecast-section">
              ${showHourlyStrip ? safeRender(() => this.renderHourlyStrip()) : ''}
              ${showDailyStrip ? safeRender(() => this.renderDailyStrip()) : ''}
            </div>
          `
            : ''}
        </div>
      </ha-card>
    `
  }

  public connectedCallback (): void {
    super.connectedCallback()
    if (!this.currentDateInterval) {
      this.currentDate = DateTime.now()
      const msToNextSecond = 1000 - this.currentDate.millisecond
      setTimeout(() => {
        this.currentDate = DateTime.now()
        this.currentDateInterval = setInterval(() => { this.currentDate = DateTime.now() }, 1000)
      }, msToNextSecond)
    }
    if (this.hasUpdated) {
      void this.subscribeForecastEvents()
    }
  }

  public disconnectedCallback (): void {
    super.disconnectedCallback()
    if (this.currentDateInterval) {
      clearInterval(this.currentDateInterval)
      this.currentDateInterval = undefined
    }
    void this.unsubscribeForecastEvents()
    this._lottieCloud?.destroy()
    this._lottieCloud2?.destroy()
    this._lottieRain?.destroy()
    this._lottieRain2?.destroy()
    this._lottieWind?.destroy()
  }

  protected willUpdate (changedProps: PropertyValues): void {
    super.willUpdate(changedProps)
    if (!this.forecastSubscriber && !this.forecastSubscriberHourly) {
      void this.subscribeForecastEvents()
    }
  }

  // ── Hero (temp + condition/time row) ────────────────────────────────────

  private renderHero (): TemplateResult {
    const weather = this.getWeather()
    const temp = this.config.show_decimal
      ? this.getCurrentTemperature()
      : roundIfNotNull(this.getCurrentTemperature())
    const tempUnit = weather.attributes.temperature_unit
    const weatherString = this.localize(`weather.${weather.state}`)
    const localizedTemp = temp !== null ? this.toConfiguredTempWithUnit(tempUnit, temp) : 'n/a'
    const subSize = `${this.config.sub_font_size}rem`
    const iconType = this.config.weather_icon_type
    const icon = this.toIcon(weather.state, iconType, false, this.getIconAnimationKind())
    const iconPx = `${this.config.icon_size}px`

    const isTimeHero = this.config.hero_display === 'time'
    const showClock = !this.config.hide_clock

    const heroMain = (isTimeHero && showClock) ? this.time() : localizedTemp
    const metaSub = (isTimeHero && showClock) ? localizedTemp : (showClock ? this.time() : null)

    const humidity = this.config.show_humidity ? this.getCurrentHumidity() : null
    const apparent = this.getApparentTemperature()

    // Temp in icon-block: degree symbol only, no unit letter (e.g. "23°")
    const convertedTemp = temp !== null ? this.toConfiguredTempWithoutUnit(tempUnit, temp) : null
    const tempDegree = convertedTemp !== null ? `${convertedTemp}°` : ''

    // What shows in the icon-block meta row (primary value)
    const iconMetaMain = isTimeHero ? tempDegree : (metaSub ?? '')

    return html`
      <div class="hero">
        <div class="hero-main-row">
          <div class="hero-left">
            <p class="temp">${heroMain}</p>
            <span class="condition" style="font-size:${subSize}">${weatherString}</span>
            ${!this.config.hide_date ? html`<span class="hero-date">${this.date()}</span>` : ''}
          </div>
          <div class="hero-icon-block">
            <img class="icon-main" style="width:${iconPx};height:${iconPx}" src=${icon} />
            <div class="hero-icon-meta">
              <span class="hero-temp-inline" style="font-size:${subSize}">${iconMetaMain}</span>
              ${humidity !== null ? html`<span class="hero-temp-inline" style="font-size:${subSize}">| ${humidity}%</span>` : ''}
            </div>
          </div>
        </div>
        ${apparent !== null ? html`<span class="hero-meta">${this.localize('ui.card.weather.attributes.apparent_temperature')}: ${this.toConfiguredTempWithUnit(tempUnit, apparent)}</span>` : ''}
      </div>
    `
  }

  // ── V1-style forecast strips ─────────────────────────────────────────────

  private renderHourlyStrip (): TemplateResult {
    const cols = this.config.hourly_forecast_columns
    const items = this.mergeForecasts(cols, true, this.hourlyForecasts ?? [])
    const iconBase = 38
    const iconSz = Math.round(iconBase * (this.config.hourly_forecast_size / 100))
    return html`
      <div class="forecast-hourly" style="--hourly-time-font-size: ${this.config.hourly_time_font_size}rem; padding-top: ${this.config.hourly_padding}px; padding-bottom: ${this.config.hourly_padding}px">
        ${items.map(f => safeRender(() => {
          const icon = this.toIcon(f.condition, this.config.weather_icon_type, false, this.getIconAnimationKind())
          const timeLabel = this.toZonedDate(f.datetime).toFormat('h a')
          const precip = f.precipitation_probability != null && f.precipitation_probability > 0
            ? html`<span class="hour-slot__precip">${Math.round(f.precipitation_probability)}%</span>`
            : ''
          const hourHumid = this.config.show_humidity_hourly && f.humidity != null
            ? html`<span class="hour-slot__humid">${Math.round(f.humidity)}%</span>`
            : ''
          const hourTemp = this.config.show_hourly_temp
            ? html`<span class="hour-slot__temp">${this.toConfiguredTempWithUnit(this.getWeather().attributes.temperature_unit, Math.round(f.temperature))}</span>`
            : ''
          return html`
            <div class="hour-slot">
              <img class="hour-slot__icon" style="width:${iconSz}px;height:${iconSz}px" src=${icon} alt="" />
              ${hourTemp}
              <span class="hour-slot__time">${timeLabel}</span>
              ${precip}
              ${hourHumid}
            </div>
          `
        }))}
      </div>
    `
  }

  private renderDailyStrip (): TemplateResult {
    const cols = this.config.day_forecast_columns
    const now = this.toZonedDate(this.currentDate)
    const tomorrowStart = now.startOf('day').plus({ days: 1 })
    const allItems = this.mergeForecasts(cols + 3, false)
    const items = allItems.filter(f => f.datetime >= tomorrowStart).slice(0, cols)
    const entityTempUnit = this.getWeather().attributes.temperature_unit
    const isLong = this.config.day_name_format === 'long'
    const iconBase = 36
    const iconSz = Math.round(iconBase * (this.config.daily_forecast_size / 100))
    return html`
      <div class="forecast-daily" style="--daily-cols: ${items.length}">
        ${items.map(f => safeRender(() => {
          const icon = this.toIcon(f.condition, this.config.weather_icon_type, true, 'static')
          const temp = `${this.toConfiguredTempWithoutUnit(entityTempUnit, Math.round(f.temperature))}°`
          const day = isLong
            ? f.datetime.setLocale(this.getLocale()).toFormat('cccc')
            : this.localize(`day.${f.datetime.weekday}`)
          return html`
            <div class="forecast-slot">
              <img class="forecast-slot__icon" style="width:${iconSz}px;height:${iconSz}px" src=${icon} alt="" />
              ${this.config.show_daily_temp ? html`<span class="forecast-slot__temp">${temp}</span>` : ''}
              ${this.config.show_humidity_daily && f.humidity != null ? html`<span class="forecast-slot__humid">${Math.round(f.humidity)}%</span>` : ''}
              <span class="forecast-slot__day">${day}</span>
            </div>
          `
        }))}
      </div>
    `
  }

  // https://lit.dev/docs/components/styles/
  static get styles (): CSSResultGroup {
    return styles
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private handleAction (ev: ActionHandlerEvent): void {
    if (this.hass && this.config && ev.detail.action) {
      handleAction(this, this.hass, this.config, ev.detail.action)
    }
  }

  private mergeConfig (config: ClockWeatherCardConfig): MergedClockWeatherCardConfig {
    return {
      ...config,
      sun_entity: config.sun_entity ?? 'sun.sun',
      moon_entity: config.moon_entity ?? undefined,
      climate_entity: config.climate_entity ?? undefined,
      temperature_sensor: config.temperature_sensor,
      humidity_sensor: config.humidity_sensor,
      weather_icon_type: config.weather_icon_type ?? 'line',
      day_forecast_columns: config.day_forecast_columns ?? 5,
      hourly_forecast_columns: config.hourly_forecast_columns ?? 4,
      hourly_forecast: config.hourly_forecast ?? false,
      animated_icon: config.animated_icon ?? true,
      time_format: config.time_format?.toString() as '12' | '24' | undefined ?? '12',
      time_pattern: config.time_pattern ?? 'h:mm',
      show_humidity: config.show_humidity ?? false,
      hide_forecast_section: config.hide_forecast_section ?? false,
      hide_today_section: config.hide_today_section ?? false,
      hide_clock: config.hide_clock ?? false,
      hide_date: config.hide_date ?? false,
      date_pattern: config.date_pattern ?? 'D',
      use_browser_time: config.use_browser_time ?? false,
      time_zone: config.time_zone ?? undefined,
      show_decimal: config.show_decimal ?? false,
      apparent_sensor: config.apparent_sensor ?? undefined,
      aqi_sensor: config.aqi_sensor ?? undefined,
      hero_display: config.hero_display ?? 'time',
      sub_font_size: config.sub_font_size ?? 1.3,
      icon_size: config.icon_size ?? 48,
      hero_gap: config.hero_gap ?? 8,
      day_name_format: config.day_name_format ?? 'short',
      daily_forecast_size: config.daily_forecast_size ?? 100,
      hourly_forecast_size: config.hourly_forecast_size ?? 100,
      card_padding: config.card_padding ?? 4,
      hourly_padding: config.hourly_padding ?? 6,
      hourly_time_font_size: config.hourly_time_font_size ?? 0.65,
      hide_daily_section: config.hide_daily_section ?? false,
      show_daily_temp: config.show_daily_temp ?? true,
      show_hourly_temp: config.show_hourly_temp ?? false,
      show_clouds: config.show_clouds ?? true,
      show_humidity_daily: config.show_humidity_daily ?? false,
      show_humidity_hourly: config.show_humidity_hourly ?? false
    }
  }

  private toIcon (weatherState: string, type: 'fill' | 'line', forceDay: boolean, kind: 'static' | 'animated'): string {
    const daytime = forceDay ? 'day' : this.getSun()?.state === 'below_horizon' ? 'night' : 'day'
    const iconMap = kind === 'animated' ? animatedIcons : staticIcons
    const icon = iconMap[type][weatherState] ?? iconMap[type].cloudy
    return icon?.[daytime] ?? icon ?? ''
  }

  private getWeather (): Weather {
    const weather = this.hass.states[this.config.entity] as Weather | undefined
    if (!weather) {
      throw this.createError(`Weather entity "${this.config.entity}" could not be found.`)
    }
    return weather
  }

  private getCurrentTemperature (): number | null {
    if (this.config.temperature_sensor) {
      const temperatureSensor = this.hass.states[this.config.temperature_sensor] as TemperatureSensor | undefined
      const temp = temperatureSensor?.state ? parseFloat(temperatureSensor.state) : undefined
      const unit = temperatureSensor?.attributes.unit_of_measurement ?? this.getConfiguredTemperatureUnit()
      if (temp !== undefined && !isNaN(temp)) {
        return this.toConfiguredTempWithoutUnit(unit, temp)
      }
    }
    return this.getWeather().attributes.temperature ?? null
  }

  private getCurrentHumidity (): number | null {
    if (this.config.humidity_sensor) {
      const humiditySensor = this.hass.states[this.config.humidity_sensor] as HumiditySensor | undefined
      const humid = humiditySensor?.state ? parseFloat(humiditySensor.state) : undefined
      if (humid !== undefined && !isNaN(humid)) {
        return humid
      }
    }
    return this.getWeather().attributes.humidity ?? null
  }

  private getApparentTemperature (): number | null {
    if (this.config.apparent_sensor) {
      const apparentSensor = this.hass.states[this.config.apparent_sensor] as TemperatureSensor | undefined
      const temp = apparentSensor?.state ? parseFloat(apparentSensor.state) : undefined
      const unit = apparentSensor?.attributes.unit_of_measurement ?? this.getConfiguredTemperatureUnit()
      if (temp !== undefined && !isNaN(temp)) {
        return this.toConfiguredTempWithoutUnit(unit, temp)
      }
    }
    return null
  }

  private getAqi (): number | null {
    if (this.config.aqi_sensor) {
      const aqiSensor = this.hass.states[this.config.aqi_sensor] as HassEntity | undefined
      const aqi = aqiSensor?.state ? parseInt(aqiSensor.state) : undefined
      if (aqi !== undefined && !isNaN(aqi)) {
        return aqi
      }
    }
    return null
  }

  private getSun (): HassEntityBase | undefined {
    return this.hass.states[this.config.sun_entity]
  }

  private getLocale (): string {
    return this.config.locale ?? this.hass?.locale?.language ?? 'en-GB'
  }

  private date (): string {
    return this.toZonedDate(this.currentDate).toFormat(this.config.date_pattern)
  }

  private time (date: DateTime = this.currentDate): string {
    if (this.config.time_pattern) {
      return this.toZonedDate(date).toFormat(this.config.time_pattern)
    }
    if (this.config.time_format) {
      return this.toZonedDate(date).toFormat(this.config.time_format === '24' ? 'HH:mm' : 'h:mm a')
    }
    if (this.hass.locale.time_format === TimeFormat.am_pm) {
      return this.toZonedDate(date).toFormat('h:mm a')
    }
    if (this.hass.locale.time_format === TimeFormat.twenty_four) {
      return this.toZonedDate(date).toFormat('HH:mm')
    }
    return this.toZonedDate(date).toFormat('t')
  }

  private getIconAnimationKind (): 'static' | 'animated' {
    return this.config.animated_icon ? 'animated' : 'static'
  }

  private toCelsius (temperatueUnit: TemperatureUnit, temperature: number): number {
    return temperatueUnit === '°C' ? temperature : Math.round((temperature - 32) * (5 / 9))
  }

  private toFahrenheit (temperatueUnit: TemperatureUnit, temperature: number): number {
    return temperatueUnit === '°F' ? temperature : Math.round((temperature * 9 / 5) + 32)
  }

  private getConfiguredTemperatureUnit (): TemperatureUnit {
    return (this.hass?.config?.unit_system?.temperature ?? '°C') as TemperatureUnit
  }

  private toConfiguredTempWithUnit (unit: TemperatureUnit, temp: number): string {
    const convertedTemp = this.toConfiguredTempWithoutUnit(unit, temp)
    return convertedTemp + this.getConfiguredTemperatureUnit()
  }

  private toConfiguredTempWithoutUnit (unit: TemperatureUnit, temp: number): number {
    const configuredUnit = this.getConfiguredTemperatureUnit()
    if (configuredUnit === unit) {
      return temp
    }
    return unit === '°C'
      ? this.toFahrenheit(unit, temp)
      : this.toCelsius(unit, temp)
  }

  private localize (key: string): string {
    return localize(key, this.getLocale())
  }

  private mergeForecasts (maxRowsCount: number, hourly: boolean, source?: WeatherForecast[]): MergedWeatherForecast[] {
    const forecasts = source ??
      (this.isLegacyWeather()
        ? this.getWeather().attributes.forecast ?? []
        : this.forecasts ?? [])

    const agg = forecasts.reduce<Record<number, WeatherForecast[]>>((acc, forecast) => {
      const d = new Date(forecast.datetime)
      const unit = hourly ? `${d.getMonth()}-${d.getDate()}-${+d.getHours()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      acc[unit] = acc[unit] || []
      acc[unit].push(forecast)
      return acc
    }, {})

    return Object.values(agg)
      .reduce((agg: MergedWeatherForecast[], forecasts) => {
        if (forecasts.length === 0) return agg
        agg.push(this.calculateAverageForecast(forecasts))
        return agg
      }, [])
      .sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis())
      .slice(0, maxRowsCount)
  }

  private toZonedDate (date: DateTime): DateTime {
    const localizedDate = date.setLocale(this.getLocale())
    if (this.config.use_browser_time) return localizedDate
    const timeZone = this.config.time_zone ?? this.hass?.config?.time_zone
    const withTimeZone = localizedDate.setZone(timeZone)
    if (withTimeZone.isValid) {
      return withTimeZone
    }
    console.error(`hass-weather-card - Time Zone [${timeZone}] not supported. Falling back to browser time.`)
    return localizedDate
  }

  private calculateAverageForecast (forecasts: WeatherForecast[]): MergedWeatherForecast {
    const minTemps = forecasts.map((f) => f.templow ?? f.temperature ?? this.getCurrentTemperature() ?? 0)
    const minTemp = min(minTemps)
    const maxTemps = forecasts.map((f) => f.temperature ?? this.getCurrentTemperature() ?? 0)
    const maxTemp = max(maxTemps)
    const precipitationProbabilities = forecasts.map((f) => f.precipitation_probability ?? 0)
    const precipitations = forecasts.map((f) => f.precipitation ?? 0)
    const humidities = forecasts.map((f) => f.humidity).filter((h): h is number => h != null)
    const avgHumidity = humidities.length > 0 ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null
    const conditions = forecasts.map((f) => f.condition)

    return {
      temperature: maxTemp,
      templow: minTemp,
      datetime: this.parseDateTime(forecasts[0].datetime),
      condition: extractMostOccuring(conditions),
      precipitation_probability: max(precipitationProbabilities),
      precipitation: max(precipitations),
      humidity: avgHumidity
    }
  }

  private async subscribeForecastEvents (): Promise<void> {
    if (this.forecastSubscriberLock) return
    this.forecastSubscriberLock = true
    await this.unsubscribeForecastEvents()
    if (this.isLegacyWeather()) {
      this.forecastSubscriber = async () => {}
      this.forecastSubscriberLock = false
      return
    }
    if (!this.isConnected || !this.config || !this.hass) {
      this.forecastSubscriberLock = false
      return
    }

    const supportsDaily = this.supportsFeature(WeatherEntityFeature.FORECAST_DAILY)
    const supportsHourly = this.supportsFeature(WeatherEntityFeature.FORECAST_HOURLY)
    // Use daily when available; fall back to hourly-only entities
    const primaryType: 'daily' | 'hourly' = supportsDaily ? 'daily' : 'hourly'
    const options = { resubscribe: false }
    try {
      const dailyCallback = (event: WeatherForecastEvent): void => { this.forecasts = event.forecast ?? [] }
      this.forecastSubscriber = await this.hass.connection.subscribeMessage<WeatherForecastEvent>(
        dailyCallback,
        { type: 'weather/subscribe_forecast', forecast_type: primaryType, entity_id: this.config.entity },
        options
      )
      // Subscribe to hourly separately when entity supports both and user enabled it
      if (supportsDaily && supportsHourly && this.config.hourly_forecast) {
        try {
          const hourlyCallback = (event: WeatherForecastEvent): void => { this.hourlyForecasts = event.forecast ?? [] }
          this.forecastSubscriberHourly = await this.hass.connection.subscribeMessage<WeatherForecastEvent>(
            hourlyCallback,
            { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: this.config.entity },
            options
          )
        } catch (e: unknown) {
          console.error('hass-weather-card - Error subscribing to hourly forecast (daily still active)', e)
        }
      }
    } catch (e: unknown) {
      console.error('hass-weather-card - Error subscribing to weather forecast', e)
    } finally {
      this.forecastSubscriberLock = false
    }
  }

  private async unsubscribeForecastEvents (): Promise<void> {
    const unsubs: Array<Promise<void>> = []
    if (this.forecastSubscriber) {
      unsubs.push(this.forecastSubscriber().catch(() => {}))
      this.forecastSubscriber = undefined
    }
    if (this.forecastSubscriberHourly) {
      unsubs.push(this.forecastSubscriberHourly().catch(() => {}))
      this.forecastSubscriberHourly = undefined
    }
    await Promise.all(unsubs)
  }

  private isLegacyWeather (): boolean {
    return !this.supportsFeature(WeatherEntityFeature.FORECAST_DAILY) && !this.supportsFeature(WeatherEntityFeature.FORECAST_HOURLY)
  }

  private supportsFeature (feature: WeatherEntityFeature): boolean {
    if (!this.hass || !this.config || !this.hass.states[this.config.entity]) return false
    try {
      return (this.getWeather().attributes.supported_features & feature) !== 0
    } catch (_e) {
      return false
    }
  }

  private createError (errorString: string): Error {
    const error = new Error(errorString)
    const errorCard = document.createElement('hui-error-card')
    errorCard.setConfig({ type: 'error', error, origConfig: this.config })
    this.error = html`${errorCard}`
    return error
  }

  private parseDateTime (date: string): DateTime {
    const fromIso = DateTime.fromISO(date)
    if (fromIso.isValid) return fromIso
    const fromJs = DateTime.fromJSDate(new Date(date))
    if (fromJs.isValid) return fromJs
    console.error(`hass-weather-card - Could not parse datetime: "${date}"`)
    return DateTime.now()
  }
}
