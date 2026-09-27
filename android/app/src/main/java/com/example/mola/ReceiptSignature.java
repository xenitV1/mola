package com.example.mola;

import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/** A server-signed receipt is required; game saves cannot grant paid ownership. */
public final class ReceiptSignature {
    private ReceiptSignature() {}
    public static boolean verify(byte[] publicKey, byte[] payload, byte[] signature) {
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicKey)));
            verifier.update(payload);
            return verifier.verify(signature);
        } catch (Exception invalid) { return false; }
    }
}
