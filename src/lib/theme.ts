export interface ThemePalette {
  name: string;
  key: string;
  primary: string;
  primary50: string;
  primary100: string;
  primary200: string;
  primary300: string;
  primary400: string;
  primary500: string;
  primary600: string;
  primary700: string;
  primary800: string;
  primary900: string;
  primaryContainer: string;
}

export const themes: Record<string, ThemePalette> = {
  purple: {
    name: 'Playful Purple 💜',
    key: 'purple',
    primary: '#5e3bdb',
    primary50: '#f0f4ff',
    primary100: '#dbe4ff',
    primary200: '#bac8ff',
    primary300: '#91a7ff',
    primary400: '#748ffc',
    primary500: '#5c7cfa',
    primary600: '#4c6ef5',
    primary700: '#4263eb',
    primary800: '#3b5bdb',
    primary900: '#364fc7',
    primaryContainer: '#e6deff',
  },
  blue: {
    name: 'Bright Blue 💙',
    key: 'blue',
    primary: '#2563eb',
    primary50: '#eff6ff',
    primary100: '#dbeafe',
    primary200: '#bfdbfe',
    primary300: '#93c5fd',
    primary400: '#60a5fa',
    primary500: '#3b82f6',
    primary600: '#2563eb',
    primary700: '#1d4ed8',
    primary800: '#1e40af',
    primary900: '#1e3a8a',
    primaryContainer: '#dbeafe',
  },
  green: {
    name: 'Forest Green 💚',
    key: 'green',
    primary: '#16a34a',
    primary50: '#f0fdf4',
    primary100: '#dcfce7',
    primary200: '#bbf7d0',
    primary300: '#86efac',
    primary400: '#4ade80',
    primary500: '#22c55e',
    primary600: '#16a34a',
    primary700: '#15803d',
    primary800: '#166534',
    primary900: '#14532d',
    primaryContainer: '#dcfce7',
  },
  orange: {
    name: 'Sweet Orange 🧡',
    key: 'orange',
    primary: '#ea580c',
    primary50: '#fff7ed',
    primary100: '#ffedd5',
    primary200: '#fed7aa',
    primary300: '#fdbb74',
    primary400: '#fb923c',
    primary500: '#f97316',
    primary600: '#ea580c',
    primary700: '#c2410c',
    primary800: '#9a3412',
    primary900: '#7c2d12',
    primaryContainer: '#ffedd5',
  },
  rose: {
    name: 'Lovely Rose 💖',
    key: 'rose',
    primary: '#e11d48',
    primary50: '#fff1f2',
    primary100: '#ffe4e6',
    primary200: '#fecdd3',
    primary300: '#fda4af',
    primary400: '#fb7185',
    primary500: '#f43f5e',
    primary600: '#e11d48',
    primary700: '#be123c',
    primary800: '#9f1239',
    primary900: '#881337',
    primaryContainer: '#ffe4e6',
  },
  teal: {
    name: 'Magical Teal 🧪',
    key: 'teal',
    primary: '#0d9488',
    primary50: '#f0fdfa',
    primary100: '#ccfbf1',
    primary200: '#99f6e4',
    primary300: '#5eead4',
    primary400: '#2dd4bf',
    primary500: '#14b8a6',
    primary600: '#0d9488',
    primary700: '#0f766e',
    primary800: '#115e59',
    primary900: '#134e4a',
    primaryContainer: '#ccfbf1',
  }
};

export function applyTheme(themeName: string) {
  const selectedTheme = themes[themeName] || themes.purple;
  const root = document.documentElement;
  
  root.style.setProperty('--color-primary', selectedTheme.primary);
  root.style.setProperty('--color-primary-50', selectedTheme.primary50);
  root.style.setProperty('--color-primary-100', selectedTheme.primary100);
  root.style.setProperty('--color-primary-200', selectedTheme.primary200);
  root.style.setProperty('--color-primary-300', selectedTheme.primary300);
  root.style.setProperty('--color-primary-400', selectedTheme.primary400);
  root.style.setProperty('--color-primary-500', selectedTheme.primary500);
  root.style.setProperty('--color-primary-600', selectedTheme.primary600);
  root.style.setProperty('--color-primary-700', selectedTheme.primary700);
  root.style.setProperty('--color-primary-800', selectedTheme.primary800);
  root.style.setProperty('--color-primary-900', selectedTheme.primary900);
  root.style.setProperty('--color-primary-container', selectedTheme.primaryContainer);
}

export function getSavedTheme(userId?: string | null): string {
  if (userId) {
    return localStorage.getItem(`quizlee_theme_${userId}`) || 'purple';
  }
  return 'blue';
}

export function saveTheme(themeName: string, userId?: string | null) {
  if (userId) {
    localStorage.setItem(`quizlee_theme_${userId}`, themeName);
  } else {
    localStorage.setItem('quizlee_theme', themeName);
  }
  applyTheme(themeName);
}
