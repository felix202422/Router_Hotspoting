package com.hotspot.common;

/**
 * Application error carrying RFC 9457 problem details fields.
 * Thrown anywhere below the API layer; GlobalExceptionHandler renders it.
 */
public class ApiProblem extends RuntimeException {

    private final int status;
    private final String title;
    private final String detail;
    private final Long retryAfterSeconds;

    private ApiProblem(int status, String title, String detail, Long retryAfterSeconds) {
        super(detail != null ? detail : title);
        this.status = status;
        this.title = title;
        this.detail = detail;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static ApiProblem badRequest(String title, String detail) {
        return new ApiProblem(400, title, detail, null);
    }

    public static ApiProblem unauthorized(String detail) {
        return new ApiProblem(401, "Unauthorized", detail, null);
    }

    public static ApiProblem forbidden(String detail) {
        return new ApiProblem(403, "Forbidden", detail, null);
    }

    public static ApiProblem notFound(String detail) {
        return new ApiProblem(404, "Not found", detail, null);
    }

    public static ApiProblem conflict(String title, String detail) {
        return new ApiProblem(409, title, detail, null);
    }

    public static ApiProblem unprocessable(String title, String detail) {
        return new ApiProblem(422, title, detail, null);
    }

    public static ApiProblem tooManyRequests(String title, String detail, long retryAfterSeconds) {
        return new ApiProblem(429, title, detail, retryAfterSeconds);
    }

    public static ApiProblem internal(String detail) {
        return new ApiProblem(500, "Internal error", detail, null);
    }

    public int getStatus() { return status; }
    public String getTitle() { return title; }
    public String getDetail() { return detail; }
    public Long getRetryAfterSeconds() { return retryAfterSeconds; }
}
