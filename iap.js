/**
 * CYBERPUMP In-App Purchase Manager (RevenueCat Integration)
 * Compatibilità diretta Browser/Capacitor (No bundler / JS nativo)
 */

class InAppPurchaseManager {
  constructor() {
    this.apiKeyGoogle = "goog_ePQranNvotDalvuqQjTmsCWyNoQ";
    this.apiKeyApple = "appl_PLACEHOLDER_KEY_IOS"; // Riservato per futuro build iOS
    this.entitlementId = "cyberpump_premium";
    this.initialized = false;
  }

  /**
   * Getter dinamico e sicuro per accedere al plugin Purchases di Capacitor
   */
  get Purchases() {
    return window.Capacitor?.Plugins?.Purchases || null;
  }

  /**
   * Inizializza l'SDK RevenueCat e imposta i listener di stato
   */
  async init() {
    if (this.initialized) return;

    const Purchases = this.Purchases;
    if (!Purchases) {
      console.warn("⚠️ [IAP] Plugin Purchases non trovato in window.Capacitor.Plugins.");
      return;
    }

    try {
      const platform = window.Capacitor ? window.Capacitor.getPlatform() : 'web';
      const apiKey = platform === 'ios' ? this.apiKeyApple : this.apiKeyGoogle;

      // Configurazione SDK
      await Purchases.configure({ apiKey });
      this.initialized = true;
      console.log(`⚡ [IAP] RevenueCat SDK Inizializzato con successo su ${platform}!`);

      // 1. Listener automatico per cambi di stato in tempo reale (rinnovi, acquisti, scadenze)
      Purchases.addCustomerInfoUpdateListener((response) => {
        console.log("🔄 [IAP] Aggiornamento CustomerInfo ricevuto in tempo reale.");
        this._processCustomerInfo(response);
      });

      // 2. Controllo iniziale dello stato abbonamento
      await this.checkSubscriptionStatus();
    } catch (error) {
      console.error("❌ [IAP] Errore durante l'inizializzazione:", error);
    }
  }

  /**
   * Helper privato: estrae in modo sicuro l'oggetto CustomerInfo 
   * indipendentemente dal wrapper dell'SDK Capacitor
   */
  _extractCustomerInfo(response) {
    if (!response) return null;
    return response.customerInfo || response;
  }

  /**
   * Helper privato: elabora l'Entitlement e sincronizza il database/storage locale
   */
  _processCustomerInfo(response) {
    const customerInfo = this._extractCustomerInfo(response);
    const activeEntitlements = customerInfo?.entitlements?.active || {};
    const isPremium = typeof activeEntitlements[this.entitlementId] !== "undefined";

    console.log(`👑 [IAP] Stato Entitlement '${this.entitlementId}':`, isPremium ? "ATTIVO" : "NON ATTIVO");

    if (window.storageManager) {
      if (isPremium) {
        window.storageManager.unlockPremium();
      } else {
        window.storageManager.lockPremium();
      }
    }

    return isPremium;
  }

  /**
   * Verifica se l'utente possiede il diritto Premium sul server di Google Play / RevenueCat
   */
  async checkSubscriptionStatus() {
    if (!this.initialized || !this.Purchases) return false;

    try {
      const response = await this.Purchases.getCustomerInfo();
      return this._processCustomerInfo(response);
    } catch (error) {
      console.error("❌ [IAP] Errore durante la verifica abbonamento:", error);
      return false;
    }
  }

  /**
   * Avvia il flusso di acquisto nativo aprendo lo sheet di Google Play Store
   */
  async buyPremium() {
    if (!this.initialized || !this.Purchases) {
      alert("Gli acquisti In-App sono disponibili solo sull'App nativa installata su dispositivo Android o emulatore.");
      return;
    }

    const Purchases = this.Purchases;

    try {
      const offerings = await Purchases.getOfferings();

      if (offerings?.current && offerings.current.availablePackages?.length > 0) {
        const packageToBuy = offerings.current.availablePackages[0];
        
        console.log("🛒 [IAP] Avvio acquisto pacchetto:", packageToBuy.identifier);

        // Apre la scheda di acquisto nativa di Google Play Store
        const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToBuy });
        const isPremium = this._processCustomerInfo(purchaseResult);

        if (isPremium) {
          this.handleSuccessfulPurchase();
        }
      } else {
        alert("Nessun pacchetto di acquisto trovato su Google Play. Assicurati che il prodotto sia stato associato all'Offering 'Standard' su RevenueCat.");
      }
    } catch (error) {
      const errorMsg = String(error?.message || JSON.stringify(error) || '').toLowerCase();
      const errorCode = error?.code;

      // Intercetta se l'utente possiede già il prodotto su Google Play
      if (errorMsg.includes("already own") || errorMsg.includes("item_already_owned") || errorCode === 7) {
        console.log("👑 [IAP] Prodotto già posseduto su Google Play. Sblocco Premium automatico!");
        this.handleSuccessfulPurchase();
        return;
      }

      // Gestisce l'annullamento volontario da parte dell'utente senza mostrare errori fastidiosi
      if (!error?.userCancelled) {
        console.error("❌ [IAP] Errore transazione:", error);
        alert("Errore durante la transazione: " + (error?.message || "Impossibile completare l'operazione."));
      }
    }
  }

  /**
   * Ripristina gli acquisti precedenti (Richiesto dalle linee guida dello Store)
   */
  async restorePurchases() {
    if (!this.initialized || !this.Purchases) {
      alert("IAP non ancora inizializzato.");
      return;
    }

    try {
      console.log("🔄 [IAP] Avvio ripristino acquisti...");
      const restoredResponse = await Purchases.restorePurchases();
      const isPremium = this._processCustomerInfo(restoredResponse);

      if (isPremium) {
        alert("Acquisti ripristinati con successo!");
        this.handleSuccessfulPurchase();
      } else {
        alert("Nessun acquisto attivo trovato per questo account Google.");
      }
    } catch (error) {
      console.error("❌ [IAP] Errore ripristino:", error);
      alert("Errore durante il ripristino degli acquisti: " + (error?.message || "Riprova più tardi."));
    }
  }

  /**
   * Aggiorna lo stato dell'applicazione e l'interfaccia utente a transazione avvenuta
   */
  handleSuccessfulPurchase() {
    if (window.storageManager) {
      window.storageManager.unlockPremium();
    }

    if (window.cyberPumpApp) {
      if (typeof window.cyberPumpApp.closeModal === 'function') {
        window.cyberPumpApp.closeModal();
      }
      if (typeof window.cyberPumpApp.showToast === 'function') {
        window.cyberPumpApp.showToast("🎉 CYBERPUMP Premium Unlocked!");
      }
      if (typeof window.cyberPumpApp.switchView === 'function') {
        window.cyberPumpApp.switchView(window.cyberPumpApp.currentView);
      }
    } else {
      window.location.reload();
    }
  }
}

// Istanziazione nel contesto globale window
window.iapManager = new InAppPurchaseManager();

// Inizializzazione sicura al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
  window.iapManager.init();
});