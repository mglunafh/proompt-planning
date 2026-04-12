package com.planning.dto

data class ErrorResponse(
    val error: String,
    val details: List<String> = emptyList(),
)
