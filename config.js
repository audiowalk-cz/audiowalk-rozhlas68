window.ROZHLAS_BUILD = "__BUILD__";
window.ROZHLAS_CONFIG = {
  beam: 35,
  noiseLevel: 0.22,
  noiseFloor: 0.02,
  radio: {
    min: 65.8,
    max: 74.0,
    start: 69.0,
    bandwidth: 0.35,
    mhzPerTurn: 1.5,
  },
  stations: [
    { key: "A", name: "Co se stalo?", file: "audio/stanice-a.mp3", bearing: 40, freq: 66.9 },
    { key: "B", name: "Letáky a prádlo", file: "audio/stanice-b.mp3", bearing: 130, freq: 68.6 },
    { key: "C", name: "Ty jsi tam byl taky?", file: "audio/stanice-c.mp3", bearing: 220, freq: 70.8 },
    { key: "D", name: "Škola života", file: "audio/stanice-d.mp3", bearing: 310, freq: 72.9 },
  ],
};
