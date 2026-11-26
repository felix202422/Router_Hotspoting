package com.hotspot.common;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

/** Reporting dates in Africa/Dar_es_Salaam (UTC+3, no DST) — §12/api-contract §3 A23. */
public final class TzDates {

    public static final ZoneId ZONE = ZoneId.of("Africa/Dar_es_Salaam");
    public static final DateTimeFormatter EAT_LABEL =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZONE);

    private TzDates() {
    }

    public static Instant startOfDay(LocalDate day) {
        return day.atStartOfDay(ZONE).toInstant();
    }

    /** Exclusive upper bound: the first instant of the following TZ day. */
    public static Instant endOfDayExclusive(LocalDate day) {
        return day.plusDays(1).atStartOfDay(ZONE).toInstant();
    }

    public static LocalDate parseDay(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ApiProblem.badRequest("Missing parameter", "Parameter '" + field + "' is required (YYYY-MM-DD).");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw ApiProblem.badRequest("Invalid parameter",
                    "Parameter '" + field + "' must be a date in YYYY-MM-DD format.");
        }
    }

    /** Inclusive [from, to] TZ-day range as [start, endExclusive) instants. */
    public static Instant[] range(String from, String to) {
        LocalDate start = parseDay(from, "from");
        LocalDate end = parseDay(to, "to");
        if (end.isBefore(start)) {
            throw ApiProblem.badRequest("Invalid period", "'to' must not be before 'from'.");
        }
        return new Instant[]{startOfDay(start), endOfDayExclusive(end)};
    }

    public static String dayKey(Instant instant) {
        return LocalDate.ofInstant(instant, ZONE).toString();
    }

    public static String weekKey(Instant instant) {
        LocalDate date = LocalDate.ofInstant(instant, ZONE);
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return DateTimeFormatter.ofPattern("YYYY-'W'ww", Locale.ROOT).format(monday);
    }

    public static String monthKey(Instant instant) {
        return DateTimeFormatter.ofPattern("yyyy-MM", Locale.ROOT).format(LocalDate.ofInstant(instant, ZONE));
    }

    public static Instant startOfToday() {
        return startOfDay(LocalDate.now(ZONE));
    }

    public static Instant startOfWeek() {
        return startOfDay(LocalDate.now(ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
    }

    public static Instant startOfMonth() {
        return startOfDay(LocalDate.now(ZONE).withDayOfMonth(1));
    }

    public static Instant startOfYear() {
        return startOfDay(LocalDate.now(ZONE).withDayOfYear(1));
    }

    /** Bucket size that keeps the chart honest: days ≤31, weeks ≤366, otherwise months. */
    public static BucketSize bucketSize(Instant from, Instant to) {
        long days = java.time.Duration.between(from, to).toDays();
        if (days <= 31) {
            return BucketSize.DAY;
        }
        return days <= 366 ? BucketSize.WEEK : BucketSize.MONTH;
    }

    public enum BucketSize { DAY, WEEK, MONTH }

    public static String bucketKey(Instant instant, BucketSize size) {
        return switch (size) {
            case DAY -> dayKey(instant);
            case WEEK -> weekKey(instant);
            case MONTH -> monthKey(instant);
        };
    }

    /** Every bucket in the range, so empty days/weeks are not silently dropped. */
    public static java.util.LinkedHashMap<String, long[]> emptyBuckets(Instant from, Instant to, BucketSize size) {
        java.util.LinkedHashMap<String, long[]> buckets = new java.util.LinkedHashMap<>();
        ZonedDateTime cursor = from.atZone(ZONE);
        Instant end = to;
        while (!cursor.toInstant().isAfter(end)) {
            buckets.put(bucketKey(cursor.toInstant(), size), new long[2]);
            cursor = switch (size) {
                case DAY -> cursor.plusDays(1);
                case WEEK -> cursor.plusWeeks(1);
                case MONTH -> cursor.plusMonths(1);
            };
        }
        return buckets;
    }
}
