package com.example.mola;
import org.junit.Test;
import static org.junit.Assert.*;
public class BonusGrantTest {
    private static final String HASH = new String(new char[64]).replace('\0', 'a');
    @Test public void oldPurchasesCannotInheritANewerOfferAfterInterruptedFlow() {
        assertFalse(BonusGrant.openedForPurchase(0, 2000));
        assertFalse(BonusGrant.openedForPurchase(2000, 1000));
        assertTrue(BonusGrant.openedForPurchase(2000, 2000));
        assertTrue(BonusGrant.openedForPurchase(2000, 3000));
    }
    @Test public void stableGrantRequiresEligibleNoAdsReceiptWithExactAmount() {
        assertEquals(50000, BonusGrant.GOLD);
        assertEquals("lifetime_no_ads:" + HASH, BonusGrant.id("lifetime_no_ads", HASH, true, 50000));
        assertEquals("lifetime_no_ads:" + HASH, BonusGrant.id("lifetime_no_ads", HASH, true, 300000));
        assertEquals("", BonusGrant.id("offline_cafe_manager", HASH, true, 300000));
        assertEquals("", BonusGrant.id("lifetime_no_ads", HASH, false, 300000));
        assertEquals("", BonusGrant.id("lifetime_no_ads", "untrusted", true, 300000));
        assertEquals("", BonusGrant.id("lifetime_no_ads", HASH, true, 2000000));
    }
    @Test public void offerKeysAreStableTokenHashesAndDoNotExposePurchaseTokens() {
        String token = "private-purchase-token";
        String key = BonusGrant.offerKey(token);
        assertTrue(key.matches("bonus_offer:[a-f0-9]{64}"));
        assertEquals(key, BonusGrant.offerKey(token));
        assertNotEquals(key, BonusGrant.offerKey("another-purchase-token"));
        assertFalse(key.contains(token));
    }
}
