package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.Resource
import org.burufi.proompt.planning.model.Role
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.model.Task
import org.burufi.proompt.planning.model.TaskType
import org.burufi.proompt.planning.model.Vacation
import org.burufi.proompt.planning.model.VacationType
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ValidationServiceTest {

    private val service = ValidationService()

    private fun snapshot(
        tasks: List<Task> = emptyList(),
        resources: List<Resource> = emptyList(),
        allocations: List<Allocation> = emptyList(),
        vacations: List<Vacation> = emptyList(),
    ) = Snapshot(
        version = "1.0",
        generatedAt = Instant.now(),
        tasks = tasks,
        resources = resources,
        allocations = allocations,
        vacations = vacations,
    )

    private val task1 = Task(id = "T-1", title = "Task 1")
    private val task2 = Task(id = "T-2", title = "Task 2")
    private val resource1 = Resource(id = "res-1", name = "Alice", role = Role.DEVELOPER)
    private val resource2 = Resource(id = "res-2", name = "Bob", role = Role.ANALYST)

    private fun alloc(
        taskId: String = "T-1",
        resourceId: String = "res-1",
        start: LocalDate = LocalDate.of(2025, 5, 1),
        end: LocalDate = LocalDate.of(2025, 5, 15),
    ) = Allocation(taskId = taskId, resourceId = resourceId, startDate = start, endDate = end)

    @Test
    fun `empty snapshot is valid`() {
        val result = service.validate(snapshot())
        assertTrue(result.valid)
        assertTrue(result.issues.isEmpty())
    }

    @Test
    fun `valid snapshot passes`() {
        val result = service.validate(
            snapshot(
                tasks = listOf(task1, task2),
                resources = listOf(resource1, resource2),
                allocations = listOf(alloc()),
            ),
        )
        assertTrue(result.valid)
        assertTrue(result.issues.isEmpty())
    }

    @Test
    fun `duplicate task IDs are flagged`() {
        val result = service.validate(snapshot(tasks = listOf(task1, task1.copy(title = "Duplicate"))))
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("T-1") && it.field == "tasks" })
    }

    @Test
    fun `duplicate resource IDs are flagged`() {
        val result = service.validate(snapshot(resources = listOf(resource1, resource1.copy(name = "Duplicate"))))
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("res-1") && it.field == "resources" })
    }

    @Test
    fun `allocation with unknown taskId is flagged`() {
        val result = service.validate(
            snapshot(
                tasks = listOf(task1),
                resources = listOf(resource1),
                allocations = listOf(alloc(taskId = "MISSING")),
            ),
        )
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("MISSING") })
    }

    @Test
    fun `allocation with unknown resourceId is flagged`() {
        val result = service.validate(
            snapshot(
                tasks = listOf(task1),
                resources = listOf(resource1),
                allocations = listOf(alloc(resourceId = "ghost")),
            ),
        )
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("ghost") })
    }

    @Test
    fun `allocation with startDate after endDate is flagged`() {
        val result = service.validate(
            snapshot(
                tasks = listOf(task1),
                resources = listOf(resource1),
                allocations = listOf(alloc(start = LocalDate.of(2025, 6, 1), end = LocalDate.of(2025, 5, 1))),
            ),
        )
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("startDate") })
    }

    @Test
    fun `vacation with unknown resourceId is flagged`() {
        val result = service.validate(
            snapshot(
                resources = listOf(resource1),
                vacations = listOf(
                    Vacation(
                        resourceId = "nobody",
                        startDate = LocalDate.of(2025, 6, 1),
                        endDate = LocalDate.of(2025, 6, 7),
                        type = VacationType.VACATION,
                    ),
                ),
            ),
        )
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("nobody") })
    }

    @Test
    fun `task with valid parentId passes`() {
        val parent = Task(id = "T-1", title = "Parent Feature", type = TaskType.FEATURE)
        val child  = Task(id = "T-2", title = "Child Story",   type = TaskType.STORY, parentId = "T-1")
        val result = service.validate(snapshot(tasks = listOf(parent, child)))
        assertTrue(result.valid)
        assertTrue(result.issues.isEmpty())
    }

    @Test
    fun `task with unknown parentId is flagged`() {
        val child = Task(id = "T-2", title = "Orphan Story", parentId = "NONEXISTENT")
        val result = service.validate(snapshot(tasks = listOf(child)))
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("NONEXISTENT") && it.field?.contains("parentId") == true })
    }

    @Test
    fun `task with null parentId is always valid`() {
        val result = service.validate(snapshot(tasks = listOf(task1)))
        assertTrue(result.valid)
    }

    @Test
    fun `vacation with startDate after endDate is flagged`() {
        val result = service.validate(
            snapshot(
                resources = listOf(resource1),
                vacations = listOf(
                    Vacation(
                        resourceId = "res-1",
                        startDate = LocalDate.of(2025, 6, 10),
                        endDate = LocalDate.of(2025, 6, 1),
                        type = VacationType.SICK_LEAVE,
                    ),
                ),
            ),
        )
        assertFalse(result.valid)
        assertTrue(result.issues.any { it.message.contains("startDate") })
    }
}
