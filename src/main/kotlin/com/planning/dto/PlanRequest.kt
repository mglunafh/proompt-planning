package com.planning.dto

import com.planning.model.Allocation
import com.planning.model.Vacation

data class PlanRequest(
    val allocations: List<Allocation>,
    val vacations: List<Vacation>,
)
