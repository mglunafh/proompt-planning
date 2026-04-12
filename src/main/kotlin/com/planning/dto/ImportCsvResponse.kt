package com.planning.dto

import com.planning.model.Allocation
import com.planning.model.Resource
import com.planning.model.Task

data class ImportCsvResponse(
    val tasks: List<Task>,
    val resources: List<Resource>,
    val allocations: List<Allocation>,
    val warnings: List<String>,
)
