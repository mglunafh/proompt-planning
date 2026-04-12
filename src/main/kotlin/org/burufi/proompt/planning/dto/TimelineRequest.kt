package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.Snapshot
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
