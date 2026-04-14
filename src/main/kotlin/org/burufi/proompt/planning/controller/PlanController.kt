package org.burufi.proompt.planning.controller

import org.burufi.proompt.planning.dto.PlanRequest
import org.burufi.proompt.planning.dto.PlanResponse
import org.burufi.proompt.planning.service.PlanService
import org.burufi.proompt.planning.service.PlanStateHolder
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/plan")
class PlanController(
    private val planService: PlanService,
    private val planStateHolder: PlanStateHolder,
) {

    @PostMapping
    fun savePlan(@RequestBody request: PlanRequest): ResponseEntity<PlanResponse> {
        planStateHolder.snapshot?.let { existing ->
            planStateHolder.update(
                existing.copy(allocations = request.allocations, vacations = request.vacations),
                planStateHolder.sourceFilename ?: "plan",
            )
        }
        return ResponseEntity.ok(planService.save(request))
    }
}
