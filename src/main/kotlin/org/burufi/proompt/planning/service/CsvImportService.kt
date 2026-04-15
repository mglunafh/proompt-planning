package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.parser.CsvParser
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

@Service
class CsvImportService(private val csvParser: CsvParser) {

    private data class AllocKey(val taskId: String, val resourceId: String, val start: String, val end: String)

    fun import(file: MultipartFile): ImportCsvResponse {
        require(!file.isEmpty) { "Uploaded CSV file is empty" }
        return csvParser.parse(file.inputStream)
    }

    fun merge(file: MultipartFile, existing: Snapshot?): ImportCsvResponse {
        require(!file.isEmpty) { "Uploaded CSV file is empty" }
        val parsed = csvParser.parse(file.inputStream)

        val existingTaskIds     = existing?.tasks?.map { it.id }?.toSet()     ?: emptySet()
        val existingResourceIds = existing?.resources?.map { it.id }?.toSet() ?: emptySet()
        val existingAllocKeys   = existing?.allocations?.map {
            AllocKey(it.taskId, it.resourceId, it.startDate.toString(), it.endDate.toString())
        }?.toSet() ?: emptySet()

        val newTasks     = parsed.tasks.filter { it.id !in existingTaskIds }
        val newResources = parsed.resources.filter { it.id !in existingResourceIds }
        val newAllocs    = parsed.allocations.filter {
            AllocKey(it.taskId, it.resourceId, it.startDate.toString(), it.endDate.toString()) !in existingAllocKeys
        }

        val skippedTasks     = parsed.tasks.size - newTasks.size
        val skippedResources = parsed.resources.size - newResources.size
        val skippedAllocs    = parsed.allocations.size - newAllocs.size

        val skipWarnings = buildList {
            if (skippedTasks > 0)     add("$skippedTasks task(s) already in plan, skipped")
            if (skippedResources > 0) add("$skippedResources resource(s) already in plan, skipped")
            if (skippedAllocs > 0)    add("$skippedAllocs allocation(s) already in plan, skipped")
        }

        return ImportCsvResponse(
            tasks       = (existing?.tasks       ?: emptyList()) + newTasks,
            resources   = (existing?.resources   ?: emptyList()) + newResources,
            allocations = (existing?.allocations ?: emptyList()) + newAllocs,
            warnings    = parsed.warnings + skipWarnings,
        )
    }
}
