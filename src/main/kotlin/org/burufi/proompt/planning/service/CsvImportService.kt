package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.parser.CsvParser
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

@Service
class CsvImportService(private val csvParser: CsvParser) {

    fun import(file: MultipartFile): ImportCsvResponse {
        require(!file.isEmpty) { "Uploaded CSV file is empty" }
        return csvParser.parse(file.inputStream)
    }

    fun merge(file: MultipartFile, existing: Snapshot?): ImportCsvResponse {
        require(!file.isEmpty) { "Uploaded CSV file is empty" }
        val parsed = csvParser.parse(file.inputStream)

        val existingTaskIds     = existing?.tasks?.map { it.id }?.toSet()     ?: emptySet()
        val existingResourceIds = existing?.resources?.map { it.id }?.toSet() ?: emptySet()

        val newTasks     = parsed.tasks.filter { it.id !in existingTaskIds }
        val newResources = parsed.resources.filter { it.id !in existingResourceIds }

        val skippedTasks     = parsed.tasks.size - newTasks.size
        val skippedResources = parsed.resources.size - newResources.size

        val skipWarnings = buildList {
            if (skippedTasks > 0)     add("$skippedTasks task(s) already in plan, skipped")
            if (skippedResources > 0) add("$skippedResources resource(s) already in plan, skipped")
        }

        return ImportCsvResponse(
            tasks       = (existing?.tasks       ?: emptyList()) + newTasks,
            resources   = (existing?.resources   ?: emptyList()) + newResources,
            allocations = existing?.allocations  ?: emptyList(),
            warnings    = parsed.warnings + skipWarnings,
        )
    }
}
