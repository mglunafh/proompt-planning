package org.burufi.proompt.planning.dto

data class ValidationIssue(
    val severity: String,
    val message: String,
    val field: String? = null,
)

data class ValidationResponse(
    val valid: Boolean,
    val issues: List<ValidationIssue>,
)
