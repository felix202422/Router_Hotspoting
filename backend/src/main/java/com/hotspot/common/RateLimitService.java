package com.hotspot.common;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * In-memory sliding-window rate limiter (api-contract §4) — bucketed per
 * single-node deployment (system-architecture §5). No external dependency.
 */
@Service
public class RateLimitService {

    public record Decision(boolean allowed, long retryAfterSeconds) {
        public static Decision allow() { return new Decision(true, 0); }
    }

    private final ConcurrentHashMap<String, Deque<Instant>> buckets = new ConcurrentHashMap<>();

    /**
     * @param key            bucket key (e.g. "purchase:+255712345678", "login:127.0.0.1")
     * @param maxHits        allowed hits per window
     * @param window         sliding window length
     */
    public Decision tryAcquire(String key, int maxHits, Duration window) {
        Instant now = Instant.now();
        Deque<Instant> hits = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (hits) {
            Instant cutoff = now.minus(window);
            while (!hits.isEmpty() && hits.peekFirst().isBefore(cutoff)) {
                hits.removeFirst();
            }
            if (hits.size() >= maxHits) {
                Instant oldest = hits.peekFirst();
                long retryAfter = Math.max(1, Duration.between(oldest, cutoff).getSeconds() + 1);
                return new Decision(false, retryAfter);
            }
            hits.addLast(now);
            return Decision.allow();
        }
    }

    /** Clears a bucket after a successful login (so one success resets the counter). */
    public void reset(String key) {
        buckets.remove(key);
    }

    /** Periodic housekeeping so abandoned keys do not accumulate. */
    public void prune(Duration maxIdle) {
        Instant cutoff = Instant.now().minus(maxIdle);
        buckets.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(cutoff);
            }
        });
    }

    /** Scheduled housekeeping (every 5 min): buckets idle > 10 min are dropped —
     *  far beyond the longest contract window (60 s), so live limits are untouched. */
    @Scheduled(fixedDelayString = "${app.scheduler.rate-limit-prune-ms:300000}")
    public void scheduledPrune() {
        prune(Duration.ofMinutes(10));
    }
}
