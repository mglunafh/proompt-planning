package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.exception.ValidationException
import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.AllocationPlan
import org.burufi.proompt.planning.model.Resource
import org.burufi.proompt.planning.model.Snapshot
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class JsonImportService(private val validationService: ValidationService) {

    fun import(snapshot: Snapshot): Snapshot {
        val normalized = normalize(snapshot)
        val result = validationService.validate(normalized)
        if (!result.valid) {
            throw ValidationException("Snapshot validation failed", result.issues)
        }
        return normalized
    }

    private fun normalize(snapshot: Snapshot): Snapshot {
        val normalizedResources = snapshot.resources.map { it.copy(name = it.name.trim()) }
        val migrated = migratePlans(snapshot)
        return migrated.copy(
            tasks = migrated.tasks.map { it.copy(title = it.title.trim(), project = it.project?.trim(), status = it.status?.trim()) },
            resources = normalizedResources,
            allocations = emptyList(),
            plans = migrated.plans.map { plan ->
                plan.copy(allocations = normalizeAllocations(plan.allocations, normalizedResources))
            },
        )
    }

    private fun migratePlans(snapshot: Snapshot): Snapshot {
        if (snapshot.plans.isNotEmpty()) {
            val validActivePlanId = if (snapshot.plans.any { it.id == snapshot.activePlanId }) {
                snapshot.activePlanId
            } else {
                snapshot.plans.first().id
            }
            return snapshot.copy(activePlanId = validActivePlanId, allocations = emptyList())
        }
        val plan1 = AllocationPlan(UUID.randomUUID().toString(), "Plan 1", snapshot.allocations)
        return snapshot.copy(plans = listOf(plan1), activePlanId = plan1.id, allocations = emptyList())
    }

    internal fun normalizeAllocations(allocations: List<Allocation>, resources: List<Resource>): List<Allocation> {
        val resourceById = resources.associateBy { it.id }
        return allocations.map { alloc ->
            val id = alloc.id.ifBlank { UUID.randomUUID().toString() } // compat: generate id for old allocations that have none
            val role = if (alloc.resourceId != null) {
                resourceById[alloc.resourceId]?.role ?: alloc.role     // compat: derive role from resource for old allocations that have no explicit role
            } else {
                alloc.role
            }
            alloc.copy(id = id, role = role)
        }
    }
}
