import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', systemDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    }
  },
}));
