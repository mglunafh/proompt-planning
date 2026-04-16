package org.burufi.proompt.planning.parser

import org.apache.commons.csv.CSVFormat
import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.model.Resource
import org.burufi.proompt.planning.model.Role
import org.burufi.proompt.planning.model.Task
import org.burufi.proompt.planning.model.TaskType
import org.springframework.stereotype.Component
import java.io.InputStream
import java.io.InputStreamReader

@Component
class CsvParser {

    fun parse(inputStream: InputStream): ImportCsvResponse {
        val warnings = mutableListOf<String>()
        val reader = InputStreamReader(inputStream, Charsets.UTF_8)

        val csvFormat = CSVFormat.DEFAULT.builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .setIgnoreHeaderCase(true)
            .setTrim(true)
            .setIgnoreEmptyLines(true)
            .build()

        val records = csvFormat.parse(reader).records
        if (records.isEmpty()) {
            warnings += "CSV file is empty or contains only headers"
            return ImportCsvResponse(emptyList(), emptyList(), emptyList(), warnings)
        }

        val headers = records.first().parser.headerNames
        val mapping = ColumnMapper.detect(headers, warnings)

        if (mapping.taskId == null || mapping.taskTitle == null) {
            warnings += "Cannot parse tasks: required columns (task ID, title) not found"
            return ImportCsvResponse(emptyList(), emptyList(), emptyList(), warnings)
        }

        val tasks = mutableListOf<Task>()
        val resourcesById = mutableMapOf<String, Resource>()
        val seenTaskIds = mutableSetOf<String>()

        for ((rowIndex, record) in records.withIndex()) {
            val taskId = record.get(mapping.taskId).trim()
            if (taskId.isBlank()) {
                warnings += "Row ${rowIndex + 2}: blank task ID, skipping"
                continue
            }
            if (taskId in seenTaskIds) {
                warnings += "Row ${rowIndex + 2}: duplicate task ID '$taskId', skipping"
                continue
            }
            seenTaskIds += taskId

            val title = record.get(mapping.taskTitle).trim().ifBlank { taskId }
            val project = mapping.project?.let { record.get(it).trim().ifBlank { null } }
            val status = mapping.status?.let { record.get(it).trim().ifBlank { null } }
            val taskType = mapping.taskType?.let { parseTaskType(record.get(it).trim(), rowIndex + 2, warnings) }
                ?: TaskType.STORY
            val parentId = mapping.parentId?.let { record.get(it).trim().ifBlank { null } }

            tasks += Task(id = taskId, title = title, project = project, status = status, type = taskType, parentId = parentId)

            val assigneeName = mapping.assignee?.let { record.get(it).trim().ifBlank { null } }
            if (assigneeName != null) {
                val resourceId = toResourceId(assigneeName)
                resourcesById.getOrPut(resourceId) {
                    Resource(id = resourceId, name = assigneeName, role = Role.DEVELOPER)
                }
            }
        }

        return ImportCsvResponse(
            tasks = tasks,
            resources = resourcesById.values.toList(),
            allocations = emptyList(),
            warnings = warnings,
        )
    }

    private fun parseTaskType(raw: String, row: Int, warnings: MutableList<String>): TaskType {
        return when (raw.lowercase().replace("[^a-z]".toRegex(), "")) {
            "story" -> TaskType.STORY
            "feature" -> TaskType.FEATURE
            "featureenabler", "enabler" -> TaskType.FEATURE_ENABLER
            "rnd", "r&d", "rd" -> TaskType.RND
            else -> {
                warnings += "Row $row: unknown task type '$raw', defaulting to STORY"
                TaskType.STORY
            }
        }
    }

    private fun toResourceId(name: String): String =
        name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
}
