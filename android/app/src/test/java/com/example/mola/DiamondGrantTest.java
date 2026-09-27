package com.example.mola;
import org.junit.Test;
import static org.junit.Assert.*;
public class DiamondGrantTest {
 @Test public void grantsRequireExactKnownPackAndReceiptHash(){String hash="a".repeat(64);for(String sku:DiamondGrant.PRODUCTS){assertEquals("diamonds:"+hash,DiamondGrant.id(sku,hash,DiamondGrant.amount(sku)));assertEquals("",DiamondGrant.id(sku,hash,DiamondGrant.amount(sku)+1));}assertEquals("",DiamondGrant.id("lifetime_no_ads",hash,300000));assertEquals("",DiamondGrant.id("diamonds_100","invented",100));}
 @Test public void changedPriceOrCurrencyCannotSilentlyOpenCheckout(){assertTrue(DiamondGrant.samePrice("$4.99","USD",4990000,"$4.99","USD",4990000));assertFalse(DiamondGrant.samePrice("$4.99","USD",4990000,"$5.99","USD",5990000));assertFalse(DiamondGrant.samePrice("$4.99","USD",4990000,"$4.99","CAD",4990000));assertFalse(DiamondGrant.samePrice("","USD",0,"","USD",0));}
}
