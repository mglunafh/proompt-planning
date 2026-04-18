package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.exception.ValidationException
import org.burufi.proompt.planning.model.Allocation
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
        return snapshot.copy(
            tasks = snapshot.tasks.map { it.copy(title = it.title.trim(), project = it.project?.trim(), status = it.status?.trim()) },
            resources = normalizedResources,
            allocations = normalizeAllocations(snapshot.allocations, normalizedResources),
        )
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
