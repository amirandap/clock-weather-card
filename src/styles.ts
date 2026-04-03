import { css } from 'lit'

export default css`

  /* ── Host: make the custom element a block so layout works ── */
  :host {
    display: block;
  }

  /* ── Base text-color vars (white on any gradient) */
  ha-card {
    --color-text-primary:   rgba(255, 255, 255, 1);
    --color-text-secondary: rgba(255, 255, 255, 0.7);
    --widget-gradient: linear-gradient(148deg, #7ec8f8 0%, #4e9fe8 28%, #3b7ed6 55%, #2a60c0 100%);
    --shadow-tint:     rgba(42, 96, 192, 0.45);
    --icon-filter:     brightness(0) invert(1) drop-shadow(0 4px 12px rgba(0,0,0,0.3));

    /*
     * --ha-card-background drives ha-card's inner shadow-DOM div when running
     * inside Home Assistant (where ha-card is a registered custom element).
     * 'background' acts as the fallback for standalone demo mode where ha-card
     * is just an unknown HTML element with no shadow DOM of its own.
     */
    --ha-card-background:  var(--widget-gradient);
    --ha-card-box-shadow:  0 24px 60px var(--shadow-tint), 0 8px 24px rgba(0, 0, 0, 0.25);

    position: relative;
    overflow: visible;
    /* height: auto so content expands the card; 100% is set by HA's grid when needed */
    height: auto;
    background: var(--widget-gradient);
    border-radius: var(--ha-card-border-radius, 12px);
    transition: background 1.4s ease, box-shadow 1.4s ease;
    box-shadow: var(--ha-card-box-shadow);
    padding: 0 !important;
  }

/* ─── NIGHT  21:00 – 05:29  ─── deep cool dark ──────────── */
ha-card[data-theme="night-sunny"],
ha-card[data-theme="night-clear"] {
  --widget-gradient: linear-gradient(148deg, #1c2d6a 0%, #101e4e 45%, #070e2e 100%);
  --shadow-tint: rgba(7, 14, 46, 0.7);
  --icon-filter: brightness(0) invert(1) sepia(0.2) saturate(2.5) hue-rotate(215deg) drop-shadow(0 4px 12px rgba(0,0,0,0.55));
}
ha-card[data-theme="night-partly-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #182848 0%, #0e1c36 45%, #060e1e 100%);
  --shadow-tint: rgba(6, 14, 30, 0.7);
  --icon-filter: brightness(0) invert(1) sepia(0.2) saturate(2) hue-rotate(210deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="night-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #141e28 0%, #0c141e 45%, #060a10 100%);
  --shadow-tint: rgba(6, 10, 16, 0.75);
  --icon-filter: brightness(0) invert(1) sepia(0.15) saturate(1.5) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="night-rainy"] {
  --widget-gradient: linear-gradient(148deg, #0e1e30 0%, #081420 45%, #04090e 100%);
  --shadow-tint: rgba(4, 9, 14, 0.8);
  --icon-filter: brightness(0) invert(1) sepia(0.15) saturate(2) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.55));
}
ha-card[data-theme="night-pouring"] {
  --widget-gradient: linear-gradient(148deg, #080e18 0%, #040810 45%, #020508 100%);
  --shadow-tint: rgba(2, 5, 8, 0.88);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2.5) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.6));
}
ha-card[data-theme="night-stormy"] {
  --widget-gradient: linear-gradient(148deg, #0e0e12 0%, #08080e 45%, #040408 100%);
  --shadow-tint: rgba(4, 4, 8, 0.88);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2.5) hue-rotate(215deg) drop-shadow(0 4px 12px rgba(0,0,0,0.65));
}
ha-card[data-theme="night-snowy"] {
  --widget-gradient: linear-gradient(148deg, #1a2244 0%, #0e1630 45%, #060c1c 100%);
  --shadow-tint: rgba(6, 12, 28, 0.7);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(195deg) drop-shadow(0 4px 12px rgba(0,0,0,0.45));
}
ha-card[data-theme="night-foggy"] {
  --widget-gradient: linear-gradient(148deg, #18181e 0%, #101014 45%, #08080c 100%);
  --shadow-tint: rgba(8, 8, 12, 0.75);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(1.2) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}

/* ─── DAWN  05:30 – 07:29  ─── deep violet → warm orange ─── */
ha-card[data-theme="dawn-sunny"] {
  /* Violet sky shifts to red-orange at the horizon */
  --widget-gradient: linear-gradient(148deg, #2a0850 0%, #b82810 45%, #f09020 100%);
  --shadow-tint: rgba(184, 40, 16, 0.4);
  --icon-filter: brightness(0) invert(1) sepia(0.7) saturate(5) hue-rotate(8deg) drop-shadow(0 4px 14px rgba(0,0,0,0.4));
}
ha-card[data-theme="dawn-partly-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #1e0840 0%, #903028 45%, #c07030 100%);
  --shadow-tint: rgba(144, 48, 40, 0.42);
  --icon-filter: brightness(0) invert(1) sepia(0.65) saturate(4) hue-rotate(10deg) drop-shadow(0 4px 14px rgba(0,0,0,0.4));
}
ha-card[data-theme="dawn-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #1a1030 0%, #5a3848 45%, #706040 100%);
  --shadow-tint: rgba(90, 56, 72, 0.5);
  --icon-filter: brightness(0) invert(1) sepia(0.4) saturate(2.5) hue-rotate(20deg) drop-shadow(0 4px 12px rgba(0,0,0,0.45));
}
ha-card[data-theme="dawn-rainy"] {
  --widget-gradient: linear-gradient(148deg, #150d25 0%, #342038 45%, #3a2830 100%);
  --shadow-tint: rgba(52, 32, 56, 0.55);
  --icon-filter: brightness(0) invert(1) sepia(0.3) saturate(2) hue-rotate(190deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="dawn-pouring"] {
  --widget-gradient: linear-gradient(148deg, #0d0a18 0%, #1c1428 45%, #1a1018 100%);
  --shadow-tint: rgba(28, 20, 40, 0.65);
  --icon-filter: brightness(0) invert(1) sepia(0.2) saturate(2) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.55));
}
ha-card[data-theme="dawn-stormy"] {
  --widget-gradient: linear-gradient(148deg, #08080e 0%, #120c14 45%, #0e080c 100%);
  --shadow-tint: rgba(18, 12, 20, 0.75);
  --icon-filter: brightness(0) invert(1) sepia(0.15) saturate(2) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.6));
}
ha-card[data-theme="dawn-snowy"] {
  /* Lavender-rose pre-dawn with snow */
  --widget-gradient: linear-gradient(148deg, #28185a 0%, #806890 50%, #c0a0c8 100%);
  --shadow-tint: rgba(128, 104, 144, 0.38);
  --icon-filter: brightness(0) invert(1) sepia(0.3) saturate(2.5) hue-rotate(185deg) drop-shadow(0 4px 12px rgba(0,0,0,0.4));
}
ha-card[data-theme="dawn-foggy"] {
  --widget-gradient: linear-gradient(148deg, #1e1830 0%, #504548 45%, #706860 100%);
  --shadow-tint: rgba(80, 69, 72, 0.5);
  --icon-filter: brightness(0) invert(1) sepia(0.35) saturate(2) hue-rotate(25deg) drop-shadow(0 4px 12px rgba(0,0,0,0.45));
}

/* ─── MORNING  07:30 – 11:59  ─── fresh soft sky ─────────── */
ha-card[data-theme="morning-sunny"] {
  /* Warm pale-gold top fades into fresh sky blue — bright but not scorching */
  --widget-gradient: linear-gradient(148deg, #ffe8b0 0%, #70c0f0 50%, #2890d0 100%);
  --shadow-tint: rgba(40, 144, 208, 0.38);
  --icon-filter: brightness(0) invert(1) sepia(0.3) saturate(2.5) hue-rotate(15deg) drop-shadow(0 4px 12px rgba(0,0,0,0.25));
}
ha-card[data-theme="morning-partly-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #b8dff0 0%, #70b0e0 45%, #3888c0 100%);
  --shadow-tint: rgba(56, 136, 192, 0.38);
  --icon-filter: brightness(0) invert(1) sepia(0.2) saturate(2) hue-rotate(15deg) drop-shadow(0 4px 12px rgba(0,0,0,0.25));
}
ha-card[data-theme="morning-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #9ab4c4 0%, #6888a0 45%, #406880 100%);
  --shadow-tint: rgba(64, 104, 128, 0.44);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(1.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.3));
}
ha-card[data-theme="morning-rainy"] {
  --widget-gradient: linear-gradient(148deg, #7898b8 0%, #406888 45%, #204868 100%);
  --shadow-tint: rgba(32, 72, 104, 0.5);
  --icon-filter: brightness(0) invert(1) sepia(0.15) saturate(2) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.35));
}
ha-card[data-theme="morning-pouring"] {
  --widget-gradient: linear-gradient(148deg, #3a5060 0%, #1e3040 45%, #0c1820 100%);
  --shadow-tint: rgba(12, 24, 32, 0.6);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="morning-stormy"] {
  --widget-gradient: linear-gradient(148deg, #383e48 0%, #1e2430 45%, #0c1218 100%);
  --shadow-tint: rgba(12, 18, 24, 0.65);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(210deg) drop-shadow(0 4px 12px rgba(0,0,0,0.55));
}
ha-card[data-theme="morning-snowy"] {
  --widget-gradient: linear-gradient(148deg, #e0f0fc 0%, #b0d4ee 45%, #70aed8 100%);
  --shadow-tint: rgba(112, 174, 216, 0.33);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(195deg) drop-shadow(0 4px 12px rgba(0,0,0,0.25));
}
ha-card[data-theme="morning-foggy"] {
  --widget-gradient: linear-gradient(148deg, #bac0c8 0%, #8898a0 45%, #6a7880 100%);
  --shadow-tint: rgba(106, 120, 128, 0.4);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(1.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.3));
}

/* ─── AFTERNOON  12:00 – 16:59  ─── peak heat & saturation ─ */
ha-card[data-theme="afternoon-sunny"] {
  /* Scorching amber-gold — hottest feeling of the day */
  --widget-gradient: linear-gradient(148deg, #ffe266 0%, #ffb020 45%, #e88000 100%);
  --shadow-tint: rgba(232, 128, 0, 0.45);
  --icon-filter: brightness(0) invert(1) sepia(0.5) saturate(5) hue-rotate(5deg) drop-shadow(0 6px 18px rgba(0,0,0,0.35));
}
ha-card[data-theme="afternoon-partly-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #aeddf5 0%, #6ab8e8 40%, #3890d0 100%);
  --shadow-tint: rgba(56, 144, 208, 0.4);
  --icon-filter: brightness(0) invert(1) sepia(0.25) saturate(2) hue-rotate(15deg) drop-shadow(0 4px 12px rgba(0,0,0,0.25));
}
ha-card[data-theme="afternoon-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #8aaab8 0%, #5a8aa0 45%, #3a6a80 100%);
  --shadow-tint: rgba(58, 106, 128, 0.45);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(1.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.3));
}
ha-card[data-theme="afternoon-rainy"] {
  --widget-gradient: linear-gradient(148deg, #7aaac8 0%, #3a7098 45%, #1a5078 100%);
  --shadow-tint: rgba(26, 80, 120, 0.5);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.35));
}
ha-card[data-theme="afternoon-pouring"] {
  --widget-gradient: linear-gradient(148deg, #3a5a72 0%, #1e3a52 45%, #0a1e32 100%);
  --shadow-tint: rgba(10, 30, 50, 0.6);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2.5) hue-rotate(205deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="afternoon-stormy"] {
  --widget-gradient: linear-gradient(148deg, #3a4a4e 0%, #1e2c32 45%, #0a1418 100%);
  --shadow-tint: rgba(10, 20, 24, 0.65);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(215deg) drop-shadow(0 4px 12px rgba(0,0,0,0.55));
}
ha-card[data-theme="afternoon-snowy"] {
  --widget-gradient: linear-gradient(148deg, #daeef8 0%, #a8d4ec 45%, #6ab0d8 100%);
  --shadow-tint: rgba(106, 176, 216, 0.35);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(195deg) drop-shadow(0 4px 12px rgba(0,0,0,0.25));
}
ha-card[data-theme="afternoon-foggy"] {
  --widget-gradient: linear-gradient(148deg, #b0b8bc 0%, #808890 45%, #606068 100%);
  --shadow-tint: rgba(96, 96, 104, 0.4);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(1.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.3));
}

/* ─── DUSK  17:00 – 20:59  ─── golden hour → deep purple ─── */
ha-card[data-theme="dusk-sunny"] {
  /* Burning gold → red-orange → deep magenta/purple */
  --widget-gradient: linear-gradient(148deg, #f5a020 0%, #e03030 50%, #701060 100%);
  --shadow-tint: rgba(224, 48, 48, 0.45);
  --icon-filter: brightness(0) invert(1) sepia(0.75) saturate(5) hue-rotate(-12deg) drop-shadow(0 6px 18px rgba(0,0,0,0.4));
}
ha-card[data-theme="dusk-partly-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #d07830 0%, #904060 50%, #481060 100%);
  --shadow-tint: rgba(144, 64, 96, 0.45);
  --icon-filter: brightness(0) invert(1) sepia(0.65) saturate(4) hue-rotate(-5deg) drop-shadow(0 4px 14px rgba(0,0,0,0.4));
}
ha-card[data-theme="dusk-cloudy"] {
  --widget-gradient: linear-gradient(148deg, #806050 0%, #503858 45%, #301840 100%);
  --shadow-tint: rgba(80, 56, 88, 0.5);
  --icon-filter: brightness(0) invert(1) sepia(0.4) saturate(2) hue-rotate(350deg) drop-shadow(0 4px 12px rgba(0,0,0,0.45));
}
ha-card[data-theme="dusk-rainy"] {
  --widget-gradient: linear-gradient(148deg, #603040 0%, #3c1c30 45%, #1c0818 100%);
  --shadow-tint: rgba(60, 28, 48, 0.6);
  --icon-filter: brightness(0) invert(1) sepia(0.2) saturate(2.5) hue-rotate(190deg) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
ha-card[data-theme="dusk-pouring"] {
  --widget-gradient: linear-gradient(148deg, #2a1020 0%, #180810 45%, #0c0408 100%);
  --shadow-tint: rgba(24, 8, 16, 0.75);
  --icon-filter: brightness(0) invert(1) sepia(0.15) saturate(2.5) hue-rotate(200deg) drop-shadow(0 4px 12px rgba(0,0,0,0.6));
}
ha-card[data-theme="dusk-stormy"] {
  --widget-gradient: linear-gradient(148deg, #180808 0%, #0e0408 45%, #080204 100%);
  --shadow-tint: rgba(14, 4, 8, 0.85);
  --icon-filter: brightness(0) invert(1) sepia(0.1) saturate(2) hue-rotate(210deg) drop-shadow(0 4px 12px rgba(0,0,0,0.65));
}
ha-card[data-theme="dusk-snowy"] {
  /* Warm salmon sky with snow haze */
  --widget-gradient: linear-gradient(148deg, #c08060 0%, #8a5068 50%, #502850 100%);
  --shadow-tint: rgba(138, 80, 104, 0.4);
  --icon-filter: brightness(0) invert(1) sepia(0.35) saturate(2.5) hue-rotate(185deg) drop-shadow(0 4px 12px rgba(0,0,0,0.4));
}
ha-card[data-theme="dusk-foggy"] {
  --widget-gradient: linear-gradient(148deg, #a07868 0%, #706060 45%, #504858 100%);
  --shadow-tint: rgba(112, 96, 96, 0.45);
  --icon-filter: brightness(0) invert(1) sepia(0.4) saturate(2) hue-rotate(10deg) drop-shadow(0 4px 12px rgba(0,0,0,0.4));
}

  /* ── Full-card Lottie background layer */
  .lottie-layer {
    position: absolute;
    inset: 0;
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }

  .lottie-layer canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 1.4s ease;
  }

  #lottieCanvasClouds.is-visible { opacity: 0.30; }
  #lottieCanvasRain.is-visible   { opacity: 0.65; }

  /* ── Overflowing corner icon */
  .bg-icon {
    position: absolute;
    top: -40px;
    right: -24px;
    width: 180px;
    height: 180px;
    pointer-events: none;
    z-index: 3;
  }

  .bg-icon::before {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(255,255,255,0.28) 0%,
      rgba(255,255,255,0.08) 55%,
      transparent 80%
    );
    filter: blur(12px);
  }

  .icon-main {
    position: relative;
    display: block;
    width: 130px;
    height: 130px;
    object-fit: contain;
    filter: var(--icon-filter);
  }

  /* ── Card body (all content, above lottie layer) */
  .card-body {
    position: relative;
    z-index: 2;
    overflow: visible;
    padding: 24px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Hero: temp + condition/time row */
  .hero {
    padding-right: 110px;
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 8px;
  }

  .temp {
    font-size: 5.5rem;
    font-weight: 900;
    color: var(--color-text-primary);
    line-height: 1;
    letter-spacing: -0.04em;
    margin: 0;
  }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-top: 8px;
  }

  .condition {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-primary);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .current-time {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  /* ── Forecast strips (v1 layout) */
  .forecast-section {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .forecast-hourly {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 12px;
    margin-top: 8px;
  }

  .hour-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .hour-slot__icon {
    width: 36px;
    height: 36px;
    filter: var(--icon-filter);
  }

  .hour-slot__time {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .forecast-daily {
    display: grid;
    grid-template-columns: repeat(var(--daily-cols, 4), 1fr);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 12px;
    margin-top: 8px;
  }

  .forecast-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
  }

  .forecast-slot:not(:last-child) {
    border-right: 1px solid rgba(255, 255, 255, 0.15);
  }

  .forecast-slot__icon {
    width: 36px;
    height: 36px;
    filter: var(--icon-filter);
  }

  .forecast-slot__temp {
    font-size: 1.0rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .forecast-slot__day {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
`
