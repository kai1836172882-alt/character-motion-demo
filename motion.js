(function (root) {
  const durations = { nod: 2.2, shake: 2.6, tilt: 3, doubleBlink: 1.1, happy: 2.8 };
  function sample(name, elapsed) {
    const pose = { blink: 0, mouth: 0, sway: 0, nod: 0, lookX: 0, lookY: 0 };
    const duration = durations[name];
    if (!duration || elapsed <= 0 || elapsed >= duration) return pose;
    const t = elapsed / duration, envelope = Math.sin(Math.PI * t) ** 2;
    if (name === 'nod') pose.nod = Math.sin(t * Math.PI * 2) ** 2 * envelope * 1.4;
    if (name === 'shake') { pose.lookX = Math.sin(t * Math.PI * 6) * envelope; pose.sway = pose.lookX * .3; }
    if (name === 'tilt') { pose.sway = envelope * 1.4; pose.lookY = envelope * -.25; }
    if (name === 'doubleBlink') {
      const pulse = center => Math.abs(elapsed - center) < .12 ? Math.cos((elapsed - center) / .12 * Math.PI / 2) ** 2 : 0;
      pose.blink = Math.max(pulse(.23), pulse(.64));
    }
    if (name === 'happy') { pose.blink = envelope * .95; pose.mouth = envelope * .55; pose.sway = envelope * -.6; pose.nod = Math.sin(t * Math.PI * 3) * envelope * .3; }
    return pose;
  }
  const api = { durations, sample };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CharacterMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
