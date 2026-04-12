package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.ValidationIssue
import org.burufi.proompt.planning.dto.ValidationResponse
import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.model.Vacation
import org.springframework.stereotype.Service

@Service
class ValidationService {

    fun validate(snapshot: Snapshot): ValidationResponse {
        val issues = mutableListOf<ValidationIssue>()

        val taskIds = snapshot.tasks.map { it.id }.toSet()
        val resourceIds = snapshot.resources.map { it.id }.toSet()

        // Duplicate task IDs
        snapshot.tasks.groupBy { it.id }
            .filter { it.value.size > 1 }
            .forEach { (id, _) ->
                issues += error("Duplicate task ID: $id", "tasks")
            }

        // parentId reference integrity
        snapshot.tasks.forEachIndexed { i, task ->
            if (task.parentId != null && task.parentId !in taskIds) {
                issues += error("Task '${task.id}' references unknown parentId: ${task.parentId}", "tasks[$i].parentId")
            }
        }

        // Duplicate resource IDs
        snapshot.resources.groupBy { it.id }
            .filter { it.value.size > 1 }
            .forEach { (id, _) ->
                issues += error("Duplicate resource ID: $id", "resources")
            }

        // Allocation reference integrity + date ordering
        snapshot.allocations.forEachIndexed { i, alloc ->
            issues += validateAllocation(alloc, i, taskIds, resourceIds)
        }

        // Vacation reference integrity + date ordering
        snapshot.vacations.forEachIndexed { i, vac ->
            issues += validateVacation(vac, i, resourceIds)
        }

        return ValidationResponse(
            valid = issues.none { it.severity == "ERROR" },
            issues = issues,
        )
    }

    private fun validateAllocation(
        alloc: Allocation,
        index: Int,
        taskIds: Set<String>,
        resourceIds: Set<String>,
    ): List<ValidationIssue> {
        val issues = mutableListOf<ValidationIssue>()
        if (alloc.taskId !in taskIds) {
            issues += error("Allocation references unknown taskId: ${alloc.taskId}", "allocations[$index].taskId")
        }
        if (alloc.resourceId !in resourceIds) {
            issues += error("Allocation references unknown resourceId: ${alloc.resourceId}", "allocations[$index].resourceId")
        }
        if (alloc.startDate > alloc.endDate) {
            issues += error("Allocation startDate is after endDate", "allocations[$index]")
        }
        return issues
    }

    private fun validateVacation(
        vac: Vacation,
        index: Int,
        resourceIds: Set<String>,
    ): List<ValidationIssue> {
        val issues = mutableListOf<ValidationIssue>()
        if (vac.resourceId !in resourceIds) {
            issues += error("Vacation references unknown resourceId: ${vac.resourceId}", "vacations[$index].resourceId")
        }
        if (vac.startDate > vac.endDate) {
            issues += error("Vacation startDate is after endDate", "vacations[$index]")
        }
        return issues
    }

    private fun error(message: String, field: String? = null) =
        ValidationIssue(severity = "ERROR", message = message, field = field)
}
