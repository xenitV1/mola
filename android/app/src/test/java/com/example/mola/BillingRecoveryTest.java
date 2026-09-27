package com.example.mola;

import org.junit.Test;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;

public class BillingRecoveryTest {
    private static final class Clock implements BillingRecovery.Scheduler {
        long now;
        final Map<Runnable, Long> tasks = new HashMap<>();
        public void post(Runnable task, long delay) { tasks.put(task, now + delay); }
        public void remove(Runnable task) { tasks.remove(task); }
        void advance(long elapsed) {
            long end = now + elapsed;
            while (true) {
                Map.Entry<Runnable, Long> first = tasks.entrySet().stream().min(Map.Entry.comparingByValue()).orElse(null);
                if (first == null || first.getValue() > end) break;
                Runnable task = first.getKey(); now = first.getValue(); tasks.remove(task); task.run();
            }
            now = end;
        }
    }
    private static final class Session {
        final Clock clock = new Clock();
        boolean busy, opening;
        int queries;
        final BillingRecovery recovery = new BillingRecovery(clock, () -> busy || opening, () -> { queries++; busy = true; });
        void complete(boolean retry) { busy = false; recovery.finished(retry); }
    }
    @Test public void pendingApprovalIsQueriedWithoutAnotherUiAction() {
        Session s = new Session(); s.recovery.resume(); s.clock.advance(0);
        assertEquals(1, s.queries);
        s.complete(true);
        s.clock.advance(19999); assertEquals(1, s.queries);
        s.clock.advance(1); assertEquals(2, s.queries);
        s.complete(false);
        s.clock.advance(120000); assertEquals(2, s.queries);
    }
    @Test public void backgroundCancelsRetryAndResumeQueriesImmediately() {
        Session s = new Session(); s.recovery.resume(); s.clock.advance(0); s.complete(true);
        Runnable stale = s.clock.tasks.keySet().iterator().next();
        s.recovery.pause(); stale.run(); s.clock.advance(60000);
        assertEquals(1, s.queries); assertTrue(s.clock.tasks.isEmpty());
        s.recovery.resume(); s.clock.advance(0); assertEquals(2, s.queries);
    }
    @Test public void freshProcessQueriesWithoutRememberingPendingState() {
        Session old = new Session(); old.recovery.resume(); old.clock.advance(0); old.complete(true); old.recovery.destroy();
        Session fresh = new Session(); fresh.recovery.resume(); fresh.clock.advance(0);
        assertEquals(1, fresh.queries);
        old.clock.advance(120000); assertEquals(1, old.queries);
    }
    @Test public void relevantCallbackDuringVerificationWaitsForItsCompletion() {
        Session s = new Session(); s.recovery.resume(); s.clock.advance(0);
        s.recovery.request(); s.recovery.request(); s.clock.advance(0);
        assertEquals(1, s.queries); assertTrue(s.busy); assertEquals(1, s.clock.tasks.size());
        s.complete(false); s.clock.advance(0);
        assertEquals(2, s.queries);
        s.complete(false); s.clock.advance(120000); assertEquals(2, s.queries);
    }
    @Test public void returningFromStoreDoesNotQueryOverAnOpenPurchaseFlow() {
        Session s = new Session(); s.opening = true; s.recovery.resume(); s.clock.advance(60000);
        assertEquals(0, s.queries);
        s.opening = false; s.complete(true); s.clock.advance(0);
        assertEquals(1, s.queries);
    }
    @Test public void failedVerificationRetriesAndSuccessStopsTheTimer() {
        Session s = new Session(); s.recovery.resume(); s.clock.advance(0); s.complete(true);
        s.clock.advance(20000); s.complete(true);
        s.clock.advance(20000); assertEquals(3, s.queries); s.complete(false);
        assertTrue(s.clock.tasks.isEmpty());
    }
    @Test public void destroyPreventsStaleCallbacksFromRescheduling() {
        Session s = new Session(); s.recovery.resume();
        Runnable stale = s.clock.tasks.keySet().iterator().next();
        s.recovery.destroy(); stale.run(); s.recovery.finished(true); s.recovery.request(); s.recovery.resume();
        s.clock.advance(120000); assertEquals(0, s.queries); assertTrue(s.clock.tasks.isEmpty());
    }
    @Test public void unrelatedProductsAndAnotherClientsCancellationAreIgnored() {
        assertFalse(BillingRecovery.handlesUpdate(true, false, false));
        assertFalse(BillingRecovery.handlesUpdate(true, false, true));
        assertFalse(BillingRecovery.handlesUpdate(false, false, false));
        assertTrue(BillingRecovery.handlesUpdate(true, true, false));
        assertTrue(BillingRecovery.handlesUpdate(false, false, true));
    }
    private static final class Item {
        final String product; final boolean purchased; final long time;
        Item(String product, boolean purchased, long time) { this.product = product; this.purchased = purchased; this.time = time; }
    }
    @Test public void completedMatchingPurchaseWinsOverNewerPendingAndOtherProducts() {
        Item pending = new Item("full", false, 30), old = new Item("full", true, 10);
        Item current = new Item("full", true, 20), other = new Item("diamonds", true, 40);
        assertSame(current, BillingRecovery.preferred(Arrays.asList(pending, other, old, current),
            p -> p.product.equals("full"), p -> p.purchased, p -> p.time));
        assertSame(pending, BillingRecovery.preferred(Arrays.asList(other, pending),
            p -> p.product.equals("full"), p -> p.purchased, p -> p.time));
        assertNull(BillingRecovery.preferred(Arrays.asList(other),
            p -> p.product.equals("full"), p -> p.purchased, p -> p.time));
    }
}
