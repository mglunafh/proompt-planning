package org.burufi.proompt.planning.model

import java.time.LocalDate

data class WorkSegment(
    val id: String,
    val taskId: String,
    val label: String,
    val role: Role,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val comment: String? = null,
)
