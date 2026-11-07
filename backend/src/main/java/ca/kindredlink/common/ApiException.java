package ca.kindredlink.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Throw this from services for any rule violation. Spring renders it as RFC 9457 JSON:
 * {@code {"status":409,"title":"slot_closed","detail":"..."}}. The frontend switches on {@code title}.
 */
public class ApiException extends ErrorResponseException {

    public ApiException(HttpStatus status, String code, String message) {
        super(status, problem(status, code, message), null);
    }

    private static ProblemDetail problem(HttpStatus status, String code, String message) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, message);
        pd.setTitle(code);
        return pd;
    }

    public static ApiException notFound(String what, Object id) {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", what + " " + id + " not found");
    }
}
