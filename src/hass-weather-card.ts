import { LitElement, html, type TemplateResult, type PropertyValues, type CSSResultGroup } from 'lit'
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
  Rgb,
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
import { CLOUDS_LOTTIE, RAIN_LOTTIE } from './lottie-assets'

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
  'clear-night':     'sunny',
  'sunny':           'sunny',
  'partlycloudy':    'partly-cloudy',
  'cloudy':          'cloudy',
  'windy':           'cloudy',
  'windy-variant':   'cloudy',
  'fog':             'foggy',
  'rainy':           'rainy',
  'lightning-rainy': 'rainy',
  'hail':            'rainy',
  'snowy-rainy':     'rainy',
  'pouring':         'pouring',
  'lightning':       'stormy',
  'snowy':           'snowy',
  'exceptional':     'cloudy',
}

// Condition groups that trigger cloud / rain lottie layers
const LOTTIE_CLOUDS_GROUPS = new Set(['sunny', 'partly-cloudy', 'cloudy', 'foggy', 'snowy'])
const LOTTIE_RAIN_GROUPS   = new Set(['rainy', 'pouring', 'stormy'])

const gradientMap: Map<number, Rgb> = new Map()
  .set(-20, new Rgb(0, 60, 98))
  .set(-10, new Rgb(120, 162, 204))
  .set(0, new Rgb(164, 195, 210))
  .set(10, new Rgb(121, 210, 179))
  .set(20, new Rgb(252, 245, 112))
  .set(30, new Rgb(255, 150, 79))
  .set(40, new Rgb(255, 192, 159))

