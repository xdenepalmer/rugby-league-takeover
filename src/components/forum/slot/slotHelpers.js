import { ALL_EMOJIS } from "./slotConstants";

export const randomEmoji = () => ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)];

export const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const makeReelTrack = (finalEmoji, reelIndex) => {
  const length = 24 + reelIndex * 8;
  const track = Array.from({ length }, () => randomEmoji());
  const prevEmoji = randomEmoji();
  const nextEmoji = randomEmoji();
  track.push(prevEmoji, finalEmoji, nextEmoji);
  return track;
};

export const getDateStr = (d = new Date()) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
