package org.burufi.proompt.planning.dto

import org.burufi.proompt.planning.model.Allocation
import org.burufi.proompt.planning.model.Resource
import org.burufi.proompt.planning.model.Task

data class ImportCsvResponse(
    val tasks: List<Task>,
    val resources: List<Resource>,
    val allocations: List<Allocation>,
    val warnings: List<String>,
)
