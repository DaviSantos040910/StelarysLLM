import { create } from 'zustand';
import { billingService } from '../services/billingService';
import { BillingStatus } from '../types/billing';

interface BillingState {
  status: BillingStatus | null;
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  reset: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  status: null,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await billingService.getStatus();
      set({ status, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch billing status',
        isLoading: false
      });
      console.error('[BillingStore] Fetch failed:', error);
    }
  },

  reset: () => {
    set({ status: null, error: null, isLoading: false });
  }
}));
