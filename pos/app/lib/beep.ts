"use client";

let audioContext: AudioContext | null = null;

/** Short scanner-style confirmation tone; "error" plays a lower double tone. Silent if audio is unavailable. */
export function beep(kind: "ok" | "error" = "ok") {
  try {
    audioContext ??= new AudioContext();
    const context = audioContext;
    const tones = kind === "ok" ? [1760] : [330, 262];
    tones.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.13;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "ok" ? "sine" : "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "ok" ? 0.18 : 0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    });
  } catch {
    // Audio feedback is optional.
  }
}
