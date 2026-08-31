/**
 * Lightweight equirectangular world-map geometry.
 *
 * Rather than shipping a topojson dependency for what is ultimately a decorative
 * background, land is described as a union of simplified [lon, lat] polygons
 * (minus a few holes, e.g. Hudson Bay). A dot grid is rasterised against that
 * union once and memoised, then emitted as a single SVG path so the map costs
 * one DOM node instead of a few thousand circles.
 */

export type LonLat = [number, number];

/** Visible latitude window - trims empty Antarctic / high-Arctic bands. */
export const LAT_TOP = 78;
export const LAT_BOTTOM = -56;

const LAND: LonLat[][] = [
  // North America
  [
    [-168, 66], [-166, 60], [-158, 58], [-152, 59], [-142, 60], [-136, 58],
    [-130, 54], [-125, 49], [-124, 43], [-121, 36], [-117, 32], [-114, 30],
    [-110, 24], [-106, 21], [-97, 16], [-94, 16], [-91, 19], [-95, 19],
    [-97, 25], [-94, 29], [-89, 29], [-85, 30], [-82, 25], [-81, 31],
    [-76, 35], [-74, 39], [-70, 42], [-66, 45], [-60, 47], [-55, 50],
    [-56, 54], [-64, 58], [-78, 62], [-95, 70], [-105, 68], [-115, 70],
    [-125, 70], [-133, 69], [-145, 70], [-156, 71],
  ],
  // Central America
  [[-92, 17], [-88, 17], [-83, 10], [-78, 9], [-77, 8], [-83, 8], [-87, 13], [-92, 15]],
  // Greenland
  [
    [-45, 60], [-50, 63], [-54, 67], [-58, 71], [-62, 76], [-58, 80],
    [-45, 83], [-30, 83], [-20, 77], [-22, 72], [-28, 68], [-38, 65], [-42, 61],
  ],
  // Caribbean (Cuba / Hispaniola band)
  [[-85, 22], [-77, 21], [-70, 19], [-74, 20], [-78, 23], [-84, 23]],
  // South America
  [
    [-81, -2], [-80, -6], [-77, -12], [-71, -18], [-70, -24], [-72, -33],
    [-74, -42], [-75, -49], [-70, -55], [-66, -55], [-66, -48], [-62, -40],
    [-58, -35], [-53, -33], [-48, -27], [-40, -21], [-39, -13], [-35, -8],
    [-38, -4], [-45, -1], [-50, 0], [-52, 4], [-58, 8], [-62, 10], [-70, 11],
    [-75, 10], [-78, 8], [-79, 2],
  ],
  // Africa
  [
    [-17, 15], [-16, 20], [-12, 25], [-6, 31], [2, 34], [10, 34], [20, 32],
    [28, 31], [33, 31], [35, 28], [38, 22], [43, 13], [48, 12], [51, 11],
    [47, 4], [42, -1], [41, -8], [38, -12], [35, -18], [33, -25], [30, -31],
    [26, -34], [20, -35], [17, -29], [14, -22], [12, -16], [9, -2], [10, 4],
    [5, 5], [-2, 5], [-8, 4], [-13, 8], [-16, 12],
  ],
  // Madagascar
  [[43, -12], [50, -15], [50, -20], [47, -25], [44, -22], [43, -17]],
  // Europe
  [
    [-9, 37], [-9, 43], [-4, 44], [-1, 46], [-2, 48], [1, 50], [4, 52],
    [7, 53], [8, 55], [10, 57], [13, 55], [19, 54], [21, 56], [24, 59],
    [22, 60], [25, 65], [30, 70], [38, 68], [45, 66], [50, 68], [60, 70],
    [68, 68], [66, 60], [60, 55], [57, 50], [50, 46], [47, 44], [40, 44],
    [36, 45], [30, 46], [28, 44], [23, 42], [20, 40], [16, 41], [12, 44],
    [7, 43], [3, 42], [-2, 39], [-6, 37],
  ],
  // Italy
  [[12, 46], [14, 42], [17, 40], [16, 38], [12, 38], [10, 44]],
  // Great Britain
  [[-5.5, 50], [-6, 53], [-6, 55], [-4, 58.5], [-2, 58.5], [-1, 54], [1.7, 52.8], [1, 51.2], [-3, 50.2]],
  // Ireland
  [[-10, 52], [-10, 55], [-6, 55], [-6, 52]],
  // Iceland
  [[-24, 65], [-14, 66], [-14, 64], [-22, 63]],
  // Asia
  [
    [28, 44], [35, 44], [40, 43], [45, 42], [50, 44], [52, 42], [50, 37],
    [48, 30], [44, 30], [42, 29], [43, 24], [45, 20], [48, 18], [52, 17],
    [57, 23], [56, 27], [60, 25], [64, 25], [67, 24], [70, 21], [72, 20],
    [73, 15], [77, 8], [80, 13], [80, 19], [87, 21], [89, 22], [92, 21],
    [94, 16], [98, 16], [98, 10], [100, 6], [102, 2], [104.3, 1], [104.5, 3], [103, 7],
    [105, 10], [109, 11], [108, 18],
    [110, 21], [113, 22], [117, 24], [121, 30], [122, 37], [126, 40],
    [130, 43], [135, 48], [141, 52], [143, 55], [150, 59], [158, 61],
    [163, 60], [170, 61], [179, 65], [180, 69], [170, 70], [160, 71],
    [145, 72], [130, 73], [115, 76], [100, 77], [85, 74], [75, 73], [68, 72],
    [62, 70], [58, 68], [50, 68], [45, 66], [40, 68], [33, 68], [30, 66],
    [28, 60], [30, 55], [33, 50], [30, 47],
  ],
  // Sri Lanka
  [[80, 9], [82, 8], [81, 6], [80, 7]],
  // Japan - Honshu
  [
    [131, 34.2], [133, 34.2], [135.5, 34.3], [138, 34.6], [140.5, 35.2],
    [141.5, 38], [141.5, 41.5], [140, 41.5], [139.5, 40], [140, 38],
    [138, 36.5], [136, 36], [133, 35.5], [131, 35.5],
  ],
  // Japan - Kyushu / Shikoku
  [[129.5, 31.5], [131.5, 31], [132.5, 33.5], [130, 34], [129.5, 33]],
  // Japan - Hokkaido
  [[140, 42], [145.5, 43.5], [145, 45.5], [141, 45.5], [140, 43.5]],
  // Philippines
  [[120, 18], [122, 18], [124, 13], [126, 9], [126, 6], [122, 6], [120, 10], [119, 14]],
  // Sumatra
  [[95, 5], [100, 0], [105, -6], [103, -6], [98, -2], [95, 3]],
  // Java
  [[104.5, -5.5], [114.5, -7.4], [115, -8.8], [104.5, -7.4]],
  // Borneo
  [[109, 2], [117, 4], [119, -1], [116, -4], [110, -3], [108, 0]],
  // Sulawesi
  [[119, 1], [125, 1], [125, -2], [121, -5], [119, -3]],
  // New Guinea
  [[131, -1], [141, -3], [150, -6], [147, -9], [140, -9], [133, -4]],
  // Australia
  [
    [113, -22], [113.5, -26], [115, -32], [119, -34.5], [125, -33], [131, -32],
    [135, -35], [138, -35], [141, -38], [146, -39], [150, -37], [153, -30],
    [153, -25], [146, -19], [142, -11], [136, -12], [132, -11], [130, -14],
    [126, -14], [122, -17], [117, -21],
  ],
  // Tasmania
  [[145, -41], [148, -41], [148, -43], [145, -43]],
  // New Zealand
  [[173, -35], [176, -37], [178, -38], [175, -41], [173, -39]],
  [[166, -45], [171, -41], [174, -41], [172, -45], [168, -47]],
];

