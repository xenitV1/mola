package com.example.mola;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.games.AnnotatedData;
import com.google.android.gms.games.GamesClientStatusCodes;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PageDirection;
import com.google.android.gms.games.Player;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;
import java.util.LinkedHashMap;

/** Google owns the player identity and native leaderboard. No backend tokens are exposed. */
@CapacitorPlugin(name = "CafePlayGames")
public class CafePlayGamesPlugin extends Plugin {
    private boolean configured(PluginCall call) {
        if (BuildConfig.PLAY_GAMES_CONFIGURED) return true;
        call.reject("Play Games is not configured.", "UNAVAILABLE");
        return false;
    }

    private void signedOut(PluginCall call) {
        JSObject value = new JSObject();
        value.put("authenticated", false);
        call.resolve(value);
    }

    private void resolvePlayer(PluginCall call) {
        PlayGames.getPlayersClient(getActivity()).getCurrentPlayer()
            .addOnSuccessListener(player -> {
                if (player == null) { signedOut(call); return; }
                JSObject value = new JSObject();
                value.put("authenticated", true);
                value.put("playerId", player.getPlayerId());
                value.put("displayName", player.getDisplayName());
                call.resolve(value);
            })
            .addOnFailureListener(error -> call.reject("Could not load Play Games profile.", "PROFILE_UNAVAILABLE"));
    }

    @PluginMethod public void getProfile(PluginCall call) {
        if (!configured(call)) return;
        getActivity().runOnUiThread(() -> PlayGames.getGamesSignInClient(getActivity()).isAuthenticated()
            .addOnSuccessListener(result -> {
                if (result.isAuthenticated()) resolvePlayer(call); else signedOut(call);
            })
            .addOnFailureListener(error -> call.reject("Could not connect to Play Games.", "CONNECTION_FAILED")));
    }

    @PluginMethod public void signIn(PluginCall call) {
        if (!configured(call)) return;
        getActivity().runOnUiThread(() -> PlayGames.getGamesSignInClient(getActivity()).signIn()
            .addOnSuccessListener(result -> {
                if (result.isAuthenticated()) resolvePlayer(call); else signedOut(call);
            })
            .addOnFailureListener(error -> call.reject("Play Games sign-in did not complete.", "SIGN_IN_FAILED")));
    }

    @PluginMethod public void submitScore(PluginCall call) {
        if (!configured(call)) return;
        // JSON parses the bounded score as Integer. Capacitor getLong accepts only Long.
        Integer score = call.getInt("score");
        String expectedPlayer = call.getString("playerId", "");
        if (score == null || score < 0 || score > 4000500 || expectedPlayer.isEmpty()) {
            call.reject("Invalid score request.", "INVALID_SCORE"); return;
        }
        // The ID is only a stale-account guard. It is not accepted as proof of gameplay.
        getActivity().runOnUiThread(() -> PlayGames.getPlayersClient(getActivity()).getCurrentPlayer()
            .addOnSuccessListener(player -> {
                if (player == null || !expectedPlayer.equals(player.getPlayerId())) {
                    call.reject("The Play Games account changed. Refresh the profile.", "ACCOUNT_CHANGED"); return;
                }
                PlayGames.getLeaderboardsClient(getActivity())
                    .submitScoreImmediate(getContext().getString(R.string.mola_leaderboard_id), score)
                    .addOnSuccessListener(result -> {
                        JSObject value = new JSObject(); value.put("submitted", true); call.resolve(value);
                    })
                    .addOnFailureListener(error -> call.reject("Score could not be sent. Retry when connected.", "SUBMIT_FAILED"));
            })
            .addOnFailureListener(error -> call.reject("Could not check the Play Games account.", "PROFILE_UNAVAILABLE")));
    }

    @PluginMethod public void showLeaderboard(PluginCall call) {
        if (!configured(call)) return;
        getActivity().runOnUiThread(() -> PlayGames.getLeaderboardsClient(getActivity())
            .getLeaderboardIntent(getContext().getString(R.string.mola_leaderboard_id))
            .addOnSuccessListener(intent -> startActivityForResult(call, intent, "leaderboardClosed"))
            .addOnFailureListener(error -> call.reject("Ranking could not be opened.", "LEADERBOARD_UNAVAILABLE")));
    }

    private void rankingFailed(PluginCall call, Exception error) {
        // Never launch a resolution/consent UI as a side effect of reading scores.
        if (error instanceof ApiException) {
            ApiException api = (ApiException) error;
            if (api.getStatusCode() == GamesClientStatusCodes.CONSENT_REQUIRED || api.getStatus().hasResolution()) {
                call.reject("Google Play Games needs your permission. Open your profile and retry.", "CONSENT_REQUIRED");
                return;
            }
        }
        call.reject("Ranking could not be loaded. Retry when connected.", "LEADERBOARD_UNAVAILABLE");
    }

