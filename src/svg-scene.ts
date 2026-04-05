/**
 * svg-scene.ts — Coastal SVG weather scene generation
 * Ported from v2/js/weather.js — all pure functions, no DOM dependencies.
 *
 * viewBox: 0 0 390 660 | horizon y=285 | sky y=0..285 | land y=285..660
 */

/* ── Condition → visual group ─────────────────────────────────────────── */
const CONDITION_GROUP: Record<string, string> = {
  'sunny':           'sunny',
  'clear-night':     'sunny',
  'partlycloudy':    'partly-cloudy',
  'cloudy':          'cloudy',
  'fog':             'foggy',
  'windy':           'windy',
  'windy-variant':   'windy',
  'rainy':           'rainy',
  'lightning-rainy': 'rainy',
  'hail':            'rainy',
  'snowy-rainy':     'rainy',
  'pouring':         'pouring',
  'lightning':       'stormy',
  'snowy':           'snowy',
  'exceptional':     'cloudy',
}

/* ── HA sun integration options ───────────────────────────────────────── */
export interface SkyOpts {
  /** Sun elevation in degrees (-90..90). 0 = horizon, 90 = zenith. */
  sunElevation?: number
  /** Sun azimuth in degrees (0=N, 90=E, 180=S, 270=W). */
  sunAzimuth?: number
  /** Whether the sun is currently rising (true) or setting (false). */
  sunRising?: boolean
  /** Cloud coverage percentage (0–100). */
  cloudCoverage?: number
  /** Wind speed in km/h. */
  windSpeed?: number
  /** Wind gust speed in km/h. */
  windGustSpeed?: number
  /** Visibility in km. */
  visibility?: number
  /** UV index (0–11+). */
  uvIndex?: number
  /** Humidity percentage (0–100). */
  humidity?: number
  /** Dew point in °C. */
  dewPoint?: number
  /** Atmospheric pressure in hPa. */
  pressure?: number
}

interface SkyBodyPos { sunX: number; sunY: number; moonX: number; moonY: number }
interface UrbanSceneOpts {
  city?: string; beach?: string; foam?: string
  oceanD?: string; oceanM?: string; oceanN?: string
  palm?: string; tint?: string | null; tintOp?: number
}

/* ── Color interpolation helpers ──────────────────────────────────────── */
function parseHex (hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function toHex (r: number, g: number, b: number): string {
  return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('')
}

function lerpColor (a: string, b: string, t: number): string {
  const [r1,g1,b1] = parseHex(a)
  const [r2,g2,b2] = parseHex(b)
  return toHex(r1+(r2-r1)*t, g1+(g2-g1)*t, b1+(b2-b1)*t)
}

/** Interpolate between an ordered list of color stops. t = 0..1 */
function multiLerp (stops: Array<[number, string]>, t: number): string {
  if (t <= stops[0][0]) return stops[0][1]
  if (t >= stops[stops.length-1][0]) return stops[stops.length-1][1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i+1][0]) {
      const local = (t - stops[i][0]) / (stops[i+1][0] - stops[i][0])
      return lerpColor(stops[i][1], stops[i+1][1], local)
    }
  }
  return stops[stops.length-1][1]
}

/**
 * Convert sun elevation (-90..90) to a continuous "daylight factor" (0..1).
 *   -18° or below → 0 (astronomical night)
 *    0°           → 0.35 (horizon)
 *   +60° or above → 1 (full day)
 */
function elevationToDayFactor (elev: number): number {
  if (elev <= -18) return 0
  if (elev >= 60)  return 1
  if (elev <= 0)   return 0.35 * ((elev + 18) / 18)       // -18..0 → 0..0.35
  return 0.35 + 0.65 * (elev / 60)                        //  0..60 → 0.35..1
}

/**
 * Determine the continuous time period from sun elevation.
 * Returns the discrete period name for scene selection
 * plus a dayFactor (0..1) for progressive colour blending.
 */
export function elevationToPeriod (elev: number | undefined, rising?: boolean): { period: string; dayFactor: number } {
  if (elev === undefined) return { period: 'afternoon', dayFactor: 1 }

  const factor = elevationToDayFactor(elev)
  if (elev <= -6)  return { period: 'night', dayFactor: factor }
  if (elev <= 1) {
    return rising !== false
      ? { period: 'dawn', dayFactor: factor }
      : { period: 'dusk', dayFactor: factor }
  }
  if (elev <= 25) return { period: 'morning', dayFactor: factor }
  return { period: 'afternoon', dayFactor: factor }
}

