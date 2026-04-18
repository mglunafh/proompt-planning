package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.AllocationPlan
import org.burufi.proompt.planning.model.Vacation

data class PlanRequest(
    val vacations: List<Vacation>,
    val plans: List<AllocationPlan> = emptyList(),
    val activePlanId: String? = null,
)
