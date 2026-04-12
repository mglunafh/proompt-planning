package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.PlanRequest
import org.burufi.proompt.planning.dto.PlanResponse
import org.springframework.stereotype.Service

@Service
class PlanService {

    fun save(request: PlanRequest): PlanResponse =
        PlanResponse(
            saved = true,
            count = request.allocations.size + request.vacations.size,
        )
}
