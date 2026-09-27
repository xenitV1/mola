package com.example.mola;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Predicate;
import java.util.function.ToLongFunction;

final class BillingRecovery {
    static final long RETRY_MS = 20000;
    interface Scheduler {
        void post(Runnable task, long delay);
        void remove(Runnable task);
    }
    private final Scheduler scheduler;
    private final BooleanSupplier blocked;
    private final Runnable refresh;
    private final Runnable tick = this::run;
    private boolean foreground, destroyed, requested, retry;

    BillingRecovery(Scheduler scheduler, BooleanSupplier blocked, Runnable refresh) {
        this.scheduler = scheduler; this.blocked = blocked; this.refresh = refresh;
    }
    void resume() { if (!destroyed) { foreground = true; request(); } }
    void pause() { foreground = false; scheduler.remove(tick); }
    void destroy() { destroyed = true; pause(); requested = false; retry = false; }
    void request() { if (!destroyed) { requested = true; schedule(0); } }
    void finished(boolean needsRetry) { retry = needsRetry; schedule(requested ? 0 : RETRY_MS); }
    private void schedule(long delay) {
        scheduler.remove(tick);
        if (!destroyed && foreground && (requested || retry)) scheduler.post(tick, delay);
    }
    private void run() {
        if (destroyed || !foreground || !(requested || retry)) return;
        if (blocked.getAsBoolean()) { schedule(RETRY_MS); return; }
        requested = false; retry = false;
        refresh.run();
    }
    static boolean handlesUpdate(boolean successful, boolean matchingProduct, boolean opening) {
        return successful ? matchingProduct : opening;
    }
    static <T> T preferred(List<T> purchases, Predicate<T> matches, Predicate<T> purchased, ToLongFunction<T> time) {
        T selected = null;
        if (purchases == null) return null;
        for (T candidate : purchases) if (matches.test(candidate)) {
            if (selected == null || (purchased.test(candidate) && !purchased.test(selected))
                || (purchased.test(candidate) == purchased.test(selected) && time.applyAsLong(candidate) > time.applyAsLong(selected))) selected = candidate;
        }
        return selected;
    }
}