@customElement('hass-weather-card')
export class HassWeatherCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant

  @state() private config!: MergedClockWeatherCardConfig
  @state() private currentDate!: DateTime
  @state() private forecasts?: WeatherForecast[]
  @state() private error?: TemplateResult
  private forecastSubscriber?: () => Promise<void>
  private forecastSubscriberLock = false
  private _lottieCloud?: DotLottie
  private _lottieRain?: DotLottie

  constructor () {
    super()
    this.currentDate = DateTime.now()
    const msToNextSecond = (1000 - this.currentDate.millisecond)
    setTimeout(() => setInterval(() => { this.currentDate = DateTime.now() }, 1000), msToNextSecond)
    setTimeout(() => { this.currentDate = DateTime.now() }, msToNextSecond)
  }

  public static getStubConfig (_hass: HomeAssistant, entities: string[], entitiesFallback: string[]): Record<string, unknown> {
    const entity = entities.find(e => e.startsWith('weather.') ?? entitiesFallback.find(() => true))
    if (entity) {
      return { entity }
    }
    return {}
  }

  public getCardSize (): number {
    return 3 + roundUp(this.config.forecast_rows / 2)
  }

  public setConfig (config?: ClockWeatherCardConfig): void {
    if (!config) {
      throw this.createError('Invalid configuration.')
    }
    if (!config.entity) {
      throw this.createError('Attribute "entity" must be present.')
    }
    if (config.forecast_rows && config.forecast_rows < 1) {
      throw this.createError('Attribute "forecast_rows" must be greater than 0.')
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
    if (changedProps.has('forecasts')) {
      return true
    }
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined
    if (oldHass) {
      const oldSun = oldHass.states[this.config.sun_entity]
      const newSun = this.hass.states[this.config.sun_entity]
      if (oldSun !== newSun) {
        return true
      }
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
    const card = this.shadowRoot?.querySelector('.card-body')
    const canvasClouds = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds')
    const canvasRain   = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain')
    if (!canvasClouds || !canvasRain || !card) return

    // Set canvas drawing buffer to full card dimensions
    const w = card.clientWidth  || 460
    const h = card.clientHeight || 560
    canvasClouds.width  = w; canvasClouds.height  = h
    canvasRain.width    = w; canvasRain.height    = h

    this._lottieCloud = new DotLottie({
      canvas:   canvasClouds,
      src:      CLOUDS_LOTTIE,
      loop:     true,
      autoplay: true,
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2 }
    })

    this._lottieRain = new DotLottie({
      canvas:   canvasRain,
      src:      RAIN_LOTTIE,
      loop:     true,
      autoplay: true,
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2 }
    })
  }

  private updateLottie (group: string): void {
    const canvasClouds = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasClouds')
    const canvasRain   = this.shadowRoot?.querySelector<HTMLCanvasElement>('#lottieCanvasRain')
    if (!canvasClouds || !canvasRain) return
    canvasClouds.classList.toggle('is-visible', LOTTIE_CLOUDS_GROUPS.has(group))
    canvasRain.classList.toggle('is-visible',   LOTTIE_RAIN_GROUPS.has(group))
  }

  // ── Theme ───────────────────────────────────────────────────────────────

  private getTimePeriod (): string {
    const totalMinutes = this.currentDate.hour * 60 + this.currentDate.minute
    if (totalMinutes >= 1260 || totalMinutes < 330) return 'night'     // 21:00–05:29
    if (totalMinutes < 450)  return 'dawn'       // 05:30–07:29
    if (totalMinutes < 720)  return 'morning'    // 07:30–11:59
    if (totalMinutes < 1020) return 'afternoon'  // 12:00–16:59
    return 'dusk'                                // 17:00–20:59
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
      const group  = this.getConditionGroup(state)
      haCard.setAttribute('data-theme', `${period}-${group}`)
      this.updateLottie(group)
    } catch (_e) {
      // Weather entity not ready yet — leave existing theme
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  protected render (): TemplateResult {
    if (this.error) {
      return this.error
    }

    const showForecast = !this.config.hide_forecast_section

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
        <!-- Full-card lottie BG, z-index 0 -->
        <div class="lottie-layer" aria-hidden="true">
          <canvas id="lottieCanvasClouds"></canvas>
          <canvas id="lottieCanvasRain"></canvas>
        </div>

        <!-- Corner bleed icon, z-index 3 -->
        <div class="bg-icon">
          ${safeRender(() => this.renderBgIcon())}
        </div>

        <!-- All text content, z-index 2 -->
        <div class="card-body">
          ${safeRender(() => this.renderHero())}
          ${showForecast
            ? html`<div class="forecast-section">${this.renderForecast()}</div>`
            : ''}
        </div>
      </ha-card>
    `
  }

  public connectedCallback (): void {
    super.connectedCallback()
    if (this.hasUpdated) {
      void this.subscribeForecastEvents()
    }
  }

  public disconnectedCallback (): void {
    super.disconnectedCallback()
    void this.unsubscribeForecastEvents()
    this._lottieCloud?.destroy()
    this._lottieRain?.destroy()
  }

  protected willUpdate (changedProps: PropertyValues): void {
    super.willUpdate(changedProps)
    if (!this.forecastSubscriber) {
      void this.subscribeForecastEvents()
    }
  }

  // ── Hero (temp + condition/time row) ────────────────────────────────────

  private renderBgIcon (): TemplateResult {
    const weather  = this.getWeather()
    const icon     = this.toIcon(weather.state, 'line', false, this.getIconAnimationKind())
    return html`<img class="icon-main" src=${icon} />`
  }

  private renderHero (): TemplateResult {
    const weather        = this.getWeather()
    const temp           = this.config.show_decimal
      ? this.getCurrentTemperature()
      : roundIfNotNull(this.getCurrentTemperature())
    const tempUnit       = weather.attributes.temperature_unit
    const weatherString  = this.localize(`weather.${weather.state}`)
    const localizedTemp  = temp !== null ? this.toConfiguredTempWithUnit(tempUnit, temp) : 'n/a'

    return html`
      <div class="hero">
        <p class="temp">${localizedTemp}</p>
        <div class="meta-row">
          <span class="condition">${weatherString}</span>
          <span class="current-time">${this.time()}</span>
        </div>
      </div>
    `
  }

  // ── Forecast rows (unchanged logic, restyled) ────────────────────────────

  private renderForecast (): TemplateResult[] {
    const weather = this.getWeather()
    const currentTemp = roundIfNotNull(this.getCurrentTemperature())
    const maxRowsCount = this.config.forecast_rows
    const hourly = this.config.hourly_forecast
    const temperatureUnit = weather.attributes.temperature_unit

    const forecasts = this.mergeForecasts(maxRowsCount, hourly)

    const minTemps = forecasts.map((f) => f.templow)
    const maxTemps = forecasts.map((f) => f.temperature)
    if (currentTemp !== null) {
      minTemps.push(currentTemp)
      maxTemps.push(currentTemp)
    }
    const minTemp = Math.round(min(minTemps))
    const maxTemp = Math.round(max(maxTemps))

    const displayTexts = forecasts
      .map(f => f.datetime)
      .map(d => hourly ? this.time(d) : this.localize(`day.${d.weekday}`))
    const maxColOneChars = displayTexts.length ? max(displayTexts.map(t => t.length)) : 0

    return forecasts.map((forecast, i) => safeRender(() =>
      this.renderForecastItem(forecast, minTemp, maxTemp, currentTemp, temperatureUnit, hourly, displayTexts[i], maxColOneChars)
    ))
  }

  private renderForecastItem (
    forecast: MergedWeatherForecast, minTemp: number, maxTemp: number,
    currentTemp: number | null, temperatureUnit: TemperatureUnit,
    hourly: boolean, displayText: string, maxColOneChars: number
  ): TemplateResult {
    const weatherState = forecast.condition === 'pouring' ? 'raindrops'
      : forecast.condition === 'rainy' ? 'raindrop' : forecast.condition
    const weatherIcon = this.toIcon(weatherState, 'line', true, 'static')
    const tempUnit = this.getWeather().attributes.temperature_unit
    const isNow = hourly ? DateTime.now().hour === forecast.datetime.hour : DateTime.now().day === forecast.datetime.day
    const minTempDay = Math.round(isNow && currentTemp !== null ? Math.min(currentTemp, forecast.templow) : forecast.templow)
    const maxTempDay = Math.round(isNow && currentTemp !== null ? Math.max(currentTemp, forecast.temperature) : forecast.temperature)

    return html`
      <clock-weather-card-forecast-row style="--col-one-size: ${(maxColOneChars * 0.5)}rem;">
        ${this.renderText(displayText)}
        ${this.renderIcon(weatherIcon)}
        ${this.renderText(this.toConfiguredTempWithUnit(tempUnit, minTempDay), 'right')}
        ${this.renderForecastTemperatureBar(minTemp, maxTemp, minTempDay, maxTempDay, isNow, currentTemp, temperatureUnit)}
        ${this.renderText(this.toConfiguredTempWithUnit(tempUnit, maxTempDay))}
      </clock-weather-card-forecast-row>
    `
  }

  private renderText (text: string, textAlign: 'left' | 'center' | 'right' = 'left'): TemplateResult {
    return html`<forecast-text style="--text-align: ${textAlign};">${text}</forecast-text>`
  }

  private renderIcon (src: string): TemplateResult {
    return html`<forecast-icon><img class="grow-img" src=${src} /></forecast-icon>`
  }

  private renderForecastTemperatureBar (
    minTemp: number, maxTemp: number, minTempDay: number, maxTempDay: number,
    isNow: boolean, currentTemp: number | null, temperatureUnit: TemperatureUnit
  ): TemplateResult {
    const { startPercent, endPercent } = this.calculateBarRangePercents(minTemp, maxTemp, minTempDay, maxTempDay)
    const moveRight = maxTemp === minTemp ? 0 : (minTempDay - minTemp) / (maxTemp - minTemp)
    return html`
      <forecast-temperature-bar>
        <forecast-temperature-bar-background></forecast-temperature-bar-background>
        <forecast-temperature-bar-range
          style="--move-right: ${moveRight.toFixed(2)}; --start-percent: ${startPercent.toFixed(2)}%; --end-percent: ${endPercent.toFixed(2)}%; --gradient: ${this.createGradientString(minTempDay, maxTempDay, temperatureUnit)};"
        >
          ${isNow ? this.renderForecastCurrentTemp(minTempDay, maxTempDay, currentTemp) : ''}
        </forecast-temperature-bar-range>
      </forecast-temperature-bar>
    `
  }

  private renderForecastCurrentTemp (minTempDay: number, maxTempDay: number, currentTemp: number | null): TemplateResult {
    if (currentTemp == null) return html``
    const indicatorPosition = minTempDay === maxTempDay ? 0 : (100 / (maxTempDay - minTempDay)) * (currentTemp - minTempDay)
    const steps = maxTempDay - minTempDay
    const moveRight = maxTempDay === minTempDay ? 0 : (currentTemp - minTempDay) / steps
    return html`
      <forecast-temperature-bar-current-indicator style="--position: ${indicatorPosition}%;">
        <forecast-temperature-bar-current-indicator-dot style="--move-right: ${moveRight}">
        </forecast-temperature-bar-current-indicator-dot>
      </forecast-temperature-bar-current-indicator>
    `
  }

  // https://lit.dev/docs/components/styles/
  static get styles (): CSSResultGroup {
    return styles
  }

  // ── Private helpers (preserved from upstream) ───────────────────────────

  private createGradientString (minTempDay: number, maxTempDay: number, temperatureUnit: TemperatureUnit): string {
    function linearizeColor (temp: number, [tempLeft, colorLeft]: [number, Rgb], [tempRight, colorRight]: [number, Rgb]): Rgb {
      const ratio = Math.max(Math.min((temp - tempLeft) / (tempRight - tempLeft), 100.0), 0.0)
      return new Rgb(
        Math.round(colorLeft.r + ratio * (colorRight.r - colorLeft.r)),
        Math.round(colorLeft.g + ratio * (colorRight.g - colorLeft.g)),
        Math.round(colorLeft.b + ratio * (colorRight.b - colorLeft.b))
      )
    }

    const minTempDayCelsius = this.toCelsius(temperatureUnit, minTempDay)
    const maxTempDayCelsius = this.toCelsius(temperatureUnit, maxTempDay)

    const outputGradient = ([...gradientMap.entries()]
      .reduce((gradient, [temp, color], index, arr) => {
        if (index === 0) {
          if (temp > minTempDayCelsius) {
            gradient.set(0.0, color)
            gradient.set((temp - minTempDayCelsius) / (maxTempDayCelsius - minTempDayCelsius), color)
          }
        } else if (temp < minTempDayCelsius) {
          // skip
        } else if (!gradient.has(0.0)) {
          gradient.set(0.0, linearizeColor(minTempDayCelsius, arr[index - 1], [temp, color]))
          if (temp > maxTempDayCelsius) {
            gradient.set(1.0, linearizeColor(maxTempDayCelsius, arr[index - 1], [temp, color]))
          } else {
            gradient.set((temp - minTempDayCelsius) / (maxTempDayCelsius - minTempDayCelsius), color)
          }
        } else if (temp < maxTempDayCelsius) {
          gradient.set((temp - minTempDayCelsius) / (maxTempDayCelsius - minTempDayCelsius), color)
        } else if (!gradient.has(1.0)) {
          if (temp > maxTempDayCelsius) {
            gradient.set(1.0, linearizeColor(maxTempDayCelsius, arr[index - 1], [temp, color]))
          } else {
            gradient.set(1.0, color)
          }
        }
        return gradient
      }, new Map<number, Rgb>())
    )

    if (!outputGradient.has(1.0)) {
      outputGradient.set(1.0, Array.from(outputGradient.values()).slice(-1)[0])
    }

    return ([...outputGradient.entries()]
      .map(([pos, color]) => `${color.toRgbString()} ${Math.round(pos * 100.0)}%`)
      .join(', ')
    )
  }

  private handleAction (ev: ActionHandlerEvent): void {
    if (this.hass && this.config && ev.detail.action) {
      handleAction(this, this.hass, this.config, ev.detail.action)
    }
  }

  private mergeConfig (config: ClockWeatherCardConfig): MergedClockWeatherCardConfig {
    return {
      ...config,
      sun_entity: config.sun_entity ?? 'sun.sun',
      temperature_sensor: config.temperature_sensor,
      humidity_sensor: config.humidity_sensor,
      weather_icon_type: config.weather_icon_type ?? 'line',
      forecast_rows: config.forecast_rows ?? 5,
      hourly_forecast: config.hourly_forecast ?? false,
      animated_icon: config.animated_icon ?? true,
      time_format: config.time_format?.toString() as '12' | '24' | undefined,
      time_pattern: config.time_pattern ?? undefined,
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
      aqi_sensor: config.aqi_sensor ?? undefined
    }
  }

  private toIcon (weatherState: string, type: 'fill' | 'line', forceDay: boolean, kind: 'static' | 'animated'): string {
    const daytime = forceDay ? 'day' : this.getSun()?.state === 'below_horizon' ? 'night' : 'day'
    const iconMap = kind === 'animated' ? animatedIcons : staticIcons
    const icon = iconMap[type][weatherState]
    return icon?.[daytime] || icon
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
    return this.config.locale ?? this.hass.locale.language ?? 'en-GB'
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
    return this.hass.config.unit_system.temperature as TemperatureUnit
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

  private calculateBarRangePercents (minTemp: number, maxTemp: number, minTempDay: number, maxTempDay: number): { startPercent: number, endPercent: number } {
    if (maxTemp === minTemp) {
      return { startPercent: 0, endPercent: 100 }
    }
    const startPercent = (100 / (maxTemp - minTemp)) * (minTempDay - minTemp)
    const endPercent   = (100 / (maxTemp - minTemp)) * (maxTempDay - minTemp)
    return {
      startPercent: Math.max(0, startPercent),
      endPercent:   Math.min(100, endPercent)
    }
  }

  private localize (key: string): string {
    return localize(key, this.getLocale())
  }

  private mergeForecasts (maxRowsCount: number, hourly: boolean): MergedWeatherForecast[] {
    const forecasts = this.isLegacyWeather()
      ? this.getWeather().attributes.forecast ?? []
      : this.forecasts ?? []

    const agg = forecasts.reduce<Record<number, WeatherForecast[]>>((acc, forecast) => {
      const d = new Date(forecast.datetime)
      const unit = hourly ? `${d.getMonth()}-${d.getDate()}-${+d.getHours()}` : d.getDate()
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
    const minTemp  = min(minTemps)
    const maxTemps = forecasts.map((f) => f.temperature ?? this.getCurrentTemperature() ?? 0)
    const maxTemp  = max(maxTemps)
    const precipitationProbabilities = forecasts.map((f) => f.precipitation_probability ?? 0)
    const precipitations = forecasts.map((f) => f.precipitation ?? 0)
    const conditions = forecasts.map((f) => f.condition)

    return {
      temperature: maxTemp,
      templow: minTemp,
      datetime: this.parseDateTime(forecasts[0].datetime),
      condition: extractMostOccuring(conditions),
      precipitation_probability: max(precipitationProbabilities),
      precipitation: max(precipitations)
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

    const forecastType = this.determineForecastType()
    if (forecastType === 'hourly_not_supported') {
      this.forecastSubscriber = async () => {}
      this.forecastSubscriberLock = false
      throw this.createError(`Weather entity [${this.config.entity}] does not support hourly forecast.`)
    }
    try {
      const callback = (event: WeatherForecastEvent): void => { this.forecasts = event.forecast }
      const options = { resubscribe: false }
      const message = {
        type: 'weather/subscribe_forecast',
        forecast_type: forecastType,
        entity_id: this.config.entity
      }
      this.forecastSubscriber = await this.hass.connection.subscribeMessage<WeatherForecastEvent>(callback, message, options)
    } catch (e: unknown) {
      console.error('hass-weather-card - Error subscribing to weather forecast', e)
    } finally {
      this.forecastSubscriberLock = false
    }
  }

  private async unsubscribeForecastEvents (): Promise<void> {
    if (this.forecastSubscriber) {
      try {
        await this.forecastSubscriber()
      } catch (_e) {
        // connection already closed
      } finally {
        this.forecastSubscriber = undefined
      }
    }
  }

  private isLegacyWeather (): boolean {
    return !this.supportsFeature(WeatherEntityFeature.FORECAST_DAILY) && !this.supportsFeature(WeatherEntityFeature.FORECAST_HOURLY)
  }

  private supportsFeature (feature: WeatherEntityFeature): boolean {
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

  private determineForecastType (): 'hourly' | 'daily' | 'hourly_not_supported' {
    const supportsDaily  = this.supportsFeature(WeatherEntityFeature.FORECAST_DAILY)
    const supportsHourly = this.supportsFeature(WeatherEntityFeature.FORECAST_HOURLY)
    const hourly = this.config.hourly_forecast
    if (supportsDaily && supportsHourly) return hourly ? 'hourly' : 'daily'
    if (hourly && supportsHourly) return 'hourly'
    if (!hourly && supportsDaily) return 'daily'
    if (hourly && !supportsHourly) return 'hourly_not_supported'
    console.warn(`hass-weather-card - Entity [${this.config.entity}] doesn't support daily forecast. Falling back to hourly.`)
    return 'hourly'
  }

  private parseDateTime (date: string): DateTime {
    const fromIso = DateTime.fromISO(date)
    if (fromIso.isValid) return fromIso
    return DateTime.fromJSDate(new Date(date))
  }
}
