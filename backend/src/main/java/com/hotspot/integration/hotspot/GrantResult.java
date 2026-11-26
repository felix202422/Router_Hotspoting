package com.hotspot.integration.hotspot;

/** @param ok false = controller refused/unreachable → ENFORCEMENT_PENDING + reconciliation (§4.1). */
public record GrantResult(boolean ok, String grantRef, String error) {
}
