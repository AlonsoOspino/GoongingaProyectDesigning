package com.overtimeproductions.goonginga.draft.api;

import org.springframework.http.HttpStatus;

public class DraftHttpException extends RuntimeException {
    private final HttpStatus status;

    public DraftHttpException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() { return status; }
}
