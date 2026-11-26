package com.hotspot.domain;

/** Why a live session ended (ER §active_sessions.end_reason). */
public enum EndReason {
    LOGOUT,
    EXPIRED,
    REVOKE,
    DISCONNECT,
    REPLACE
}
