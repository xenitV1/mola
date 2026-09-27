package com.example.mola;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

final class ReviewAccessCode {
    static boolean configured(String digest) { return digest != null && digest.matches("[a-f0-9]{64}"); }

    static boolean matches(String code, String digest) {
        if (code == null || code.length() > 128 || !configured(digest)) return false;
        String normalized = code.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-f0-9]{32}")) return false;
        try {
            byte[] expected = new byte[32];
            for (int i = 0; i < expected.length; i++) expected[i] = (byte) Integer.parseInt(digest.substring(i * 2, i * 2 + 2), 16);
            return MessageDigest.isEqual(expected, MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception invalid) { return false; }
    }
}
