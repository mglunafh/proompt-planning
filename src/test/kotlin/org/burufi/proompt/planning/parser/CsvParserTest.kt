package org.burufi.proompt.planning.parser

import org.burufi.proompt.planning.model.TaskType
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CsvParserTest {

    private val parser = CsvParser()

    private fun csv(vararg lines: String): ByteArray = lines.joinToString("\n").toByteArray(Charsets.UTF_8)

    @Test
    fun `empty file returns empty result with warning`() {
        val result = parser.parse(csv("").inputStream())
        assertTrue(result.tasks.isEmpty())
        assertTrue(result.warnings.isNotEmpty())
    }

    @Test
    fun `header only returns empty result with warning`() {
        val result = parser.parse(csv("Issue key,Summary").inputStream())
        assertTrue(result.tasks.isEmpty())
        assertTrue(result.warnings.any { it.contains("empty") })
    }

    @Test
    fun `minimal columns parse tasks correctly`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary",
                "PRJ-1,Login page",
                "PRJ-2,Dashboard",
            ).inputStream(),
        )
        assertEquals(2, result.tasks.size)
        assertEquals("PRJ-1", result.tasks[0].id)
        assertEquals("Login page", result.tasks[0].title)
        assertEquals("PRJ-2", result.tasks[1].id)
    }

    @Test
    fun `full jira csv parses tasks and resources`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Project name,Status,Assignee,Start date,End date",
                "PRJ-1,Login,My Project,In Progress,Alice Smith,2025-05-01,2025-05-15",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertEquals("My Project", result.tasks[0].project)
        assertEquals("In Progress", result.tasks[0].status)
        assertEquals(1, result.resources.size)
        assertEquals("Alice Smith", result.resources[0].name)
        assertTrue(result.allocations.isEmpty())
    }

    @Test
    fun `blank task ID rows are skipped with warning`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary",
                ",Empty ID row",
                "PRJ-1,Real task",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertTrue(result.warnings.any { it.contains("blank task ID") })
    }

    @Test
    fun `duplicate task IDs are skipped with warning`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary",
                "PRJ-1,First",
                "PRJ-1,Duplicate",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertTrue(result.warnings.any { it.contains("duplicate") })
    }

    @Test
    fun `assignee with date columns still parses task and resource`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Assignee,Start date,End date",
                "PRJ-1,Task,Bob,not-a-date,2025-05-15",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertEquals(1, result.resources.size)
        assertTrue(result.allocations.isEmpty())
    }

    @Test
    fun `utf-8 characters in title are preserved`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary",
                "PRJ-1,Ünïcödé Títlé",
            ).inputStream(),
        )
        assertEquals("Ünïcödé Títlé", result.tasks[0].title)
    }

    @Test
    fun `same assignee on multiple tasks produces one resource`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Assignee,Start date,End date",
                "PRJ-1,Task 1,Alice,2025-05-01,2025-05-10",
                "PRJ-2,Task 2,Alice,2025-05-11,2025-05-20",
            ).inputStream(),
        )
        assertEquals(1, result.resources.size)
        assertTrue(result.allocations.isEmpty())
    }

    @Test
    fun `Story-to-Feature column populates parentId`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Issue Type,Story-to-Feature",
                "FE-1,My Feature,Feature,",
                "ST-1,Child Story,Story,FE-1",
            ).inputStream(),
        )
        assertEquals(2, result.tasks.size)
        assertEquals(null, result.tasks.find { it.id == "FE-1" }?.parentId)
        assertEquals("FE-1", result.tasks.find { it.id == "ST-1" }?.parentId)
    }

    @Test
    fun `blank Story-to-Feature value yields null parentId`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Story-to-Feature",
                "PRJ-1,Orphan Story,",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertEquals(null, result.tasks[0].parentId)
    }

    @Test
    fun `absent parent column yields null parentId with no extra warning`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary",
                "PRJ-1,Some Task",
            ).inputStream(),
        )
        assertEquals(null, result.tasks[0].parentId)
        assertTrue(result.warnings.none { it.contains("parent", ignoreCase = true) })
    }

    @Test
    fun `Epic Link column is also detected as parentId`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Epic Link",
                "PRJ-1,Feature,,",
                "PRJ-2,Story,PRJ-1",
            ).inputStream(),
        )
        assertEquals("PRJ-1", result.tasks.find { it.id == "PRJ-2" }?.parentId)
    }

    @Test
    fun `Issue Type column maps Feature-Enabler correctly`() {
        val result = parser.parse(
            csv(
                "Issue key,Summary,Issue Type",
                "FE-1,Enabler task,Feature-Enabler",
            ).inputStream(),
        )
        assertEquals(1, result.tasks.size)
        assertEquals(TaskType.FEATURE_ENABLER, result.tasks[0].type)
    }
}
