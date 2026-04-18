package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.AllocationPlan
import org.burufi.proompt.planning.model.Vacation
import org.burufi.proompt.planning.model.WorkSegment

data class PlanRequest(
    val vacations: List<Vacation>,
    val workSegments: List<WorkSegment> = emptyList(),
    val plans: List<AllocationPlan> = emptyList(),
    val activePlanId: String? = null,
)
