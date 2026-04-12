package com.planning.model

import java.time.LocalDate

data class Allocation(
    val taskId: String,
    val resourceId: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
)
