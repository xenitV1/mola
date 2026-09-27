package com.example.mola;

import android.app.Application;
import com.google.android.gms.games.PlayGamesSdk;

public class MolaApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        if (BuildConfig.PLAY_GAMES_CONFIGURED) PlayGamesSdk.initialize(this);
    }
}
