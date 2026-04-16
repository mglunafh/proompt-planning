package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.Vacation
import org.burufi.proompt.planning.model.WorkSegment

data class PlanRequest(
    val allocations: List<Allocation>,
    val vacations: List<Vacation>,
    val workSegments: List<WorkSegment> = emptyList(),
)
