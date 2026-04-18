package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.PlanRequest
import org.burufi.proompt.planning.dto.PlanResponse
import org.springframework.stereotype.Service

@Service
class PlanService {

    fun save(request: PlanRequest): PlanResponse {
        val activeAllocations = request.plans.find { it.id == request.activePlanId }?.allocations ?: emptyList()
        return PlanResponse(
            saved = true,
            count = activeAllocations.size + request.vacations.size,
        )
    }
}
