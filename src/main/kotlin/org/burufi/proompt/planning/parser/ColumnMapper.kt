package org.burufi.proompt.planning.parser

object ColumnMapper {

    private val TASK_ID = listOf("Issue key", "Key", "ID", "id", "Issue Id")
    private val TASK_TITLE = listOf("Summary", "Title", "Issue summary", "Name")
    private val PROJECT = listOf("Project name", "Project", "Project key")
    private val STATUS = listOf("Status", "Issue status")
    private val TASK_TYPE = listOf("Issue Type", "Type", "Task type", "Issue type")
    private val ASSIGNEE = listOf("Assignee", "Assignee Name", "Resource")
    private val START_DATE = listOf("Start date", "Start Date", "Created")
    private val END_DATE = listOf("End date", "End Date", "Due date", "Due Date")
    private val PARENT_ID = listOf("Story-to-Feature", "Epic Link", "Parent", "Parent Link", "Parent issue", "Epic key", "Parent id", "ParentId")

    data class Mapping(
        val taskId: String?,
        val taskTitle: String?,
        val project: String?,
        val status: String?,
        val taskType: String?,
        val assignee: String?,
        val startDate: String?,
        val endDate: String?,
        val parentId: String?,
    )

    fun detect(headers: List<String>, warnings: MutableList<String>): Mapping {
        val taskId = findColumn(headers, TASK_ID, "task ID", warnings)
        val taskTitle = findColumn(headers, TASK_TITLE, "task title", warnings)
        val project = findColumn(headers, PROJECT, "project", warnings)
        val status = findColumn(headers, STATUS, "status", warnings)
        val taskType = findColumn(headers, TASK_TYPE, "task type", warnings)
        val assignee = findColumn(headers, ASSIGNEE, "assignee", warnings)
        val startDate = findColumn(headers, START_DATE, "start date", warnings)
        val endDate = findColumn(headers, END_DATE, "end date", warnings)
        val parentId = findColumnOptional(headers, PARENT_ID)

        return Mapping(
            taskId = taskId,
            taskTitle = taskTitle,
            project = project,
            status = status,
            taskType = taskType,
            assignee = assignee,
            startDate = startDate,
            endDate = endDate,
            parentId = parentId,
        )
    }

    private fun findColumn(
        headers: List<String>,
        candidates: List<String>,
        fieldName: String,
        warnings: MutableList<String>,
    ): String? {
        val match = findColumnOptional(headers, candidates)
        if (match == null) {
            warnings += "No column found for '$fieldName' (tried: ${candidates.joinToString()})"
        }
        return match
    }

    private fun findColumnOptional(headers: List<String>, candidates: List<String>): String? =
        candidates
            .firstOrNull { candidate -> headers.any { it.equals(candidate, ignoreCase = true) } }
            ?.let { candidate -> headers.first { it.equals(candidate, ignoreCase = true) } }
}
