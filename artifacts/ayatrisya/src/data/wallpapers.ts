const palettes = [
  ["071a2b","176b87","71d9c7"], ["180d32","6039a5","ed8fa7"], ["101a40","3366b4","80d6ff"],
  ["261029","9a3f64","f6b56c"], ["0d2924","1a8468","a7e6a1"], ["2b1724","bd5745","ffd087"],
  ["14192b","4757a8","c3a5ff"], ["202332","6c718c","d7dcf1"], ["13252d","378b9a","b2e9e3"],
  ["2a163d","a04eb8","f5b3d7"], ["251d12","8d6336","e9c78b"], ["121d34","168eaa","b2edff"],
  ["231634","6f4fbe","7ce6d3"], ["211a30","d15b75","ffcb8a"],
];

const names = [
  "Blue hour", "Orchid dusk", "Deep current", "Ember bloom", "Forest glass", "Copper clouds",
  "Violet atlas", "Silver haze", "Tidal glow", "Neon garden", "Desert silk", "Arctic drift",
  "Prism field", "Solar veil",
];

function makeArtwork(index: number, colors: string[]) {
  const [dark, mid, light] = colors;
  const variant = index % 5;
  const offset = (index * 37) % 100;
  const shapes = variant === 0
    ? `<circle cx="${18 + offset / 2}" cy="22" r="48" fill="url(#glow)" opacity=".82"/><circle cx="${88 - offset / 3}" cy="98" r="56" fill="url(#glow)" opacity=".44"/>`
    : variant === 1
      ? `<path d="M0 ${42 + offset / 4} Q30 4 60 ${42 + offset / 5} T120 ${35 + offset / 3} V120 H0Z" fill="url(#glow)" opacity=".65"/><path d="M0 72 Q34 32 67 72 T120 62 V120 H0Z" fill="${light}" opacity=".32"/>`
      : variant === 2
        ? `<g fill="none" stroke="url(#glow)" stroke-width="1.2" opacity=".58">${Array.from({ length: 9 }, (_, n) => `<ellipse cx="${50 + offset / 8}" cy="${54 + offset / 10}" rx="${16 + n * 8}" ry="${8 + n * 5}" transform="rotate(${n * 8} 60 60)"/>`).join("")}</g>`
        : variant === 3
          ? `<g fill="url(#glow)" opacity=".72"><circle cx="24" cy="32" r="26"/><circle cx="84" cy="28" r="39"/><circle cx="62" cy="92" r="44"/></g>`
          : `<path d="M-8 95 C18 50 38 116 60 68 S100 28 128 8" fill="none" stroke="url(#glow)" stroke-width="22" opacity=".45"/><path d="M-8 112 C18 66 40 128 62 84 S100 42 128 22" fill="none" stroke="${light}" stroke-width="2" opacity=".76"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#${dark}"/><stop offset="1" stop-color="#${mid}"/></linearGradient><radialGradient id="glow"><stop stop-color="#${light}"/><stop offset="1" stop-color="#${mid}" stop-opacity=".05"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="13"/></filter></defs><rect width="120" height="120" fill="url(#base)"/><g filter="url(#blur)" opacity=".68"><circle cx="${offset}" cy="12" r="42" fill="#${light}"/><circle cx="${100 - offset / 3}" cy="108" r="48" fill="#${mid}"/></g>${shapes}<rect width="120" height="120" fill="none" stroke="#ffffff" stroke-opacity=".12"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const wallpapers = Array.from({ length: 70 }, (_, index) => {
  const paletteIndex = Math.floor(index / 5);
  return {
    id: `preset-${index}`,
    name: `${names[paletteIndex]} ${["Horizon", "Tides", "Contour", "Bloom", "Motion"][index % 5]}`,
    src: makeArtwork(index, palettes[paletteIndex]),
  };
});
