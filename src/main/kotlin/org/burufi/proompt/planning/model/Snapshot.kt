package org.burufi.proompt.planning.model

import java.time.Instant

data class Snapshot(
    val version: String,
    val generatedAt: Instant,
    val tasks: List<Task> = emptyList(),
    val resources: List<Resource> = emptyList(),
    val allocations: List<Allocation> = emptyList(),
    val vacations: List<Vacation> = emptyList(),
    val workSegments: List<WorkSegment> = emptyList(),
)
