/**
 * Code 128 (set B) barcodes as inline SVG — for printing gift voucher codes that any USB / Bluetooth
 * barcode scanner reads. Set B covers every printable ASCII character (letters, digits, "-").
 */

// Bar/space widths for each symbol value (0–102), then Start A/B/C (103–105) and Stop (106).
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const STOP = 106;

/** The symbol values for `text` in set B, with start, checksum and stop. */
export function code128Values(text: string) {
  const data = [...text].map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error(`Can't put "${character}" in a Code 128 barcode`);
    return code - 32;
  });
  const checksum = data.reduce((sum, value, index) => sum + value * (index + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

/**
 * An SVG barcode that stretches to the width of its box (height from CSS). Includes the quiet zone
 * (10 modules each side) scanners need.
 */
export function code128Svg(text: string, options: { height?: number } = {}) {
  const widths = code128Values(text).map((value) => PATTERNS[value]).join("");
  const quiet = 10;
  let x = quiet;
  const bars: string[] = [];
  [...widths].forEach((width, index) => {
    const w = Number(width);
    if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="1"/>`);
    x += w;
  });
  const total = x + quiet;
  const height = options.height ?? 40;
  return `<svg class="barcode" viewBox="0 0 ${total} 1" preserveAspectRatio="none" width="100%" height="${height}" shape-rendering="crispEdges" role="img" aria-label="Barcode ${text}"><g fill="#000">${bars.join("")}</g></svg>`;
}
