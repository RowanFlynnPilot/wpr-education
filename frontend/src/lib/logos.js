// District logos, pulled from each district's official website (header
// logo / og:image; a couple from the district's official athletics site
// where the main site only offers white-knockout variants). Used
// editorially, small, for identification — they remain the districts'
// marks. Rasters are trimmed, background-keyed, and downscaled to 192px;
// SVGs ship as-is. Original 8 pulled 2026-07-25; remaining 38 pulled
// 2026-07-26. White Lake (6440) has no usable mark (Google Sites, no
// downloadable logo asset) and intentionally has no file — the UI
// degrades gracefully for any code missing here.
//
// Adding a logo = drop {dpi_code}.png/.svg/.jpg into assets/logos/.
const files = import.meta.glob('../assets/logos/*.{png,svg,jpg}', {
  eager: true,
  import: 'default',
  query: '?url',
})

export const LOGOS = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.match(/(\d{4})\.\w+$/)[1], url]),
)

// Brand accent per district, sampled from the logo above (dominant
// saturated hue, darkened where needed to >=3:1 contrast on cream).
// Black-and-white marks get a dark charcoal. Used for page chrome only —
// card edge, header rule — never for chart data lines, which stay in the
// WPR palette so series colors mean the same thing on every page.
export const ACCENTS = {
  '0007': '#d10d0b', // Abbotsford Falcons red
  '0105': '#2b2926', // Almond-Bancroft Eagles black
  '0126': '#01138b', // Tomorrow River Falcons blue
  '0140': '#580e1b', // Antigo Red Robins maroon
  '0196': '#1d3f8f', // Athens Bluejays royal blue
  '0203': '#1f38b6', // Auburndale Eagles blue
  '0602': '#264c9a', // Bonduel Bears blue
  '0623': '#c72026', // Bowler Panthers red
  '1141': '#f74802', // Clintonville Truckers orange
  '1162': '#8b8b02', // Colby Hornets gold
  '1561': '#0a5c26', // Edgar Wildcats green
  '1582': '#642d90', // Elcho Hornets purple
  '2135': '#2b2926', // Gilman Pirates black
  '2226': '#b73418', // Granton Bulldogs red
  '2394': '#990101', // Greenwood Indians red
  '2415': '#d4191f', // Gresham Wildcats red
  '2639': '#cd5f00', // Iola-Scandinavia Thunderbirds orange
  '3206': '#5a0713', // Loyal Greyhounds maroon
  '3276': '#b70017', // Manawa Wolves red
  '3304': '#c33b2f', // Marathon City red
  '3318': '#003475', // Marion Mustangs blue
  '3339': '#c65825', // Marshfield Tigers orange
  '3409': '#b0342b', // Medford Raiders red
  '3500': '#021559', // Merrill Bluejays navy
  '3787': '#552c85', // Mosinee purple
  '3899': '#a71a1e', // Neillsville Warriors red
  '3906': '#2b2926', // Nekoosa Papermakers black
  '3955': '#85181e', // New London Bulldogs red
  '4207': '#b1192e', // Owen-Withee Blackhawks red
  '4368': '#795bbe', // Pittsville Panthers purple
  '4508': '#c05a15', // Port Edwards Blackhawks orange
  '4795': '#4d121c', // Rib Lake Redmen maroon
  '4963': '#90880d', // Rosholt Hornets gold
  '4970': '#26573a', // D.C. Everest evergreen
  '5264': '#980000', // Shawano Hawks red
  '5467': '#c8102e', // Spencer Rockets red
  '5607': '#003595', // Stevens Point Area blue
  '5628': '#cd4a12', // Stratford tiger orange
  '5726': '#a30101', // Thorp Cardinals red
  '5740': '#2e1c6d', // Tigerton Tigers navy
  '5754': '#090d38', // Tomahawk Hatchets navy
  '6195': '#478ccc', // Waupaca Comets blue
  '6223': '#4a2b52', // Wausau crest purple
  '6384': '#d61733', // Weyauwega-Fremont Warhawks red
  '6685': '#ec2527', // Wisconsin Rapids Red Raiders red
  '6692': '#074712', // Wittenberg-Birnamwood Chargers green
}
