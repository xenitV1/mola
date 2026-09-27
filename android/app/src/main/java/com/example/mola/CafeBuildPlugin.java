package com.example.mola;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Build variant owns ad identity. Debug and Console draft builds use test units. */
@CapacitorPlugin(name = "CafeBuild")
public class CafeBuildPlugin extends Plugin {
    @PluginMethod
    public void markReady(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).markCafeReady();
        }
        call.resolve();
    }

    @PluginMethod
    public void getAdConfiguration(PluginCall call) {
        JSObject rewards = new JSObject();
        rewards.put("coins", BuildConfig.ADMOB_REWARDED_COINS);
        rewards.put("tips", BuildConfig.ADMOB_REWARDED_TIPS);
        rewards.put("stock", BuildConfig.ADMOB_REWARDED_STOCK);
        JSObject result = new JSObject();
        result.put("test", BuildConfig.ADMOB_TEST);
        result.put("appId", BuildConfig.ADMOB_APP_ID);
        result.put("rewarded", rewards);
        result.put("interstitial", BuildConfig.ADMOB_INTERSTITIAL);
        call.resolve(result);
    }
}
