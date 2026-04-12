package com.planning.model

import java.time.LocalDate

data class Vacation(
    val resourceId: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val type: VacationType,
    val comment: String? = null,
)

enum class VacationType {
    VACATION,
    SICK_LEAVE,
    DAY_OFF,
}
