import client from '../api/client';
import { BillingStatus } from '../types/billing';

export const billingService = {
  getStatus: async (): Promise<BillingStatus> => {
    const response = await client.get<BillingStatus>('/api/v1/billing/status/');
    return response.data;
  },
};
