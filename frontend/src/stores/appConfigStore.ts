import { create } from 'zustand';
import apiClient from '../api/client';

interface AppConfigState {
  title: string;
  slogan: string;
  paperWidth: string;
  loadConfig: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  title: 'Laundry Pesantren',
  slogan: 'Sistem Pelacak Cucian',
  paperWidth: '80',
  loadConfig: async () => {
    try {
      const res = await apiClient.get('/settings');
      const t = res.data.APP_TITLE?.trim();
      const s = res.data.APP_SLOGAN?.trim();
      const pw = res.data.PAPER_WIDTH?.trim();
      set({
        title: t || 'Laundry Pesantren',
        slogan: s || 'Sistem Pelacak Cucian',
        paperWidth: pw || '80',
      });
    } catch {}
  },
}));
