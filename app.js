(() => {
  const cfg = window.ROZHLAS_CONFIG;
  const $ = (id) => document.getElementById(id);
  const rad = Math.PI / 180;

  const state = {
    target: 0,
    sx: 1,
    sy: 0,
    heading: 0,
    compassSeen: false,
    manualUntil: 0,
    muted: false,
    denied: false,
  };

  let ctx = null;
  let master = null;
  let noiseGain = null;
  const voices = [];

  const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const gainFor = (d) => (d >= cfg.beam ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * d) / cfg.beam));

  function buildDial() {
    const card = $("card");
    for (let i = 0; i < 72; i++) {
      const rot = document.createElement("div");
      rot.className = "rot";
      rot.style.transform = `rotate(${i * 5}deg)`;
      const tick = document.createElement("div");
      tick.className = i % 6 === 0 ? "tick major" : "tick";
      rot.appendChild(tick);
      card.appendChild(rot);
    }
    [["S", 0], ["V", 90], ["J", 180], ["Z", 270]].forEach(([label, deg]) => {
      const rot = document.createElement("div");
      rot.className = "rot";
      rot.style.transform = `rotate(${deg}deg)`;
      const p = document.createElement("p");
      p.className = "cardinal";
      p.textContent = label;
      rot.appendChild(p);
      card.appendChild(rot);
    });
    cfg.stations.forEach((s) => {
      const rot = document.createElement("div");
      rot.className = "rot";
      rot.style.transform = `rotate(${s.bearing}deg)`;
      const m = document.createElement("div");
      m.className = "marker";
      m.textContent = s.key;
      rot.appendChild(m);
      card.appendChild(rot);
      s.markerEl = m;
    });
    $("beam").style.background =
      `conic-gradient(from ${-cfg.beam}deg, rgba(242,163,58,0.20) 0deg ${cfg.beam * 2}deg, transparent ${cfg.beam * 2}deg)`;

    const meter = $("meter");
    for (let i = 0; i < 12; i++) meter.appendChild(document.createElement("span"));

    const levels = $("levels");
    cfg.stations.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="k"></span><span class="n"></span><span class="b"></span><span class="bar"><i></i></span>`;
      li.querySelector(".k").textContent = s.key;
      li.querySelector(".n").textContent = s.name;
      li.querySelector(".b").textContent = `${s.bearing}°`;
      s.barEl = li.querySelector("i");
      levels.appendChild(li);
    });
  }

  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      if (Math.random() < 0.0004) d[i] += (Math.random() * 2 - 1) * 0.8;
    }
    return buf;
  }

  function fallbackTone(gain, i) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 196 * Math.pow(1.5, i);
    const g = ctx.createGain();
    g.gain.value = 0.25;
    osc.connect(g).connect(gain);
    osc.start();
  }

  function setupAudio() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer();
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800;
    band.Q.value = 0.6;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(band).connect(noiseGain).connect(master);
    noise.start();

    cfg.stations.forEach((s, i) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      const el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.playsInline = true;
      let fellBack = false;
      el.addEventListener("error", () => {
        if (fellBack) return;
        fellBack = true;
        fallbackTone(gain, i);
      });
      el.src = s.file;
      ctx.createMediaElementSource(el).connect(gain);
      el.play().catch(() => {});
      voices.push({ station: s, el, gain });
    });
  }

  function onOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
      h = e.webkitCompassHeading;
    } else if (e.alpha != null && (e.absolute || e.type === "deviceorientationabsolute")) {
      h = 360 - e.alpha;
    }
    if (h == null) return;
    const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    h = (h + screenAngle + 360) % 360;
    state.compassSeen = true;
    if (performance.now() > state.manualUntil) state.target = h;
  }

  async function startCompass() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        if (res !== "granted") return false;
      } catch (_) {
        return false;
      }
    }
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", onOrientation);
    } else {
      window.addEventListener("deviceorientation", onOrientation);
    }
    return true;
  }

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (_) {}
  }

  function frame() {
    const tx = Math.cos(state.target * rad);
    const ty = Math.sin(state.target * rad);
    state.sx += (tx - state.sx) * 0.15;
    state.sy += (ty - state.sy) * 0.15;
    state.heading = (Math.atan2(state.sy, state.sx) / rad + 360) % 360;
    const h = state.heading;

    $("card").style.transform = `rotate(${-h}deg)`;
    $("heading").textContent = String(Math.round(h) % 360).padStart(3, "0") + "°";

    let best = null;
    let bestGain = 0;
    cfg.stations.forEach((s) => {
      const g = gainFor(angleDiff(h, s.bearing));
      s.gain = g;
      if (g > bestGain) { bestGain = g; best = s; }
      s.markerEl.classList.toggle("on", g > 0.1);
      s.barEl.style.width = `${Math.round(g * 100)}%`;
    });

    const onAir = best && bestGain > 0.1;
    const station = $("station");
    station.textContent = onAir ? best.name : "· · · šum · · ·";
    station.classList.toggle("off", !onAir);
    $("file").textContent = onAir ? best.file : "mezi stanicemi";
    $("noise").textContent = Math.round((1 - bestGain) * 100);
    const lit = Math.round(bestGain * 12);
    [...$("meter").children].forEach((el, i) => el.classList.toggle("on", i < lit));

    const manual = performance.now() <= state.manualUntil;
    const slider = $("manual");
    if (!manual) slider.value = Math.round(h) % 360;
    $("source").textContent = manual ? "ruční" : state.compassSeen ? "kompas" : state.denied ? "kompas nepovolen" : "čekám na kompas…";

    if (ctx) {
      const t = ctx.currentTime;
      voices.forEach((v) => v.gain.gain.setTargetAtTime(v.station.gain, t, 0.08));
      const flutter = 0.85 + Math.random() * 0.3;
      noiseGain.gain.setTargetAtTime((cfg.noiseFloor + cfg.noiseLevel * (1 - bestGain)) * flutter, t, 0.05);
      master.gain.setTargetAtTime(state.muted ? 0 : 1, t, 0.05);
    }

    requestAnimationFrame(frame);
  }

  $("start").addEventListener("click", async () => {
    setupAudio();
    const compassPromise = startCompass();
    ctx.resume();
    $("intro").hidden = true;
    $("tuner").hidden = false;
    keepAwake();
    const ok = await compassPromise;
    if (!ok) state.denied = true;
  });

  $("manual").addEventListener("input", (e) => {
    state.manualUntil = performance.now() + (state.compassSeen ? 4000 : Infinity);
    state.target = Number(e.target.value);
  });

  $("mute").addEventListener("click", (e) => {
    state.muted = !state.muted;
    e.currentTarget.setAttribute("aria-pressed", String(state.muted));
    e.currentTarget.setAttribute("aria-label", state.muted ? "Zapnout zvuk" : "Ztlumit");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !ctx) return;
    ctx.resume();
    voices.forEach((v) => v.el.play().catch(() => {}));
    keepAwake();
  });

  buildDial();
  requestAnimationFrame(frame);
})();
