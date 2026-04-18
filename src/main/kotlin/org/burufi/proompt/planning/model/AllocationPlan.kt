package org.burufi.proompt.planning.model

/**
 * A named set of allocations within a snapshot.
 * Multiple plans can co-exist on the same task/resource base, letting users model
 * different scheduling scenarios without duplicating tasks or resources.
 */
data class AllocationPlan(
    val id: String,
    val name: String,
    val allocations: List<Allocation> = emptyList(),
)
