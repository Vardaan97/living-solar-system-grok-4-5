/**
 * Embedded snapshot for offline / CORS / API failure / CelesTrak rate-limit.
 * Clearly labeled as cached — not live.
 */
import STARLINK_FALLBACK from './fallback-starlink.js';

export const FALLBACK_META = {
  label: 'cached snapshot',
  note: 'Live data unavailable — showing cached snapshot',
  generatedNote: 'Static embedded dataset for graceful degradation',
};

export const FALLBACK_TLES = {
  stations: `ISS (ZARYA)
1 25544U 98067A   25180.50000000  .00016717  00000+0  10270-3 0  9993
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50072823499999
CSS (TIANHE)
1 48274U 21035A   25180.48000000  .00012000  00000+0  14000-3 0  9991
2 48274  41.4700 120.0000 0008000  90.0000 270.0000 15.61000000123456
`,
  starlink: STARLINK_FALLBACK,
  'gps-ops': `GPS BIIR-2  (PRN 13)
1 24876U 97035A   25180.45000000 -.00000020  00000+0  00000+0 0  9998
2 24876  55.5000  45.0000 0080000 270.0000  90.0000  2.00560000123456
GPS BIIR-4  (PRN 20)
1 26360U 00025A   25180.45000000 -.00000020  00000+0  00000+0 0  9991
2 26360  54.8000 120.0000 0100000 200.0000 160.0000  2.00570000987654
GPS BIIF-1  (PRN 25)
1 36585U 10022A   25180.45000000 -.00000010  00000+0  00000+0 0  9994
2 36585  55.1000 200.0000 0040000  40.0000 320.0000  2.00565000555555
GPS BIIF-3  (PRN 01)
1 37753U 11036A   25180.45000000 -.00000010  00000+0  00000+0 0  9990
2 37753  55.2000 280.0000 0060000 100.0000 260.0000  2.00568000777777
GPS BIII-1  (PRN 04)
1 43873U 19056A   25180.45000000  .00000010  00000+0  00000+0 0  9992
2 43873  55.3000 330.0000 0020000 150.0000 210.0000  2.00562000333333
`,
  oneweb: `ONEWEB-0001
1 44078U 19014A   25180.50000000  .00001000  00000+0  12000-3 0  9995
2 44078  87.9000  10.0000 0002000  90.0000 270.0000 13.20000000111111
ONEWEB-0010
1 44090U 19014M   25180.50000000  .00001000  00000+0  12000-3 0  9990
2 44090  87.9000  50.0000 0002000  95.0000 265.0000 13.20000000222222
ONEWEB-0025
1 44105U 19014AA  25180.50000000  .00001000  00000+0  12000-3 0  9998
2 44105  87.9000 100.0000 0002000 100.0000 260.0000 13.20000000333333
ONEWEB-0050
1 44130U 19037A   25180.50000000  .00001000  00000+0  12000-3 0  9993
2 44130  87.9000 160.0000 0002000 110.0000 250.0000 13.20000000444444
ONEWEB-0100
1 45132U 20006A   25180.50000000  .00001000  00000+0  12000-3 0  9996
2 45132  87.9000 220.0000 0002000 120.0000 240.0000 13.20000000555555
`,
};

export const FALLBACK_AIRCRAFT = [
  { hex: '8004f2', flight: 'AIC302', lat: 28.55, lon: 77.10, alt_baro: 32000, gs: 460, track: 285, country: 'India' },
  { hex: '8005a1', flight: 'IGO214', lat: 28.72, lon: 77.35, alt_baro: 18000, gs: 380, track: 140, country: 'India' },
  { hex: '800612', flight: 'VTI915', lat: 28.40, lon: 76.90, alt_baro: 28000, gs: 420, track: 310, country: 'India' },
  { hex: '8964a8', flight: 'UAE842', lat: 27.95, lon: 77.50, alt_baro: 37000, gs: 490, track: 95, country: 'UAE' },
  { hex: '3c66b3', flight: 'DLH759', lat: 29.10, lon: 76.80, alt_baro: 39000, gs: 505, track: 275, country: 'Germany' },
  { hex: 'c0245e', flight: 'ACA042', lat: 28.20, lon: 78.10, alt_baro: 35000, gs: 470, track: 70, country: 'Canada' },
  { hex: 'a1b2c3', flight: 'UAL802', lat: 29.40, lon: 77.60, alt_baro: 36000, gs: 485, track: 250, country: 'USA' },
  { hex: '4ca8e5', flight: 'EIN053', lat: 27.70, lon: 76.50, alt_baro: 34000, gs: 455, track: 120, country: 'Ireland' },
  { hex: '780a4b', flight: 'CCA987', lat: 28.90, lon: 78.40, alt_baro: 33000, gs: 440, track: 200, country: 'China' },
  { hex: 'ab34cd', flight: 'QTR557', lat: 27.50, lon: 77.80, alt_baro: 38000, gs: 500, track: 300, country: 'Qatar' },
  { hex: '71c084', flight: 'SVA740', lat: 28.05, lon: 76.20, alt_baro: 31000, gs: 430, track: 45, country: 'Saudi Arabia' },
  { hex: '06a2b1', flight: 'ETD201', lat: 29.20, lon: 77.00, alt_baro: 35500, gs: 475, track: 180, country: 'UAE' },
  { hex: 'e4823f', flight: 'THA324', lat: 28.30, lon: 77.70, alt_baro: 29000, gs: 410, track: 90, country: 'Thailand' },
  { hex: 'c82a11', flight: 'CPA031', lat: 27.85, lon: 78.20, alt_baro: 37500, gs: 495, track: 265, country: 'Hong Kong' },
  { hex: '3b85f0', flight: 'AFR227', lat: 28.85, lon: 76.55, alt_baro: 36500, gs: 480, track: 155, country: 'France' },
  { hex: 'a83e22', flight: 'BAW142', lat: 29.00, lon: 78.00, alt_baro: 38500, gs: 510, track: 290, country: 'UK' },
  { hex: '80142a', flight: 'SEJ442', lat: 28.65, lon: 77.25, alt_baro: 12000, gs: 320, track: 220, country: 'India' },
  { hex: '8009cd', flight: 'GOW337', lat: 28.48, lon: 77.05, alt_baro: 9000, gs: 280, track: 55, country: 'India' },
  { hex: '8963f1', flight: 'FDB316', lat: 27.60, lon: 77.20, alt_baro: 30000, gs: 425, track: 10, country: 'UAE' },
  { hex: '7504a2', flight: 'KAL658', lat: 28.15, lon: 76.70, alt_baro: 34500, gs: 465, track: 340, country: 'South Korea' },
];
