package com.example.mola;
import org.junit.Test;
import static org.junit.Assert.*;
import java.security.*;
import java.nio.charset.StandardCharsets;

public class ReceiptSignatureTest {
    @Test public void acceptsOnlyAnUntamperedReceiptFromTheConfiguredKey() throws Exception {
        KeyPairGenerator generator=KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        KeyPair signer=generator.generateKeyPair(),other=generator.generateKeyPair();
        byte[] payload="explicit-unit-test-receipt".getBytes(StandardCharsets.UTF_8);
        Signature signature=Signature.getInstance("SHA256withRSA");signature.initSign(signer.getPrivate());signature.update(payload);byte[] signed=signature.sign();
        assertTrue(ReceiptSignature.verify(signer.getPublic().getEncoded(),payload,signed));
        assertFalse(ReceiptSignature.verify(other.getPublic().getEncoded(),payload,signed));
        assertFalse(ReceiptSignature.verify(signer.getPublic().getEncoded(),"tampered".getBytes(StandardCharsets.UTF_8),signed));
        assertFalse(ReceiptSignature.verify(new byte[0],payload,signed));
        signed[0]^=1;assertFalse(ReceiptSignature.verify(signer.getPublic().getEncoded(),payload,signed));
    }
}
