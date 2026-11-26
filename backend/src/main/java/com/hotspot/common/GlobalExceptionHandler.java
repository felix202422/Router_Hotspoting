package com.hotspot.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Renders every error as RFC 9457 problem+json (api-contract §1) with a
 * traceId for support — internal exception messages are never leaked (NFR-05).
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Application errors with an explicit status/title/detail. */
    @ExceptionHandler(ApiProblem.class)
    public ProblemDetail handleApiProblem(ApiProblem problem, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.valueOf(problem.getStatus()), problem.getDetail() != null ? problem.getDetail() : problem.getTitle());
        pd.setTitle(problem.getTitle());
        pd.setType(java.net.URI.create("about:blank"));
        pd.setProperty("traceId", TraceIds.current(request));
        if (problem.getRetryAfterSeconds() != null) {
            pd.setProperty("retryAfter", problem.getRetryAfterSeconds());
        }
        return pd;
    }

    /** Bean-validation failures on request DTOs → 400 with joined field errors. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + " " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                detail.isBlank() ? "Validation failed" : detail);
        pd.setTitle("Validation failed");
        pd.setType(java.net.URI.create("about:blank"));
        pd.setProperty("traceId", TraceIds.current(request));
        return pd;
    }

    /** Unexpected errors → generic 500 (logged server-side with traceId). */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        String traceId = TraceIds.current(request);
        log.error("Unhandled error [traceId={}]", traceId, ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on our side. Please try again.");
        pd.setTitle("Internal error");
        pd.setType(java.net.URI.create("about:blank"));
        pd.setProperty("traceId", traceId);
        return pd;
    }

    /** Spring's default error path also produces problem+json via this advice. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail pd && request instanceof ServletWebRequest swr) {
            pd.setProperty("traceId", TraceIds.current(swr.getRequest()));
        }
        return super.handleExceptionInternal(ex, body, headers, statusCode, request);
    }
}
