import { html, type TemplateResult } from 'lit'

export function safeRender<T> (renderFn: () => T): T | TemplateResult {
  try {
    return renderFn()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('clock-weather-card - Error while rendering component:', e)
    return html`<p style="color:var(--error-color,#db4437);font-size:0.75rem;padding:4px 8px;margin:0;word-break:break-word">&#9888; ${message}</p>`
  }
}
