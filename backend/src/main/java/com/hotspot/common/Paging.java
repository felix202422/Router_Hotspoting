package com.hotspot.common;

/** 1-based paging with sane bounds so a bad query never becomes a 500. */
public final class Paging {

    public static final int DEFAULT_SIZE = 25;
    public static final int MAX_SIZE = 200;

    private Paging() {
    }

    public static int page(int value) {
        return Math.max(1, value);
    }

    public static int size(int value) {
        return Math.min(MAX_SIZE, Math.max(1, value));
    }
}
