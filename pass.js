// Monthly Pass claim counting. Loaded before app.js; also run by tests/pass.test.js in Node.
function passClaims(fromMs, toMs, pass) {
  const DAY = 86400000; // milliseconds in a day
  const days = new Set();
  [pass.purchase, pass.renewal].forEach((start) => {
    if (!start) return; //no pass, or no renewal
    for (let i = 0; i < 30; i++)  days.add(resetOf(start) + i * DAY);
    
  });
  let count = 0;
  days.forEach((t) =>  {if (t > fromMs && t <= toMs) count++; });
  return count;
}
// The daily reset (04:00 server time, UTC+8) that starts server day 'YYYY-MM-DD'.
function resetOf(day) { return Date.parse(day + 'T04:00:00+08:00'); }

// passClaims(fromMs, toMs, pass) -> how many Monthly Pass claims fall in that window.
//   fromMs, toMs: timestamps in ms. Look at each daily reset t with fromMs < t <= toMs.
//   pass:         { purchase: 'YYYY-MM-DD' | null, renewal: 'YYYY-MM-DD' | null } (server dates)
// A reset counts when its server day is one of a pass's 30 days: the purchase day through


if (typeof module !== 'undefined') module.exports = { passClaims, resetOf };
