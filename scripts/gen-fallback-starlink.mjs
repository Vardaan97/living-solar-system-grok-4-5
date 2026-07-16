/** Generate valid Starlink-like TLEs for offline fallback. */
function cksum(line) {
  let sum = 0;
  const body = line.slice(0, 68).padEnd(68, ' ');
  for (let i = 0; i < 68; i++) {
    const c = body[i];
    if (c === '-') sum += 1;
    else if (c >= '0' && c <= '9') sum += Number(c);
  }
  return String(sum % 10);
}

function field(num, width, decimals) {
  return num.toFixed(decimals).padStart(width, ' ');
}

function build(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const norad = 44713 + i;
    const id = String(norad).padStart(5, '0');
    const name = `STARLINK-${1000 + i}`;
    const inc = 53.0538;
    const raan = (i * 6.137) % 360;
    const argp = (80 + i * 0.7) % 360;
    const ma = (i * 17.913) % 360;
    const n = 15.06389123 + (i % 50) * 0.00001;
    const rev = String((i * 13) % 99999).padStart(5, '0');

    let l1 = `1 ${id}U 19074A   25180.50000000  .00002182  00000+0  16770-3 0  9990`;
    l1 = l1.slice(0, 68);
    l1 = l1.padEnd(68, ' ') + cksum(l1);

    // NORAD line 2 columns with required spaces
    let l2 =
      `2 ${id}` +
      field(inc, 8, 4) +
      field(raan, 8, 4) +
      ' ' +
      '0001450' +
      field(argp, 8, 4) +
      field(ma, 8, 4) +
      field(n, 11, 8) +
      rev;
    l2 = l2.slice(0, 68).padEnd(68, ' ') + cksum(l2);

    lines.push(name, l1, l2);
  }
  return lines.join('\n') + '\n';
}

const text = build(550);
// validate with satellite.js if available
const sample = text.split('\n').slice(0, 3);
console.log(sample.join('\n'));
console.log('len l1', sample[1].length, 'l2', sample[2].length);
console.log('TOTAL_CHARS', text.length);
import('fs').then((fs) => {
  fs.writeFileSync(new URL('../js/fallback-starlink-tles.txt', import.meta.url), text);
  console.log('wrote fallback-starlink-tles.txt');
});
