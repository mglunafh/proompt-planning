package org.burufi.proompt.planning.model

import java.time.Instant

data class Snapshot(
    val version: String,
    val generatedAt: Instant,
    val tasks: List<Task> = emptyList(),
    val resources: List<Resource> = emptyList(),
    /**
     * Legacy top-level allocations kept solely for importing old snapshot files that
     * pre-date the [AllocationPlan] model. Always empty in snapshots produced by the
     * current application; populated only transiently during JSON import before
     * [JsonImportService.migratePlans] wraps the list into a default "Plan 1".
     */
    @Deprecated("Kept for importing legacy snapshots only. Use plans instead.")
    val allocations: List<Allocation> = emptyList(),
    val vacations: List<Vacation> = emptyList(),
    /** Named allocation plans. Replaces the top-level [allocations] field. */
    val plans: List<AllocationPlan> = emptyList(),
    /** ID of the currently active plan. `null` if and only if [plans] is empty. */
    val activePlanId: String? = null,
)
