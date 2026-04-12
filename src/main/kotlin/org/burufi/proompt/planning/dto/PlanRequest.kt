package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.Vacation

data class PlanRequest(
    val allocations: List<Allocation>,
    val vacations: List<Vacation>,
)
