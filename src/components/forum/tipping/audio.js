// ── Audio feedback ──────────────────────────────────────────────────
const audioCtxRef = { current: null };
export function playTone(freq, dur, type = "sine", vol = 0.08) {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}
export function playLockSound() {
  playTone(523.25, 0.1, "square", 0.06);
  setTimeout(() => playTone(659.25, 0.1, "square", 0.06), 80);
  setTimeout(() => playTone(783.99, 0.15, "square", 0.06), 160);
}
export function playSelectSound(isHome) {
  playTone(isHome ? 440 : 494, 0.06, "sine", 0.04);
}
