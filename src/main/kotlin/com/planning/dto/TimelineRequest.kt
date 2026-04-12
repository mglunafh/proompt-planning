package com.planning.dto

import com.planning.model.Snapshot
import java.time.LocalDate

data class TimelineRequest(
    val snapshot: Snapshot,
    val from: LocalDate,
    val to: LocalDate,
    val mode: TimelineMode,
)

enum class TimelineMode {
    RESOURCE,
    TASK,
}
