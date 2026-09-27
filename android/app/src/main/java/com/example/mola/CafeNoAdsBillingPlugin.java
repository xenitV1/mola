package com.example.mola;

import com.getcapacitor.annotation.CapacitorPlugin;

/** Full Unlock includes ad removal and offline management. */
@CapacitorPlugin(name = "CafeNoAdsBilling")
public class CafeNoAdsBillingPlugin extends CafeBillingPlugin {
    @Override protected String productId() { return BuildConfig.BILLING_NO_ADS_PRODUCT_ID; }
    @Override protected String preferenceName() { return "cafe_no_ads_billing"; }
    @Override protected String verificationUrl() { return BuildConfig.BILLING_NO_ADS_VERIFICATION_URL; }
}
