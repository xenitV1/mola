package com.example.mola;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.UUID;

@CapacitorPlugin(name = "CafeReviewAccess")
public class CafeReviewAccessPlugin extends Plugin {
    private SharedPreferences prefs;

    @Override public void load() {
        prefs = getContext().getSharedPreferences("mola_review_access", Context.MODE_PRIVATE);
    }

    private JSObject state() {
        boolean available = ReviewAccessCode.configured(BuildConfig.REVIEW_ACCESS_SHA256);
        String grantId = prefs.getString("grantId", "");
        long activatedAt = prefs.getLong("activatedAt", 0);
        boolean active = available && prefs.getBoolean("active", false)
            && BuildConfig.REVIEW_ACCESS_SHA256.equals(prefs.getString("credentialDigest", ""))
            && grantId.matches("review:[a-f0-9-]{36}") && activatedAt > 0;
        JSObject result = new JSObject();
        result.put("available", available); result.put("active", active);
        result.put("activatedAt", activatedAt); result.put("grantId", grantId);
        return result;
    }

    @PluginMethod public synchronized void getCached(PluginCall call) { call.resolve(state()); }

    @PluginMethod public synchronized void activate(PluginCall call) {
        boolean accepted = ReviewAccessCode.matches(call.getString("code", ""), BuildConfig.REVIEW_ACCESS_SHA256);
        if (accepted) {
            String grantId = prefs.getString("grantId", "");
            long activatedAt = prefs.getLong("activatedAt", 0);
            if (grantId.isEmpty()) grantId = "review:" + UUID.randomUUID();
            if (activatedAt <= 0) activatedAt = System.currentTimeMillis();
            accepted = prefs.edit().putString("grantId", grantId).putLong("activatedAt", activatedAt)
                .putString("credentialDigest", BuildConfig.REVIEW_ACCESS_SHA256).putBoolean("active", true).commit();
        }
        JSObject result = new JSObject(); result.put("accepted", accepted); result.put("state", state());
        call.resolve(result);
    }

    @PluginMethod public synchronized void disable(PluginCall call) {
        if (!prefs.edit().putBoolean("active", false).commit()) { call.reject("Review access could not be saved."); return; }
        call.resolve(state());
    }
}
