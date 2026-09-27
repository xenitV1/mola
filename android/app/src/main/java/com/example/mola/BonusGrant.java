package com.example.mola;

/** Pure receipt-field validation. Caller must verify the receipt signature first. */
final class BonusGrant {
    static final long GOLD = 50000;
    static final long LEGACY_GOLD = 300000;
    static boolean openedForPurchase(long openedAt, long purchaseAt) {
        return openedAt > 0 && purchaseAt >= openedAt;
    }
    static String id(String product, String hash, boolean eligible, long amount) {
        return "lifetime_no_ads".equals(product) && eligible && (amount == GOLD || amount == LEGACY_GOLD)
            && hash != null && hash.matches("[a-f0-9]{64}") ? "lifetime_no_ads:" + hash : "";
    }
    static String offerKey(String token) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder("bonus_offer:");
            for (byte value : digest) key.append(Integer.toHexString((value & 255) + 256).substring(1));
            return key.toString();
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
