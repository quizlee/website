export const avatarPresets: Record<string, string> = {
  // Animals
  fox: '🦊',
  panda: '🐼',
  lion: '🦁',
  koala: '🐨',
  tiger: '🐯',
  rabbit: '🐰',
  bear: '🐻',
  frog: '🐸',
  monkey: '🐵',
  unicorn: '🦄',
  owl: '🦉',
  octopus: '🐙',
  cat: '🐱',
  dog: '🐶',
  penguin: '🐧',
  chick: '🐥',
  turtle: '🐢',
  dino: '🦖',
  dragon: '🐉',
  dolphin: '🐬',
  butterfly: '🦋',
  bee: '🐝',
  hamster: '🐹',
  mouse: '🐭',
  pig: '🐷',
  wolf: '🐺',
  gorilla: '🦍',
  elephant: '🐘',
  whale: '🐳',
  shark: '🦈',

  // Peoples & Roles
  ninja: '🥷',
  wizard: '🧙',
  superhero: '🦸',
  detective: '🕵️',
  astronaut: '🧑‍🚀',
  scientist: '🧑‍🔬',
  scholar: '🧑‍🎓',
  coder: '🧑‍💻',
  artist: '🧑‍🎨',
  police: '👮',
  firefighter: '🧑‍🚒',
  pilot: '🧑‍✈️',
  farmer: '🧑‍🌾',
  cook: '🧑‍🍳',
  prince: '🤴',
  princess: '👸',

  // Robots & Creatures
  robot: '🤖',
  alien: '👽',
  ghost: '👻',
  monster: '👾',
  ogre: '👹',
  goblin: '👺',
  clown: '🤡',
  vampire: '🧛',
  zombie: '🧟',
  elf: '🧝',
  genie: '🧞',
  mermaid: '🧜',
  fairy: '🧚',

  // Emotions & Smileys
  cool: '😎',
  starstruck: '🤩',
  laughing: '😆',
  nerd: '🤓',
  silly: '🤪',
  thinking: '🤔',
  wink: '😉',
  happy: '😊',
  love: '🥰',
  surprised: '😮',
};

export const avatarBgColors = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
];

export interface ParsedAvatar {
  type: 'image' | 'preset';
  url?: string;
  presetKey?: string;
  bgColor?: string;
}

export function parseAvatar(avatarUrl: string | null): ParsedAvatar {
  if (!avatarUrl) {
    return { type: 'image' };
  }
  if (avatarUrl.startsWith('preset:')) {
    const parts = avatarUrl.split(':');
    return {
      type: 'preset',
      presetKey: parts[1] || 'fox',
      bgColor: parts[2] || '#6366f1',
    };
  }
  return {
    type: 'image',
    url: avatarUrl,
  };
}

export function adjustColorShade(hex: string, intensity: number): string {
  const factor = 0.15 + (intensity / 100) * 0.85;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const blendedR = Math.round(r * factor + 255 * (1 - factor));
  const blendedG = Math.round(g * factor + 255 * (1 - factor));
  const blendedB = Math.round(b * factor + 255 * (1 - factor));

  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(blendedR)}${toHex(blendedG)}${toHex(blendedB)}`;
}

export function parseColorShade(hex: string): { baseColor: string; intensity: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  let bestBaseColor = avatarBgColors[0];
  let bestIntensity = 100;
  let minError = Infinity;

  for (const baseColor of avatarBgColors) {
    const br = parseInt(baseColor.slice(1, 3), 16);
    const bg = parseInt(baseColor.slice(3, 5), 16);
    const bb = parseInt(baseColor.slice(5, 7), 16);

    const xr = 255 - br;
    const xg = 255 - bg;
    const xb = 255 - bb;

    const yr = 255 - r;
    const yg = 255 - g;
    const yb = 255 - b;

    const numerator = xr * yr + xg * yg + xb * yb;
    const denominator = xr * xr + xg * xg + xb * xb;

    let f = denominator === 0 ? 1 : numerator / denominator;
    f = Math.max(0.15, Math.min(1.0, f));

    const err =
      (f * br + 255 * (1 - f) - r) ** 2 +
      (f * bg + 255 * (1 - f) - g) ** 2 +
      (f * bb + 255 * (1 - f) - b) ** 2;

    if (err < minError) {
      minError = err;
      bestBaseColor = baseColor;
      bestIntensity = Math.round(((f - 0.15) / 0.85) * 100);
    }
  }

  return { baseColor: bestBaseColor, intensity: bestIntensity };
}

export const avatarPresetLevels: Record<string, number> = {
  // 5 simple emojis free (Level 1)
  fox: 1,
  panda: 1,
  cat: 1,
  dog: 1,
  happy: 1,

  // Level 10 unlockable emojis
  lion: 10,
  koala: 10,
  tiger: 10,
  rabbit: 10,
  bear: 10,
  frog: 10,
  monkey: 10,
  owl: 10,
  octopus: 10,
  penguin: 10,
  chick: 10,
  turtle: 10,
  butterfly: 10,
  bee: 10,
  hamster: 10,
  mouse: 10,
  pig: 10,
  wink: 10,
  laughing: 10,
  love: 10,

  // Level 25 unlockable emojis
  dino: 25,
  dragon: 25,
  dolphin: 25,
  wolf: 25,
  gorilla: 25,
  elephant: 25,
  whale: 25,
  shark: 25,
  ninja: 25,
  detective: 25,
  police: 25,
  firefighter: 25,
  pilot: 25,
  farmer: 25,
  cook: 25,
  cool: 25,
  nerd: 25,
  thinking: 25,
  surprised: 25,

  // Level 50 unlockable emojis
  unicorn: 50,
  wizard: 50,
  superhero: 50,
  astronaut: 50,
  scientist: 50,
  scholar: 50,
  coder: 50,
  artist: 50,
  prince: 50,
  princess: 50,
  robot: 50,
  alien: 50,
  ghost: 50,
  monster: 50,
  ogre: 50,
  goblin: 50,
  clown: 50,
  vampire: 50,
  zombie: 50,
  elf: 50,
  genie: 50,
  mermaid: 50,
  fairy: 50,
  starstruck: 50,
  silly: 50,
};
