package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.TimelineRequest
import org.burufi.proompt.planning.dto.TimelineResponse
import org.springframework.stereotype.Service

@Service
class TimelineService {

    fun filter(request: TimelineRequest): TimelineResponse {
        val snapshot = request.snapshot
        val from = request.from
        val to = request.to

        val activePlan = snapshot.plans.find { it.id == snapshot.activePlanId }
        val allAllocations = activePlan?.allocations
            ?: snapshot.plans.firstOrNull()?.allocations
            ?: @Suppress("DEPRECATION") snapshot.allocations  // legacy snapshots sent without migration
        val filteredAllocations = allAllocations.filter { alloc ->
            alloc.startDate <= to && alloc.endDate >= from
        }

        val referencedTaskIds = filteredAllocations.map { it.taskId }.toSet()
        val referencedResourceIds = filteredAllocations.mapNotNull { it.resourceId }.toSet()

        val filteredTasks = snapshot.tasks.filter { it.id in referencedTaskIds }
        val filteredResources = snapshot.resources.filter { it.id in referencedResourceIds }

        val filteredVacations = snapshot.vacations.filter { vac ->
            vac.resourceId in referencedResourceIds &&
                vac.startDate <= to && vac.endDate >= from
        }

        return TimelineResponse(
            tasks = filteredTasks,
            resources = filteredResources,
            allocations = filteredAllocations,
            vacations = filteredVacations,
        )
    }
}