/* ══════════════════════════════════════════════════════════════════════ */
/*   SKY ELEMENTS                                                         */
/* ══════════════════════════════════════════════════════════════════════ */

function svgSun (cx: number, cy: number, opacity: number, color?: string): string {
  const rayCol = color ?? '#FFD000'
  const fillCol = color ? lerpColor(color, '#FFFFFF', 0.35) : '#FFE840'
  const strokeCol = color ?? '#FFCA00'
  return `
<g transform="translate(${cx},${cy})" opacity="${opacity}">
  <line x1="0"   y1="-54" x2="0"   y2="-76" stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="38"  y1="-38" x2="54"  y2="-54" stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="54"  y1="0"   x2="76"  y2="0"   stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="38"  y1="38"  x2="54"  y2="54"  stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="0"   y1="54"  x2="0"   y2="76"  stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="-38" y1="38"  x2="-54" y2="54"  stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="-54" y1="0"   x2="-76" y2="0"   stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="-38" y1="-38" x2="-54" y2="-54" stroke="${rayCol}" stroke-width="6.5" stroke-linecap="round"/>
  <line x1="21"  y1="-50" x2="29"  y2="-69" stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="50"  y1="-21" x2="69"  y2="-29" stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="50"  y1="21"  x2="69"  y2="29"  stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="21"  y1="50"  x2="29"  y2="69"  stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="-21" y1="50"  x2="-29" y2="69"  stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="-50" y1="21"  x2="-69" y2="29"  stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="-50" y1="-21" x2="-69" y2="-29" stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <line x1="-21" y1="-50" x2="-29" y2="-69" stroke="${rayCol}" stroke-width="4"   stroke-linecap="round"/>
  <circle r="46" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.5"/>
</g>`
}

function svgMoon (cx: number, cy: number): string {
  return `
<g transform="translate(${cx},${cy})">
  <circle r="48" fill="#F0E8C8" opacity="0.10"/>
  <circle r="38" fill="#F0E8C8" opacity="0.18"/>
  <circle r="34" fill="#F0E8D0"/>
  <circle cx="14" cy="-10" r="28" fill="#142840"/>
</g>`
}

