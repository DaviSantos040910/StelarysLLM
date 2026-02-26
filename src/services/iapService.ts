import { billingService } from './billingService';
import { useBillingStore } from '../stores/billingStore';
import { loadIap, isExpoGo } from './iap/nativeIap';
import { PLATFORM_SKUS } from '../config/iap';

class IAPService {
  private purchaseUpdateSubscription: { remove: () => void } | null = null;
  private purchaseErrorSubscription: { remove: () => void } | null = null;
  private isInitialized = false;
  private iapModule: any = null;

  // Expose the reason why IAP is unavailable (e.g., 'expo_go')
  public unavailableReason: string | null = null;

  // Sync check for Expo Go to avoid async overhead on simple checks
  isIapSupported(): boolean {
    return !isExpoGo;
  }

  private async getModule() {
    if (this.iapModule) return this.iapModule;
    const result = await loadIap();

    if (!result.available || !result.module) {
        this.unavailableReason = result.reason || 'unknown';
        throw new Error("IAP_UNAVAILABLE");
    }

    this.iapModule = result.module;
    return this.iapModule;
  }

  async ensureConnected() {
    if (!this.isIapSupported()) {
        console.warn("[IAP] ensureConnected skipped (not supported environment)");
        return false;
    }
    try {
        await this.initialize();
        return true;
    } catch {
        return false;
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    // Fail fast if not supported (sync check)
    if (!this.isIapSupported()) {
        this.unavailableReason = 'expo_go';
        console.log('[IAP] Initialization skipped in Expo Go');
        return;
    }

    try {
      const RNIap = await this.getModule();
      await RNIap.initConnection();
      this.isInitialized = true;

      this.purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: any) => {
        // Purchase (PurchaseAndroid | PurchaseIOS) has transactionReceipt
        const receipt = purchase.transactionReceipt;

        if (receipt) {
          try {
            console.log('[IAP] Purchase successful, verifying...', purchase.productId);
            const token = purchase.purchaseToken || receipt;
            await billingService.verifyGooglePlayPurchase(purchase.productId, token);

            await RNIap.finishTransaction({ purchase, isConsumable: false });
            useBillingStore.getState().fetchStatus();

            console.log('[IAP] Purchase verified and finished');
          } catch (error) {
            console.error('[IAP] Verification failed', error);
          }
        }
      });

      this.purchaseErrorSubscription = RNIap.purchaseErrorListener((error: any) => {
        console.warn('[IAP] Purchase error', error);
      });

    } catch (err: any) {
      if (err.message !== "IAP_UNAVAILABLE") {
          console.error('[IAP] Init error', err);
      } else {
          console.log(`[IAP] Unavailable: ${this.unavailableReason}`);
      }
    }
  }

  async getSubscriptions() {
    try {
      if (!this.isIapSupported()) return [];
      if (!PLATFORM_SKUS) return [];
      const RNIap = await this.getModule();
      return await RNIap.getSubscriptions({ skus: PLATFORM_SKUS });
    } catch (err) {
      console.error('[IAP] Get Subscriptions error', err);
      return [];
    }
  }

  async purchaseBasicPlan() {
    try {
      if (!this.isIapSupported()) throw new Error("IAP_UNAVAILABLE");

      await this.ensureConnected();

      if (!PLATFORM_SKUS || PLATFORM_SKUS.length === 0) throw new Error("No SKUs configured");
      const sku = PLATFORM_SKUS[0];

      const RNIap = await this.getModule();

      // On Android, requestSubscription requires offerToken if available (updated RNIap)
      // We first fetch subs to get offer token
      const subs = await this.getSubscriptions();
      const sub = subs.find((s: any) => s.productId === sku);

      if (!sub) throw new Error("Subscription product not found");

      // Typings might vary, assuming updated library structure for Android offer details
      const offerToken = sub.subscriptionOfferDetails?.[0]?.offerToken;

      return await RNIap.requestSubscription({
        sku,
        ...(offerToken && { subscriptionOffers: [{ sku, offerToken }] }),
      });
    } catch (err: any) {
      if (err.message === "IAP_UNAVAILABLE" || this.unavailableReason) {
          // Use the stored reason for a better message if needed, or fallback
          const msg = (this.unavailableReason === 'expo_go' || !this.isIapSupported())
            ? "Pagamentos indisponíveis no Expo Go. Use um Development Build."
            : "Compras no app não estão disponíveis.";
          alert(msg);
          return;
      }
      console.error('[IAP] Request Subscription error', err);
      throw err;
    }
  }

  async restorePurchases() {
    try {
      if (!this.isIapSupported()) throw new Error("IAP_UNAVAILABLE");

      await this.ensureConnected();

      const RNIap = await this.getModule();
      const purchases = await RNIap.getAvailablePurchases();

      console.log('[IAP] Restoring purchases...', purchases.length);

      for (const purchase of purchases) {
          const token = purchase.purchaseToken || purchase.transactionReceipt;
          if (token) {
              await billingService.verifyGooglePlayPurchase(purchase.productId, token);
          }
      }

      if (purchases.length > 0) {
          useBillingStore.getState().fetchStatus();
      }

      return purchases.length > 0;
    } catch (err: any) {
       if (err.message === "IAP_UNAVAILABLE" || this.unavailableReason) {
          alert("Indisponível no Expo Go.");
          return 0;
       }
      console.warn('[IAP] Restore error', err);
      throw err;
    }
  }

  async teardown() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
    if (this.isInitialized && this.iapModule) {
        try {
            await this.iapModule.endConnection();
        } catch(e) {
            console.warn("[IAP] Error ending connection", e);
        }
    }
    this.isInitialized = false;
  }
}

export const iapService = new IAPService();
