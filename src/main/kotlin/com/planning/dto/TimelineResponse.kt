package com.planning.dto

import com.planning.model.Allocation
import com.planning.model.Resource
import com.planning.model.Task
import com.planning.model.Vacation

data class TimelineResponse(
    val tasks: List<Task>,
    val resources: List<Resource>,
    val allocations: List<Allocation>,
    val vacations: List<Vacation>,
)
