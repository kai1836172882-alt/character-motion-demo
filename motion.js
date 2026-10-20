(function (root) {
  const durations = { tilt: 3, doubleBlink: 1.1, happy: 2.8 };
  function sample(name, elapsed) {
    const pose = { blink: 0, mouth: 0, sway: 0, lookX: 0, lookY: 0 };
    const duration = durations[name];
    if (!duration || elapsed <= 0 || elapsed >= duration) return pose;
    const t = elapsed / duration, envelope = Math.sin(Math.PI * t) ** 2;
    if (name === 'tilt') { pose.sway = envelope * 1.4; pose.lookY = envelope * -.25; }
    if (name === 'doubleBlink') {
      const pulse = center => Math.abs(elapsed - center) < .12 ? Math.cos((elapsed - center) / .12 * Math.PI / 2) ** 2 : 0;
      pose.blink = Math.max(pulse(.23), pulse(.64));
    }
    if (name === 'happy') { pose.blink = envelope * .95; pose.mouth = envelope * .55; }
    return pose;
  }
  const api = { durations, sample };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CharacterMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