function svgStars (): string {
  const pts: Array<[number, number, number]> = [
    [36,42,2],[74,26,1.8],[118,58,1.5],[162,34,2],[206,18,1.8],[246,52,1.5],
    [284,28,2],[322,46,1.8],[356,20,1.5],[45,92,1.4],[90,105,1.6],[144,84,1.4],
    [185,112,1.5],[228,75,1.8],[270,100,1.4],[312,82,1.6],[352,108,1.4],
    [22,136,1.3],[70,148,1.5],[112,130,1.3],[156,158,1.4],[200,138,1.5],
    [244,153,1.3],[286,126,1.5],[330,143,1.4],[374,135,1.3],
    [58,170,1.2],[105,182,1.3],[148,165,1.2],[192,178,1.3],[238,168,1.2],
    [60,200,1.2],[100,215,1.1],[145,205,1.2],[188,218,1.1],[232,208,1.2],
  ]
  return pts.map(([x,y,r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="0.88"/>`
  ).join('')
}

function svgClouds (alpha: number): string {
  return `
<g opacity="${alpha}">
  <ellipse cx="294" cy="125" rx="40" ry="25" fill="white"/>
  <ellipse cx="268" cy="132" rx="28" ry="20" fill="white"/>
  <ellipse cx="322" cy="132" rx="25" ry="18" fill="white"/>
</g>
<g opacity="${alpha * 0.76}">
  <ellipse cx="338" cy="86"  rx="25" ry="16" fill="white"/>
  <ellipse cx="322" cy="91"  rx="18" ry="13" fill="white"/>
  <ellipse cx="354" cy="91"  rx="17" ry="12" fill="white"/>
</g>`
}

function svgOvercast (cloudColor: string): string {
  return `
<g>
  <ellipse cx="55"  cy="185" rx="72" ry="52" fill="${cloudColor}"/>
  <ellipse cx="148" cy="155" rx="92" ry="58" fill="${cloudColor}"/>
  <ellipse cx="258" cy="162" rx="88" ry="54" fill="${cloudColor}"/>
  <ellipse cx="348" cy="150" rx="68" ry="47" fill="${cloudColor}"/>
  <ellipse cx="55"  cy="208" rx="58" ry="42" fill="${cloudColor}"/>
  <ellipse cx="145" cy="180" rx="78" ry="48" fill="${cloudColor}"/>
  <ellipse cx="254" cy="188" rx="74" ry="44" fill="${cloudColor}"/>
  <ellipse cx="352" cy="174" rx="58" ry="39" fill="${cloudColor}"/>
</g>`
}

function svgSnowDots (): string {
  const dots: Array<[number, number, number]> = [
    [30,50,3.5],[88,38,2.8],[140,72,4],[195,28,3],[248,60,2.5],[298,45,3.8],
    [348,30,3],[380,65,2.5],[15,118,2.8],[70,135,3.5],[125,108,2],[178,148,3],
    [230,122,3.8],[278,138,2.5],[325,118,3.2],[370,140,2],[50,195,3],
    [105,210,2.5],[155,185,3.8],[205,218,2.8],[255,200,3.5],[305,185,2.2],
    [355,208,3],[388,188,2.5],[20,265,2.8],[75,280,3.5],[130,258,2],
    [185,295,3],[235,270,3.8],[285,260,2.5],[335,278,3],[375,268,2.2],
    [45,352,2.8],[100,365,3],[155,340,2.5],[210,372,3.5],[265,348,2.2],
    [315,362,3],[368,345,2.8],
  ]
  return dots.map(([x,y,r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="0.80"/>`
  ).join('')
}

function svgThunder (): string {
  const bolts = [
    { ox: 72,  oy: 88,  pts: [[0,0],[8,42],[-4,42],[10,88],[-5,88],[6,138],[-8,138],[4,175]] },
    { ox: 218, oy: 68,  pts: [[0,0],[10,50],[-6,50],[12,108],[-6,108],[8,165],[-10,165],[5,200]] },
    { ox: 340, oy: 96,  pts: [[0,0],[7,38],[-4,38],[9,78],[-5,78],[6,120],[-6,120],[4,152]] },
  ]
  return bolts.map(({ ox, oy, pts }) => {
    const d = 'M' + (pts as Array<[number, number]>).map(([dx, dy]) => `${ox + dx},${oy + dy}`).join(' L')
    return [
      `<path d="${d}" fill="none" stroke="rgba(255,240,130,0.22)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="none" stroke="rgba(255,255,200,0.72)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    ].join('')
  }).join('')
}

function svgHorizonGlow (color: string, cx: number, cy: number): string {
  return `
<ellipse cx="${cx}" cy="${cy}" rx="230" ry="90" fill="${color}" opacity="0.22"/>
<ellipse cx="${cx}" cy="${cy}" rx="115" ry="52" fill="${color}" opacity="0.36"/>
<circle  cx="${cx}" cy="${cy}" r="44"           fill="${color}" opacity="0.58"/>`
}

/* ══════════════════════════════════════════════════════════════════════ */
/*   COASTAL SCENE                                                        */
/* ══════════════════════════════════════════════════════════════════════ */

function drawPalmGrove (col: string): string {
  // Trees ONLY on the LEFT side of the scene
  const p: string[] = []

  // Two palm trunks on the far left
  const trunks: Array<[number, number, number, number]> = [
    [45, 462, 50, 582],   // left palm
    [95, 472, 100, 582],  // second palm, slightly right
  ]
  for (const [cx, cy, bx, by] of trunks) {
    p.push(`<path d="M${bx-3},${by} Q${cx-5},${(cy+by)/2} ${cx},${cy} L${cx+6},${cy} Q${cx+4},${(cy+by)/2} ${bx+3},${by} Z" fill="${col}"/>`)
  }

  // Fronds radiating from each crown
  const crowns: Array<[number, number, number]> = [
    [45, 454, 1.0],
    [95, 464, 0.85],
  ]
  for (const [cx, cy, s] of crowns) {
    const fronds: Array<[number, number, number]> = [
      [-160, 48, 7], [-130, 52, 7], [-100, 54, 7], [-70, 52, 7],
      [-40, 48, 7],  [-10, 46, 7],  [20, 48, 7],   [50, 50, 7],
      [80, 52, 6],   [110, 48, 6],  [140, 44, 6],
    ]
    for (const [a, len, wid] of fronds) {
      const rad = a * Math.PI / 180
      const fl  = +(len * s).toFixed(1)
      const fw  = +(wid * s).toFixed(1)
      const off = fl * 0.42
      const fcx = Math.round(cx + off * Math.cos(rad))
      const fcy = Math.round(cy + 4 + off * Math.sin(rad))
      p.push(`<ellipse cx="${fcx}" cy="${fcy}" rx="${fw}" ry="${fl}" fill="${col}" transform="rotate(${a},${fcx},${fcy})"/>`)
    }
  }

  return p.join('')
}

function svgBuilding (col: string): string {
  // ONE modern tropical building on the RIGHT side only
  return `<path fill="${col}" d="
    M 300,582 L 300,440 L 305,438 L 310,436 L 320,436 L 340,434 L 360,434 L 362,436
    L 362,440 L 365,440 L 365,450 L 368,450 L 368,582 Z"/>
  <rect x="315" y="450" width="14" height="20" rx="2" fill="rgba(180,220,255,0.18)"/>
  <rect x="340" y="450" width="14" height="20" rx="2" fill="rgba(180,220,255,0.12)"/>
  <rect x="315" y="480" width="14" height="20" rx="2" fill="rgba(180,220,255,0.15)"/>
  <rect x="340" y="480" width="14" height="20" rx="2" fill="rgba(180,220,255,0.10)"/>
  <rect x="315" y="510" width="14" height="20" rx="2" fill="rgba(180,220,255,0.12)"/>
  <rect x="340" y="510" width="14" height="20" rx="2" fill="rgba(180,220,255,0.08)"/>`
}

function svgUrbanScene (o: UrbanSceneOpts): string {
  /*
   * 4 horizontal bands stacked bottom to top (viewBox 0 0 390 660):
   *   Sky:     y=  0..231  (top 35%)
   *   Ocean:   y=231..363  (next 20%)
   *   Beach:   y=363..462  (next 15%)
   *   Ground:  y=462..660  (bottom 30%)
   *
   * Overlay elements:
   *   Trees   — LEFT side only
   *   Building — RIGHT side only, ONE modern tropical building
   */
  const beach  = o.beach  ?? '#D4A840'
  const foam   = o.foam   ?? '#90D4E8'
  const oceanD = o.oceanD ?? '#28B0D8'
  const oceanM = o.oceanM ?? '#1470B8'
  const oceanN = o.oceanN ?? '#0A4A8C'
  const palm   = o.palm   ?? '#131B26'
  const city   = o.city   ?? '#1A2840'
  const tint   = o.tint   ?? null
  const tintOp = o.tintOp ?? 0

  // Ground band (bottom 30%): y=462..660
  const ground = `<rect x="0" y="462" width="390" height="198" fill="${palm}"/>`

  // Beach band (15%): y=363..462
  const beachBand = `<rect x="0" y="363" width="390" height="99" fill="${beach}"/>`
  const beachFoam = `<line x1="0" y1="365" x2="390" y2="365" stroke="${foam}" stroke-width="4" opacity="0.55"/>`

  // Ocean bands (20%): y=231..363, split into near/far
  const oceanFar  = `<rect x="0" y="231" width="390" height="66" fill="${oceanD}"/>`
  const oceanMid  = `<rect x="0" y="297" width="390" height="33" fill="${oceanM}"/>`
  const oceanNear = `<rect x="0" y="330" width="390" height="33" fill="${oceanN}"/>`

  // Wave lines
  const waves = [
    `<line x1="14"  y1="260" x2="100" y2="257" stroke="rgba(255,255,255,0.40)" stroke-width="2.5" stroke-linecap="round"/>`,
    `<line x1="180" y1="255" x2="290" y2="252" stroke="rgba(255,255,255,0.28)" stroke-width="2"   stroke-linecap="round"/>`,
    `<line x1="50"  y1="310" x2="150" y2="308" stroke="rgba(255,255,255,0.32)" stroke-width="2"   stroke-linecap="round"/>`,
    `<line x1="220" y1="315" x2="370" y2="312" stroke="rgba(255,255,255,0.24)" stroke-width="2"   stroke-linecap="round"/>`,
    `<line x1="30"  y1="345" x2="160" y2="342" stroke="rgba(255,255,255,0.36)" stroke-width="2.5" stroke-linecap="round"/>`,
    `<line x1="250" y1="350" x2="380" y2="348" stroke="rgba(255,255,255,0.22)" stroke-width="2"   stroke-linecap="round"/>`,
  ].join('')

  // Overlay: trees LEFT, building RIGHT
  const palms    = drawPalmGrove(palm)
  const building = svgBuilding(city)

  // Optional tint overlay on lower bands
  const overlay = tint
    ? `<rect x="0" y="231" width="390" height="429" fill="${tint}" opacity="${tintOp}"/>`
    : ''

  return ground + beachBand + beachFoam + oceanFar + oceanMid + oceanNear + waves + palms + building + overlay
}

/* ══════════════════════════════════════════════════════════════════════ */
/*   SUN / MOON POSITIONING                                               */
/* ══════════════════════════════════════════════════════════════════════ */

function getSkyBodyPos (period: string, opts: SkyOpts = {}): SkyBodyPos {
  /* ── HA sun entity integration ──────────────────────────────────
     When opts.sunElevation is provided (from sun.sun entity), use
     it to position the sun precisely instead of time-based snapping.
     Horizon line is at y=231 (top of ocean band).
  ─────────────────────────────────────────────────────────────── */
  if (typeof opts.sunElevation === 'number') {
    const az   = typeof opts.sunAzimuth === 'number' ? opts.sunAzimuth : 180
    const tSun = Math.max(0, Math.min(1, (az - 90) / 180))
    const sunX = Math.round(48 + tSun * 298)
    const sunY = Math.round(231 - Math.max(0, opts.sunElevation) / 90 * 200)
    return { sunX, sunY, moonX: -100, moonY: -100 }
  }

  const now = new Date()
  const hr  = now.getHours() + now.getMinutes() / 60

  const tSun   = Math.max(0, Math.min(1, (hr - 6) / 13))
  const rSunX  = Math.round(48 + tSun * 298)
  const rSunY  = Math.round(231 - Math.sin(tSun * Math.PI) * 200)

  const tMoon  = Math.max(0, Math.min(1,
    hr >= 20 ? (hr - 20) / 12 : (hr < 8 ? (hr + 4) / 12 : 1)))
  const rMoonX = Math.round(380 - tMoon * 298)
  const rMoonY = Math.round(231 - Math.sin(tMoon * Math.PI) * 200)

  const snapped: Record<string, SkyBodyPos> = {
    night:     { sunX: -100, sunY: -100, moonX: rMoonX, moonY: rMoonY },
    dawn:      { sunX:  52,  sunY:  231, moonX: 348,    moonY: 80     },
    morning:   { sunX: 195,  sunY:  155, moonX: -100,   moonY: -100   },
    afternoon: { sunX: 245,  sunY:   45, moonX: -100,   moonY: -100   },
    dusk:      { sunX: 342,  sunY:  231, moonX: 108,    moonY: 100    },
  }
  return snapped[period] ?? { sunX: rSunX, sunY: rSunY, moonX: rMoonX, moonY: rMoonY }
}

/* ══════════════════════════════════════════════════════════════════════ */
/*   GRADIENT HELPERS                                                     */
/* ══════════════════════════════════════════════════════════════════════ */

function gradient (top: string, bottom: string): string {
  return `<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="${top}"/>
  <stop offset="100%" stop-color="${bottom}"/>
</linearGradient>`
}

function gradientStops (stops: Array<[number, string]>): string {
  const inner = stops.map(([p,c]) => `<stop offset="${p}%" stop-color="${c}"/>`).join('\n  ')
  return `<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">\n  ${inner}\n</linearGradient>`
}

/* ══════════════════════════════════════════════════════════════════════ */
/*   MAIN BACKGROUND BUILDER                                              */
/* ══════════════════════════════════════════════════════════════════════ */

/**
 * Builds a full-card SVG string for the coastal weather scene.
 *
 * @param condition  HA weather condition string (e.g. 'sunny', 'rainy')
 * @param period     Time period: 'night' | 'dawn' | 'morning' | 'afternoon' | 'dusk'
 * @param opts       Optional data from HA sun.sun + weather entity attributes
 */
export function buildBackground (condition: string, period: string, opts: SkyOpts = {}): string {
  const effectivePeriod = condition === 'clear-night' ? 'night' : period
  const group = CONDITION_GROUP[condition] ?? 'cloudy'

  const isNight  = effectivePeriod === 'night'
  const isDawn   = effectivePeriod === 'dawn'
  const isDusk   = effectivePeriod === 'dusk'
  const isRainy  = group === 'rainy' || group === 'pouring'
  const isStormy = group === 'stormy'
  const isWindy  = group === 'windy'
  const isCloudy = group === 'cloudy' || group === 'foggy'
  const isSnowy  = group === 'snowy'
  const isPartly = group === 'partly-cloudy'
  const isFoggy  = group === 'foggy'

  const pos = getSkyBodyPos(effectivePeriod, opts)

  // ── Data-driven modifiers ────────────────────────────────────────────
  // Continuous day factor from sun elevation (0 = deep night, 1 = full day)
  const dayFactor = typeof opts.sunElevation === 'number'
    ? elevationToDayFactor(opts.sunElevation)
    : (isNight ? 0 : isDawn || isDusk ? 0.30 : 0.85)

  // Cloud coverage (0..1) — modulates cloud opacity and sky desaturation
  const cc = typeof opts.cloudCoverage === 'number'
    ? Math.max(0, Math.min(1, opts.cloudCoverage / 100))
    : (isCloudy ? 0.85 : isPartly ? 0.45 : isRainy || isStormy ? 0.95 : 0)

  // Visibility factor (1 = clear 10km+, 0 = near-zero fog)
  const visFactor = typeof opts.visibility === 'number'
    ? Math.max(0, Math.min(1, opts.visibility / 10))
    : (isFoggy ? 0.25 : 1)

  let skyGrad: string
  let skyContent: string
  let land: string

  if (isNight) {
    // Progressive night sky: blend between deep night and twilight based on dayFactor
    const topColor    = lerpColor('#0C1830', '#1E3050', dayFactor * 2)
    const bottomColor = lerpColor('#142640', '#2A3858', dayFactor * 2)
    skyGrad    = gradient(topColor, bottomColor)
    skyContent = svgStars() + svgMoon(pos.moonX, pos.moonY)
    land = svgUrbanScene({ city: '#141E30', beach: '#3A3428', foam: '#1A2838', oceanD: '#162038', oceanM: '#0E1828', oceanN: '#0A1420', palm: '#0C1420', tint: '#081020', tintOp: 0.30 })

  } else if (isDawn) {
    // Progressive dawn: blend from deep purple → warm orange based on dayFactor
    const df = Math.max(0, Math.min(1, (dayFactor - 0.1) / 0.3))
    const top = lerpColor('#0F0828', '#28105A', df)
    const mid1 = lerpColor('#3A1420', '#A82812', df)
    const mid2 = lerpColor('#804020', '#E07416', df)
    const bot = lerpColor('#C06020', '#F8BC3C', df)
    skyGrad    = gradientStops([[0, top], [32, mid1], [66, mid2], [100, bot]])
    const dawnSunCol = lerpColor('#FF4500', '#FFD000', df)
    skyContent = svgSun(pos.sunX, pos.sunY, 0.65 + df * 0.27, dawnSunCol) + svgHorizonGlow('#FF8C1C', pos.sunX, pos.sunY)
    land = svgUrbanScene({ city: '#1A2240', beach: '#C08840', foam: '#E09040', oceanD: '#2065A0', oceanM: '#153870', oceanN: '#0D2448', palm: '#13171E' })

  } else if (isDusk) {
    const df = Math.max(0, Math.min(1, (dayFactor - 0.1) / 0.3))
    const top = lerpColor('#1A0838', '#682A8A', df)
    const mid1 = lerpColor('#4A1820', '#C84428', df)
    const mid2 = lerpColor('#905020', '#EE8418', df)
    const bot = lerpColor('#C87020', '#F8C23C', df)
    skyGrad    = gradientStops([[0, top], [32, mid1], [66, mid2], [100, bot]])
    const duskSunCol = lerpColor('#FFD000', '#CC2200', 1 - df)
    skyContent = svgSun(pos.sunX, pos.sunY, 0.55 + df * 0.33, duskSunCol) + svgHorizonGlow('#FF6C1C', pos.sunX, pos.sunY)
    land = svgUrbanScene({ city: '#181830', beach: '#A87028', foam: '#CC7235', oceanD: '#1D4870', oceanM: '#133060', oceanN: '#0C1E40', palm: '#11101A' })

  } else if (isStormy) {
    skyGrad    = gradient('#101820', '#1A2A38')
    skyContent = svgOvercast('#161E28') + svgThunder()
    land = svgUrbanScene({ city: '#141C26', beach: '#706858', foam: '#283848', oceanD: '#142030', oceanM: '#0E1828', oceanN: '#080E18', palm: '#0C1018', tint: '#101820', tintOp: 0.28 })

  } else if (isWindy) {
    skyGrad    = gradientStops([[0,'#5888A8'],[50,'#78A8C4'],[100,'#96C8E0']])
    skyContent = svgSun(pos.sunX, pos.sunY, 0.70) + svgClouds(0.68)
    land = svgUrbanScene({ city: '#1E2C3C', beach: '#B8A070', foam: '#709AAC', oceanD: '#2A66A0', oceanM: '#1A4878', oceanN: '#0E2E56', palm: '#151E2A' })

  } else if (isRainy) {
    skyGrad    = gradient('#1E2C3A', '#2E4252')
    skyContent = svgOvercast('#243444')
    land = svgUrbanScene({ city: '#1C2830', beach: '#848060', foam: '#364E60', oceanD: '#1C3248', oceanM: '#122438', oceanN: '#0C1828', palm: '#131720', tint: '#182030', tintOp: 0.20 })

  } else if (isSnowy) {
    skyGrad    = gradient('#7290AA', '#A8C8D4')
    skyContent = svgSnowDots()
    land = svgUrbanScene({ city: '#2A3050', beach: '#C8CAC8', foam: '#D8E0E8', oceanD: '#3C6898', oceanM: '#283860', oceanN: '#182440', palm: '#1E2838' })

  } else if (isCloudy) {
    // Progressive cloudy: desaturate the sunny sky based on cloud coverage
    const topClear = '#42B0E2'
    const botClear = '#72C8EE'
    const topOver  = '#6482A0'
    const botOver  = '#82A6BA'
    skyGrad    = gradient(lerpColor(topClear, topOver, cc), lerpColor(botClear, botOver, cc))
    const cloudAlpha = 0.55 + cc * 0.40
    skyContent = cc > 0.65
      ? svgOvercast(lerpColor('#A0B8C8', '#7EA0B2', cc))
      : svgSun(pos.sunX, pos.sunY, 1 - cc) + svgClouds(cloudAlpha)
    land = svgUrbanScene({ city: '#1C2840', beach: '#A89868', foam: '#507090', oceanD: '#2A5890', oceanM: '#1C3C68', oceanN: '#0E2448', palm: '#161E28', tint: '#203040', tintOp: cc * 0.20 })

  } else if (isPartly) {
    // Cloud coverage modulates how many clouds are drawn
    const cloudAlpha = 0.55 + cc * 0.45
    skyGrad    = gradient('#42B0E2', '#72C8EE')
    skyContent = svgSun(pos.sunX, pos.sunY, Math.max(0.50, 1 - cc * 0.5)) + svgClouds(cloudAlpha)
    land = svgUrbanScene({})

  } else {
    /* Sunny — progressive daylight color based on sun elevation */
    const topColor = multiLerp([[0, '#65A5D0'], [0.4, '#40ACDF'], [0.7, '#2C98D8'], [1, '#1880C8']], dayFactor)
    const botColor = multiLerp([[0, '#A0D4E8'], [0.4, '#85D5F0'], [0.7, '#65C5EC'], [1, '#50B8E4']], dayFactor)
    skyGrad    = gradientStops([[0, topColor], [65, lerpColor(topColor, botColor, 0.6)], [100, botColor]])
    skyContent = svgSun(pos.sunX, pos.sunY, 1.0)
    land = svgUrbanScene({})
  }

  // ── Visibility / fog overlay ───────────────────────────────────────
  const fogOverlay = visFactor < 0.85
    ? `<rect width="390" height="660" fill="white" opacity="${((1 - visFactor) * 0.35).toFixed(2)}"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 660" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
<defs>
  ${skyGrad}
  <linearGradient id="gScrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="rgba(0,0,0,0)"    />
    <stop offset="55%"  stop-color="rgba(0,0,0,0.06)" />
    <stop offset="100%" stop-color="rgba(0,0,0,0.48)" />
  </linearGradient>
</defs>
<rect width="390" height="231" fill="url(#gSky)"/>
${skyContent}
${land}
${fogOverlay}
<rect y="430" width="390" height="230" fill="url(#gScrim)"/>
</svg>`
}
