// the Privacy Rings program, live: how many transactions touched it lately, hour by hour, and the latest few.
// This is exactly what anyone can read from the chain; nothing here decrypts anything.
const L = require('./_lib');
const RING = 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW';
const PAGES = 4;                     // up to 4,000 signatures, enough for a full day at today's pace
let cache = null, at = 0;
module.exports = async (req, res) => {
  try {
    if (cache && Date.now() - at < 30000) return L.send(res, 200, cache, 'public, max-age=20');
    const now = Math.floor(Date.now() / 1000);
    let sigs = [], before = null, complete = false;
    for (let p = 0; p < PAGES; p++) {
      const batch = (await L.rpc('getSignaturesForAddress', [RING, before ? { limit: 1000, before } : { limit: 1000 }])) || [];
      sigs = sigs.concat(batch);
      const last = batch[batch.length - 1];
      if (batch.length < 1000 || !last || !last.blockTime || now - last.blockTime >= 86400) { complete = true; break; }
      before = last.signature;
    }
    const ok = sigs.filter(s => !s.err);
    const oldest = sigs.length ? sigs[sigs.length - 1].blockTime : null;
    const within = sec => ok.filter(s => s.blockTime && now - s.blockTime < sec).length;
    // oldest first; an hour the read doesn't fully cover is unknown (null), never a guess
    const perHour = Array.from({ length: 24 }, (_, i) => {
      const from = now - (24 - i) * 3600, to = from + 3600;
      if (!complete && oldest != null && oldest > from) return null;
      return ok.filter(s => s.blockTime && s.blockTime >= from && s.blockTime < to).length;
    });
    cache = {
      program: RING, hour: within(3600), day: within(86400), capped: !complete, perHour,
      last: ok.slice(0, 6).map(s => ({ sig: s.signature, t: s.blockTime, slot: s.slot })),
      at: Date.now(),
    };
    at = Date.now();
    L.send(res, 200, cache, 'public, max-age=20');
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
