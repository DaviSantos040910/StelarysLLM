import { Platform } from 'react-native';
import {
  initConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getSubscriptions,
  requestSubscription,
  endConnection,
  SubscriptionPurchase,
  ProductPurchase,
  PurchaseError
} from 'react-native-iap';
import { billingService } from './billingService';
import { useBillingStore } from '../stores/billingStore';

// Define SKU
const SKUS = Platform.select({
  android: ['stelarys_basic_monthly'],
  ios: ['stelarys_basic_monthly'], // Assuming same ID for now
  default: ['stelarys_basic_monthly'],
});

class IAPService {
  private purchaseUpdateSubscription: { remove: () => void } | null = null;
  private purchaseErrorSubscription: { remove: () => void } | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      await initConnection();
      this.isInitialized = true;

      this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: SubscriptionPurchase | ProductPurchase) => {
        const receipt = purchase.transactionReceipt;

        if (receipt) {
          try {
            console.log('[IAP] Purchase successful, verifying...', purchase.productId);
            // Verify with backend
            // Note: Android uses purchaseToken, iOS uses transactionReceipt
            const token = purchase.purchaseToken || receipt;
            await billingService.verifyGooglePlayPurchase(purchase.productId, token);

            // Finish transaction ONLY after backend verification
            await finishTransaction({ purchase, isConsumable: false });

            // Refresh billing status
            useBillingStore.getState().fetchStatus();

            console.log('[IAP] Purchase verified and finished');
          } catch (error) {
            console.error('[IAP] Verification failed', error);
          }
        }
      });

      this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
        console.warn('[IAP] Purchase error', error);
      });

    } catch (err) {
      console.error('[IAP] Init error', err);
    }
  }

  async getSubscriptions() {
    try {
      if (!SKUS) return [];
      return await getSubscriptions({ skus: SKUS });
    } catch (err) {
      console.error('[IAP] Get Subscriptions error', err);
      return [];
    }
  }

  async purchaseBasicPlan() {
    try {
      if (!SKUS || SKUS.length === 0) throw new Error("No SKUs configured");
      const sku = SKUS[0];

      // On Android, requestSubscription requires offerToken if available (updated RNIap)
      // We first fetch subs to get offer token
      const subs = await this.getSubscriptions();
      const sub = subs.find((s: any) => s.productId === sku);

      if (!sub) throw new Error("Subscription product not found");

      const offerToken = sub.subscriptionOfferDetails?.[0]?.offerToken;

      return await requestSubscription({
        sku,
        ...(offerToken && { subscriptionOffers: [{ sku, offerToken }] }),
      });
    } catch (err) {
      console.error('[IAP] Request Subscription error', err);
      throw err;
    }
  }

  teardown() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
    endConnection();
    this.isInitialized = false;
  }
}

export const iapService = new IAPService();
