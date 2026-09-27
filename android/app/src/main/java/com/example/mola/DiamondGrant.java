package com.example.mola;
/** Only validated signed receipts reach this product/amount contract. */
final class DiamondGrant {
 static final String[] PRODUCTS={"diamonds_100","diamonds_500","diamonds_5000","diamonds_10000"};
 static int amount(String product){switch(product){case "diamonds_100":return 100;case "diamonds_500":return 500;case "diamonds_5000":return 5000;case "diamonds_10000":return 10000;default:return 0;}}
 static boolean samePrice(String shown,String currency,long micros,String fresh,String freshCurrency,long freshMicros){return shown!=null&&!shown.isEmpty()&&shown.equals(fresh)&&currency!=null&&currency.equals(freshCurrency)&&micros>0&&micros==freshMicros;}
 static String id(String product,String hash,int amount){return amount(product)>0&&amount==amount(product)&&hash!=null&&hash.matches("[a-f0-9]{64}")?"diamonds:"+hash:"";}
}
