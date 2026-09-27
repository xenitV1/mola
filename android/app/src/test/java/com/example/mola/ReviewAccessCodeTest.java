package com.example.mola;

import org.junit.Test;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import static org.junit.Assert.*;

public class ReviewAccessCodeTest {
    private static final String CODE = "abcdef0123456789abcdef0123456789";
    private String digest() throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(CODE.getBytes(StandardCharsets.UTF_8))) result.append(String.format(Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }
    @Test public void acceptsOnlyMatchingCodeAndNormalizesPastedWhitespace() throws Exception {
        assertTrue(ReviewAccessCode.matches(CODE, digest()));
        assertTrue(ReviewAccessCode.matches(" " + CODE.toUpperCase(Locale.ROOT) + "\n", digest()));
        assertFalse(ReviewAccessCode.matches("0" + CODE.substring(1), digest()));
    }
    @Test public void missingConfigurationAndMalformedInputNeverAuthorize() throws Exception {
        assertFalse(ReviewAccessCode.matches(CODE, ""));
        assertFalse(ReviewAccessCode.matches(CODE, "not-a-digest"));
        assertFalse(ReviewAccessCode.matches(null, digest()));
        assertFalse(ReviewAccessCode.matches("", digest()));
        assertFalse(ReviewAccessCode.matches(CODE + CODE, digest()));
        assertFalse(ReviewAccessCode.matches(" ".repeat(129), digest()));
    }
}
