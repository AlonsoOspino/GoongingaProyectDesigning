package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class DraftErrors {
    public record ErrorResponse(String message) {}

    @ExceptionHandler(DraftHttpException.class)
    ResponseEntity<ErrorResponse> http(DraftHttpException error) {
        return ResponseEntity.status(error.status()).body(new ErrorResponse(error.getMessage()));
    }

    @ExceptionHandler(DraftRuleViolation.class)
    ResponseEntity<ErrorResponse> rule(DraftRuleViolation error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage())
                .findFirst().orElse("Invalid request.");
        return ResponseEntity.badRequest().body(new ErrorResponse(message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> value(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(new ErrorResponse(error.getMessage()==null?"Invalid request values.":error.getMessage()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> malformed(Exception error) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Invalid request values or JSON."));
    }

    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    ResponseEntity<ErrorResponse> conflict(Exception error) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("The draft changed or violates a data constraint. Reload its state."));
    }
}
