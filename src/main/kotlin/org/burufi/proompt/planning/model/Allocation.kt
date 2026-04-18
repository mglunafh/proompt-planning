package org.burufi.proompt.planning.model

import java.time.LocalDate

data class Allocation(
    val id: String = "",                    // compat: old snapshots have no id; blank is normalised to UUID on import
    val taskId: String,
    val role: Role = Role.DEVELOPER,        // compat: old snapshots have no role; normalised from resource on import
    val estimatedDuration: Int = 0,         // compat: old snapshots have no estimatedDuration; defaults to 0
    val resourceId: String? = null,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val comment: String? = null,
)
