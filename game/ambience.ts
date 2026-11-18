export class Ambience {
  private context: AudioContext | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBufferSourceNode | null = null;
  async start() {
    this.stop();
    const context = new AudioContext(); this.context = context;
    await context.resume();
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 450;
    const gain = context.createGain(); gain.gain.value = 0.035;
    noise.connect(filter).connect(gain).connect(context.destination); noise.start(); this.noise = noise;
    const bird = () => {
      if (document.hidden || context.state !== "running") return;
      const oscillator = context.createOscillator(), envelope = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine"; oscillator.frequency.setValueAtTime(1700 + Math.random() * 900, now); oscillator.frequency.exponentialRampToValueAtTime(3100, now + 0.12); oscillator.frequency.exponentialRampToValueAtTime(2100, now + 0.24);
      envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(0.025, now + 0.03); envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      oscillator.connect(envelope).connect(context.destination); oscillator.start(now); oscillator.stop(now + 0.3);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    };
    bird(); this.interval = setInterval(bird, 4700);
  }
  playMilestone(kind: "build" | "bread") {
    const context = this.context;
    if (!context || context.state !== "running" || document.hidden) return;

    const notes = kind === "bread" ? [523.25, 659.25, 783.99] : [392, 523.25];
    const start = context.currentTime;
    for (const [index, frequency] of notes.entries()) {
      const time = start + index * 0.095;
      const note = context.createOscillator();
      const volume = context.createGain();
      note.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, time);
      volume.gain.exponentialRampToValueAtTime(0.05, time + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
      note.connect(volume).connect(context.destination);
      note.start(time);
      note.stop(time + 0.23);
      note.onended = () => { note.disconnect(); volume.disconnect(); };
    }
  }
  stop() { if (this.interval) clearInterval(this.interval); this.interval = null; this.noise?.stop(); this.noise = null; void this.context?.close(); this.context = null; }
}
