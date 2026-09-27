package com.example.mola;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private volatile boolean cafeReady = false;

    public void markCafeReady() { cafeReady = true; }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        long openedAt = SystemClock.uptimeMillis();
        registerPlugin(CafeBuildPlugin.class);
        registerPlugin(CafeBillingPlugin.class);
        registerPlugin(CafeNoAdsBillingPlugin.class);
        registerPlugin(CafeDiamondBillingPlugin.class);
        registerPlugin(CafePlayGamesPlugin.class);
        registerPlugin(CafeReviewAccessPlugin.class);
        super.onCreate(savedInstanceState);
        // Render the brand until the first café frame; never hide a failure forever.
        splash.setKeepOnScreenCondition(() -> !cafeReady && SystemClock.uptimeMillis() - openedAt < 12000);
    }
}
