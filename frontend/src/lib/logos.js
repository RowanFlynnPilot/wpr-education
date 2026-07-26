// District logos, pulled 2026-07-25 from each district's official website
// (header logo / og:image). Used editorially, small, for identification —
// they remain the districts' marks. Downscaled to 192px max at import time.
import athens from '../assets/logos/0196.png'
import edgar from '../assets/logos/1561.svg'
import marathonCity from '../assets/logos/3304.png'
import mosinee from '../assets/logos/3787.svg'
import dce from '../assets/logos/4970.png'
import spencer from '../assets/logos/5467.png'
import stratford from '../assets/logos/5628.png'
import wausau from '../assets/logos/6223.jpg'

export const LOGOS = {
  '0196': athens,
  '1561': edgar,
  '3304': marathonCity,
  '3787': mosinee,
  '4970': dce,
  '5467': spencer,
  '5628': stratford,
  '6223': wausau,
}

// Brand accent per district, sampled from the logo above (dominant
// saturated hue, darkened where needed for contrast on cream). Used for
// page chrome only — card edge, header rule — never for chart data lines,
// which stay in the WPR palette so series colors mean the same thing on
// every page.
export const ACCENTS = {
  '0196': '#1d3f8f', // Athens Bluejays royal blue
  '1561': '#0a5c26', // Edgar Wildcats green
  '3304': '#c33b2f', // Marathon City red
  '3787': '#552c85', // Mosinee purple
  '4970': '#26573a', // D.C. Everest evergreen
  '5467': '#c8102e', // Spencer Rockets red
  '5628': '#cd4a12', // Stratford tiger orange
  '6223': '#4a2b52', // Wausau crest purple
}
