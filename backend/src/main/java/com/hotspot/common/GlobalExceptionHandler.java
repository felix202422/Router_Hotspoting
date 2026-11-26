package com.hotspot.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Renders every error as RFC 9457 problem+json (api-contract §1) with a
 * traceId for support — internal exception messages are never leaked (NFR-05).
 *
 * Deliberately standalone: it does NOT extend ResponseEntityExceptionHandler.
 * The superclass registers its own @ExceptionHandler mapping that also covers
 * MethodArgumentNotValidException, which collides with the custom validation
 * handler below ("Ambiguous @ExceptionHandler method mapped" at context
 * startup — found at the first runtime boot, after compilation was green).
 * Each framework exception therefore gets an explicit handler with the
 * correct status code; anything unmapped falls through to a generic 500.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Application errors with an explicit status/title/detail. */
    @ExceptionHandler(ApiProblem.class)
    public ProblemDetail handleApiProblem(ApiProblem problem, HttpServletRequest request) {
        ProblemDetail pd = problem(HttpStatus.valueOf(problem.getStatus()),
                problem.getTitle(),
                problem.getDetail() != null ? problem.getDetail() : problem.getTitle(),
                request);
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
        return problem(HttpStatus.BAD_REQUEST, "Validation failed",
                detail.isBlank() ? "Validation failed" : detail, request);
    }

    /** Missing/unparseable JSON body → 400. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "Malformed request",
                "The request body is missing or is not valid JSON.", request);
    }

    /** Wrong parameter type (?page=abc) → 400 without echoing internals. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid parameter",
                "Parameter '" + ex.getName() + "' has an invalid value.", request);
    }

    /** Missing required request parameter → 400. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ProblemDetail handleMissingParam(MissingServletRequestParameterException ex, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "Missing parameter",
                "Parameter '" + ex.getParameterName() + "' is required.", request);
    }

    /** Wrong HTTP method on a known path → 405. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ProblemDetail handleMethodNotSupported(HttpRequestMethodNotSupportedException ex,
                                                  HttpServletRequest request) {
        String allowed = ex.getSupportedHttpMethods() == null ? "" :
                " Supported: " + String.join(", ", ex.getSupportedHttpMethods().stream()
                        .map(String::valueOf).toList()) + ".";
        return problem(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed",
                "Method " + ex.getMethod() + " is not supported on this endpoint." + allowed, request);
    }

    /** Wrong Content-Type → 415. */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ProblemDetail handleMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        return problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type",
                "Send the request as application/json.", request);
    }

    /** Unknown path that reached MVC (security default-deny normally stops these first) → 404. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResource(NoResourceFoundException ex, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "Not found", "The requested endpoint does not exist.", request);
    }

    /** Unexpected errors → generic 500 (logged server-side with traceId). */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        String traceId = TraceIds.current(request);
        log.error("Unhandled error [traceId={}]", traceId, ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error",
                "Something went wrong on our side. Please try again.", request);
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setTitle(title);
        pd.setType(java.net.URI.create("about:blank"));
        pd.setProperty("traceId", TraceIds.current(request));
        return pd;
    }
}