const HOLES: LonLat[][] = [
  // Hudson Bay
  [[-95, 62], [-88, 63], [-78, 62], [-77, 57], [-82, 55], [-88, 56], [-95, 58]],
  // Caspian Sea
  [[47, 46], [53, 45], [54, 40], [50, 37], [47, 41]],
  // Baltic / Gulf of Bothnia
  [[17, 56], [21, 57], [23, 63], [19, 64], [17, 60]],
];

function inRing(lon: number, lat: number, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isLand(lon: number, lat: number): boolean {
  for (const h of HOLES) if (inRing(lon, lat, h)) return false;
  for (const p of LAND) if (inRing(lon, lat, p)) return true;
  return false;
}

export interface Projection {
  width: number;
  height: number;
}

/** Equirectangular projection clipped to the visible latitude window. */
export function project(lon: number, lat: number, p: Projection) {
  const x = ((lon + 180) / 360) * p.width;
  const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * p.height;
  return { x, y };
}

const dotCache = new Map<string, string>();

/**
 * Rasterise the land union into a dot grid and return it as one SVG path.
 * `cols` controls density; `r` the dot radius in viewBox units.
 */
export function landDotPath(p: Projection, cols = 150, r = 1.05): string {
  const key = `${p.width}x${p.height}:${cols}:${r}`;
  const cached = dotCache.get(key);
  if (cached) return cached;

  const stepLon = 360 / cols;
  // Keep dot spacing visually square on the projected canvas: the projection is
  // non-uniform (360 deg of lon vs a 134 deg lat window), so rows derive from the
  // pixel step, not the degree step.
  const rows = Math.max(1, Math.round((p.height / p.width) * cols));
  const stepLat = (LAT_TOP - LAT_BOTTOM) / rows;

  const parts: string[] = [];
  for (let lat = LAT_TOP; lat >= LAT_BOTTOM; lat -= stepLat) {
    for (let lon = -180; lon <= 180; lon += stepLon) {
      if (!isLand(lon, lat)) continue;
      const { x, y } = project(lon, lat, p);
      parts.push(
        `M${x.toFixed(2)} ${(y - r).toFixed(2)}a${r} ${r} 0 1 0 0 ${(r * 2).toFixed(2)}a${r} ${r} 0 1 0 0 ${(-r * 2).toFixed(2)}`
      );
    }
  }

  const d = parts.join("");
  dotCache.set(key, d);
  return d;
}

export interface Hub {
  code: string;
  name: string;
  flag: string;
  lon: number;
  lat: number;
}

/** Alliance chapter hubs highlighted on the community map. */
export const HUBS: Hub[] = [
  { code: "PH", name: "Philippines", flag: "\u{1F1F5}\u{1F1ED}", lon: 121.0, lat: 14.6 },
  { code: "AE", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}", lon: 55.3, lat: 25.2 },
  { code: "SG", name: "Singapore", flag: "\u{1F1F8}\u{1F1EC}", lon: 103.8, lat: 1.35 },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}", lon: -0.13, lat: 51.5 },
  { code: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}", lon: -74.0, lat: 40.7 },
  { code: "AU", name: "Australia", flag: "\u{1F1E6}\u{1F1FA}", lon: 151.2, lat: -33.9 },
  { code: "MY", name: "Malaysia", flag: "\u{1F1F2}\u{1F1FE}", lon: 101.7, lat: 3.1 },
  { code: "ID", name: "Indonesia", flag: "\u{1F1EE}\u{1F1E9}", lon: 106.8, lat: -6.2 },
  { code: "VN", name: "Vietnam", flag: "\u{1F1FB}\u{1F1F3}", lon: 105.8, lat: 21.0 },
  { code: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}", lon: 139.7, lat: 35.7 },
];

/** Ordered pairs of hub codes drawn as glowing great-circle-ish arcs. */
export const HUB_LINKS: [string, string][] = [
  ["GB", "US"],
  ["GB", "AE"],
  ["AE", "SG"],
  ["SG", "PH"],
  ["PH", "JP"],
  ["SG", "AU"],
  ["MY", "SG"],
  ["ID", "AU"],
  ["VN", "JP"],
];

/** Quadratic arc between two projected points, bowed away from the equator. */
export function arcPath(a: Hub, b: Hub, p: Projection, bow = 0.22): string {
  const pa = project(a.lon, a.lat, p);
  const pb = project(b.lon, b.lat, p);
  const mx = (pa.x + pb.x) / 2;
  const my = (pa.y + pb.y) / 2;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy);
  // Perpendicular offset, always lifting the arc upward for a consistent look.
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const dir = ny > 0 ? -1 : 1;
  const cx = mx + nx * len * bow * dir;
  const cy = my + ny * len * bow * dir;
  return `M${pa.x.toFixed(2)} ${pa.y.toFixed(2)}Q${cx.toFixed(2)} ${cy.toFixed(2)} ${pb.x.toFixed(2)} ${pb.y.toFixed(2)}`;
}
