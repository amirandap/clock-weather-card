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
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
    })

    this._lottieRain = new DotLottie({
      canvas:   canvasRain,
      src:      RAIN_LOTTIE,
      loop:     true,
      autoplay: true,
      renderConfig: { devicePixelRatio: window.devicePixelRatio || 2, freezeOnOffscreen: false }
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
          ${showForecast ? html`
            <div class="forecast-section">
              ${this.hourlyForecasts?.length ? safeRender(() => this.renderHourlyStrip()) : ''}
              ${safeRender(() => this.renderDailyStrip())}
            </div>
          ` : ''}
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
    if (!this.forecastSubscriber && !this.forecastSubscriberHourly) {
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

  // ── V1-style forecast strips ─────────────────────────────────────────────

  private renderHourlyStrip (): TemplateResult {
    const items = this.mergeForecasts(4, true, this.hourlyForecasts ?? [])
    return html`
      <div class="forecast-hourly">
        ${items.map(f => safeRender(() => {
          const icon = this.toIcon(f.condition, 'line', false, this.getIconAnimationKind())
          return html`
            <div class="hour-slot">
              <img class="hour-slot__icon" src=${icon} alt="" />
              <span class="hour-slot__time">${this.time(f.datetime)}</span>
            </div>
          `
        }))}
      </div>
    `
  }

  private renderDailyStrip (): TemplateResult {
    const rows = this.config.forecast_rows ?? 4
    const items = this.mergeForecasts(rows, false)
    const entityTempUnit = this.getWeather().attributes.temperature_unit
    return html`
      <div class="forecast-daily" style="--daily-cols: ${items.length}">
        ${items.map(f => safeRender(() => {
          const icon = this.toIcon(f.condition, 'line', true, 'static')
          const temp = this.toConfiguredTempWithUnit(entityTempUnit, Math.round(f.temperature))
          const day  = this.localize(`day.${f.datetime.weekday}`)
          return html`
            <div class="forecast-slot">
              <img class="forecast-slot__icon" src=${icon} alt="" />
              <span class="forecast-slot__temp">${temp}</span>
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

  private localize (key: string): string {
    return localize(key, this.getLocale())
  }

  private mergeForecasts (maxRowsCount: number, hourly: boolean, source?: WeatherForecast[]): MergedWeatherForecast[] {
    const forecasts = source !== undefined
      ? source
      : this.isLegacyWeather()
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

    const supportsDaily  = this.supportsFeature(WeatherEntityFeature.FORECAST_DAILY)
    const supportsHourly = this.supportsFeature(WeatherEntityFeature.FORECAST_HOURLY)
    // Use daily when available; fall back to hourly-only entities
    const primaryType: 'daily' | 'hourly' = supportsDaily ? 'daily' : 'hourly'
    const options = { resubscribe: false }
    try {
      const dailyCallback = (event: WeatherForecastEvent): void => { this.forecasts = event.forecast }
      this.forecastSubscriber = await this.hass.connection.subscribeMessage<WeatherForecastEvent>(
        dailyCallback,
        { type: 'weather/subscribe_forecast', forecast_type: primaryType, entity_id: this.config.entity },
        options
      )
      // Subscribe to hourly separately when entity supports both
      if (supportsDaily && supportsHourly) {
        const hourlyCallback = (event: WeatherForecastEvent): void => { this.hourlyForecasts = event.forecast }
        this.forecastSubscriberHourly = await this.hass.connection.subscribeMessage<WeatherForecastEvent>(
          hourlyCallback,
          { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: this.config.entity },
          options
        )
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
    return DateTime.fromJSDate(new Date(date))
  }
}
