package org.burufi.proompt.planning.exception

import org.burufi.proompt.planning.dto.ValidationIssue

class ValidationException(
    message: String,
    val issues: List<ValidationIssue>,
) : RuntimeException(message)
