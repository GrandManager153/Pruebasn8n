import { create } from 'zustand';

const useDashboardStore = create((set, get) => ({
  // ── Data ──
  data: null,
  loading: true,
  error: null,
  lastUpdate: null,

  // ── UI State ──
  theme: localStorage.getItem('bos-theme') || 'dark',
  syncing: false,

  // ── Actions ──
  setData: (data) =>
    set({
      data,
      loading: false,
      error: null,
      lastUpdate: new Date(),
    }),

  setError: (error) =>
    set({ error, loading: false }),

  setLoading: (loading) =>
    set({ loading }),

  setSyncing: (syncing) =>
    set({ syncing }),

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('bos-theme', next);
    if (next === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    set({ theme: next });
  },

  // ── Fetch Dashboard Data ──
  fetchDashboard: async () => {
    try {
      set({ syncing: true });
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // The full BOS data comes from the webhook stored payload
      // Try fetching the latest webhook data
      const webhookRes = await fetch('/api/logs');
      const logs = await webhookRes.json();

      // Find the latest webhook POST with BOS data
      const bosLog = logs.find(
        (l) => l.method === 'POST' && l.body && (l.body.system || l.body.operations)
      );

      if (bosLog && bosLog.body) {
        set({
          data: bosLog.body,
          loading: false,
          error: null,
          lastUpdate: new Date(),
          syncing: false,
        });
      } else {
        // Use API status data as fallback
        set({
          data: json,
          loading: false,
          error: null,
          lastUpdate: new Date(),
          syncing: false,
        });
      }
    } catch (err) {
      set({
        error: err.message,
        loading: false,
        syncing: false,
      });
    }
  },
}));

export default useDashboardStore;
