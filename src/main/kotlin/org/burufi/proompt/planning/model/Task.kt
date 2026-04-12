package org.burufi.proompt.planning.model

data class Task(
    val id: String,
    val title: String,
    val project: String? = null,
    val status: String? = null,
    val type: TaskType = TaskType.STORY,
    val parentId: String? = null,
)

enum class TaskType {
    STORY,
    FEATURE,
    FEATURE_ENABLER,
}