    @PluginMethod public void getTopScores(PluginCall call) {
        if (!configured(call)) return;
        getActivity().runOnUiThread(() -> PlayGames.getGamesSignInClient(getActivity()).isAuthenticated()
            .addOnSuccessListener(auth -> {
                if (!auth.isAuthenticated()) {
                    call.reject("Sign in to Play Games to view the ranking.", "AUTH_REQUIRED"); return;
                }
                PlayGames.getPlayersClient(getActivity()).getCurrentPlayer()
                    .addOnSuccessListener(player -> {
                        if (player == null || player.getPlayerId() == null) {
                            call.reject("Could not load Play Games profile.", "PROFILE_UNAVAILABLE"); return;
                        }
                        LeaderboardsClient client = PlayGames.getLeaderboardsClient(getActivity());
                        // Google permits at most 25 scores per request. One following page
                        // reaches the game's 50-player limit without invalid maxResults=50.
                        client.loadTopScores(getContext().getString(R.string.mola_leaderboard_id),
                            LeaderboardVariant.TIME_SPAN_ALL_TIME, LeaderboardVariant.COLLECTION_PUBLIC, 25, true)
                            .addOnSuccessListener(data -> readScorePage(call, client, data, player.getPlayerId(), new LinkedHashMap<>(), false, true))
                            .addOnFailureListener(error -> rankingFailed(call, error));
                    })
                    .addOnFailureListener(error -> rankingFailed(call, error));
            })
            .addOnFailureListener(error -> rankingFailed(call, error)));
    }

    private void readScorePage(PluginCall call, LeaderboardsClient client,
            AnnotatedData<LeaderboardsClient.LeaderboardScores> annotated, String playerId,
            LinkedHashMap<String, JSObject> entries, boolean previousStale, boolean allowNextPage) {
        LeaderboardsClient.LeaderboardScores data = annotated == null ? null : annotated.get();
        if (data == null) {
            call.reject("Ranking data is unavailable. Retry when connected.", "LEADERBOARD_UNAVAILABLE"); return;
        }
        boolean stale = previousStale || annotated.isStale();
        try {
            LeaderboardScoreBuffer scores = data.getScores();
            for (int i = 0; i < scores.getCount() && entries.size() < 50; i++) {
                LeaderboardScore score = scores.get(i);
                long rank = score.getRank(), rawScore = score.getRawScore();
                // An unknown rank cannot truthfully be assigned a numbered place.
                if (rank < 1 || rank > 9007199254740991L || rawScore < 0 || rawScore > 9007199254740991L) continue;
                Player holder = score.getScoreHolder();
                String holderId = holder == null ? null : holder.getPlayerId();
                String displayName = score.getScoreHolderDisplayName();
                // Google supplies its own anonymous name when a profile is private.
                // Keep IDs native-only; also deduplicate overlapping cached pages.
                String key = holderId != null ? "player:" + holderId :
                    "score:" + rank + ":" + rawScore + ":" + score.getTimestampMillis() + ":" + displayName;
                JSObject entry = new JSObject();
                entry.put("rank", rank);
                entry.put("displayName", displayName == null ? "" : displayName);
                entry.put("score", rawScore);
                entry.put("isCurrentPlayer", playerId.equals(holderId));
                entries.putIfAbsent(key, entry);
            }
            if (allowNextPage && scores.getCount() >= 25 && entries.size() < 50) {
                client.loadMoreScores(scores, 25, PageDirection.NEXT)
                    .addOnSuccessListener(next -> readScorePage(call, client, next, playerId, entries, stale, false))
                    .addOnFailureListener(error -> rankingFailed(call, error));
                return;
            }
        } catch (RuntimeException error) {
            rankingFailed(call, error); return;
        } finally {
            // loadMoreScores accepts a released source buffer; copied JS values
            // never reference Google's volatile score/player objects.
            data.release();
        }
        JSArray rows = new JSArray();
        for (JSObject entry : entries.values()) rows.put(entry);
        JSObject value = new JSObject();
        value.put("entries", rows);
        value.put("stale", stale);
        // Do not highlight a previous account if it changed during the network read.
        PlayGames.getPlayersClient(getActivity()).getCurrentPlayer()
            .addOnSuccessListener(current -> {
                if (current == null || !playerId.equals(current.getPlayerId())) {
                    call.reject("The Play Games account changed. Refresh the profile.", "ACCOUNT_CHANGED"); return;
                }
                call.resolve(value);
            })
            .addOnFailureListener(error -> rankingFailed(call, error));
    }

    @ActivityCallback private void leaderboardClosed(PluginCall call, ActivityResult result) {
        if (call != null) call.resolve();
    }
}
