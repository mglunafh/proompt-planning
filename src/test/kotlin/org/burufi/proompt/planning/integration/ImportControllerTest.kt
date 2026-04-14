package org.burufi.proompt.planning.integration

import org.burufi.proompt.planning.service.PlanStateHolder
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ImportControllerTest : AbstractIntegrationTest() {

    @Autowired
    private lateinit var planStateHolder: PlanStateHolder

    @Test
    fun `POST api-import accepts valid CSV and returns tasks`() {
        val csv = """
            Issue key,Summary,Assignee,Start date,End date
            PRJ-1,Login page,Alice,2025-05-01,2025-05-15
            PRJ-2,Dashboard,Bob,2025-05-10,2025-05-20
        """.trimIndent().toByteArray()

        val file = MockMultipartFile("file", "tasks.csv", "text/csv", csv)

        mockMvc.perform(multipart("/api/import").file(file))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks.length()").value(2))
            .andExpect(jsonPath("$.tasks[0].id").value("PRJ-1"))
            .andExpect(jsonPath("$.resources.length()").value(2))
            .andExpect(jsonPath("$.allocations.length()").value(2))
    }

    @Test
    fun `POST api-import accepts CSV with alternate date-time format`() {
        val csv = """
            Issue key,Summary,Project name,Status,Issue Type,Assignee,Start date,End date
            PRJ-1,Login page,MyProject,In Progress,Story,Alice,01/May/25 09:00,15/May/25 18:00
            PRJ-2,Dashboard,MyProject,In Progress,Story,Bob,10/May/25 08:30,20/May/25 17:00
        """.trimIndent().toByteArray()

        val file = MockMultipartFile("file", "tasks.csv", "text/csv", csv)

        mockMvc.perform(multipart("/api/import").file(file))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks.length()").value(2))
            .andExpect(jsonPath("$.allocations.length()").value(2))
            .andExpect(jsonPath("$.allocations[0].startDate").value("2025-05-01"))
            .andExpect(jsonPath("$.allocations[0].endDate").value("2025-05-15"))
            .andExpect(jsonPath("$.warnings").isEmpty)
    }

    @Test
    fun `POST api-import-json accepts valid snapshot`() {
        val json = """
            {
              "version": "1.0",
              "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "T-1", "title": "Task One"}],
              "resources": [{"id": "res-1", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "T-1", "resourceId": "res-1", "startDate": "2025-05-01", "endDate": "2025-05-10"}],
              "vacations": []
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/import/json")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks[0].id").value("T-1"))
    }

    @Test
    fun `POST api-import-json loads plan with feature, stories, all roles, comments and vacation`() {
        val json = """
            {
              "version": "1.0",
              "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [
                {"id": "F-1", "title": "User Auth Feature", "type": "FEATURE"},
                {"id": "S-1", "title": "Login page",        "type": "STORY", "parentId": "F-1"},
                {"id": "S-2", "title": "Registration page", "type": "STORY", "parentId": "F-1"},
                {"id": "S-3", "title": "Password reset",    "type": "STORY", "parentId": "F-1"}
              ],
              "resources": [
                {"id": "dev-1",      "name": "Alice",   "role": "DEVELOPER"},
                {"id": "analyst-1",  "name": "Bob",     "role": "ANALYST"},
                {"id": "tester-1",   "name": "Charlie", "role": "TESTER"}
              ],
              "allocations": [
                {"taskId": "S-1", "resourceId": "dev-1",     "startDate": "2025-05-01", "endDate": "2025-05-10", "comment": "Core login flow"},
                {"taskId": "S-2", "resourceId": "dev-1",     "startDate": "2025-05-11", "endDate": "2025-05-20"},
                {"taskId": "S-3", "resourceId": "analyst-1", "startDate": "2025-05-01", "endDate": "2025-05-05", "comment": "Requirements analysis"},
                {"taskId": "S-1", "resourceId": "tester-1",  "startDate": "2025-05-11", "endDate": "2025-05-15", "comment": "Login smoke tests"}
              ],
              "vacations": [
                {"resourceId": "dev-1", "startDate": "2025-05-21", "endDate": "2025-05-23", "type": "DAY_OFF", "comment": "Bank holiday"}
              ]
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/import/json")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks.length()").value(4))
            .andExpect(jsonPath("$.tasks[?(@.id == 'F-1')].type").value("FEATURE"))
            .andExpect(jsonPath("$.tasks[?(@.id == 'S-1')].parentId").value("F-1"))
            .andExpect(jsonPath("$.resources.length()").value(3))
            .andExpect(jsonPath("$.allocations.length()").value(4))
            .andExpect(jsonPath("$.allocations[?(@.taskId == 'S-1' && @.resourceId == 'dev-1')].comment").value("Core login flow"))
            .andExpect(jsonPath("$.allocations[?(@.taskId == 'S-2' && @.resourceId == 'dev-1')][0].comment").doesNotExist())
            .andExpect(jsonPath("$.vacations.length()").value(1))
            .andExpect(jsonPath("$.vacations[0].resourceId").value("dev-1"))
            .andExpect(jsonPath("$.vacations[0].type").value("DAY_OFF"))
            .andExpect(jsonPath("$.vacations[0].comment").value("Bank holiday"))
    }

    // ── Merge CSV ─────────────────────────────────────────────────────────────

    @Test
    fun `POST api-import-csv-merge adds all items when plan is empty`() {
        val csv = """
            Issue key,Summary,Assignee,Start date,End date
            PRJ-1,Login page,Alice,2025-05-01,2025-05-15
            PRJ-2,Dashboard,Bob,2025-05-10,2025-05-20
        """.trimIndent().toByteArray()

        mockMvc.perform(multipart("/api/import/csv/merge").file(MockMultipartFile("file", "tasks.csv", "text/csv", csv)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks.length()").value(2))
            .andExpect(jsonPath("$.resources.length()").value(2))
            .andExpect(jsonPath("$.allocations.length()").value(2))
    }

    @Test
    fun `POST api-import-csv-merge skips existing tasks and resources, adds new ones`() {
        val seedJson = """
            {
              "version": "1.0", "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "PRJ-1", "title": "Login page", "type": "STORY"}],
              "resources": [{"id": "alice", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "PRJ-1", "resourceId": "alice", "startDate": "2025-05-01", "endDate": "2025-05-15"}],
              "vacations": []
            }
        """.trimIndent()
        mockMvc.perform(post("/api/import/json").contentType(MediaType.APPLICATION_JSON).content(seedJson))
            .andExpect(status().isOk)

        val csv = """
            Issue key,Summary,Assignee,Start date,End date
            PRJ-1,Login page,Alice,2025-05-01,2025-05-15
            PRJ-2,Dashboard,Bob,2025-05-10,2025-05-20
        """.trimIndent().toByteArray()

        mockMvc.perform(multipart("/api/import/csv/merge").file(MockMultipartFile("file", "merge.csv", "text/csv", csv)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tasks.length()").value(1))
            .andExpect(jsonPath("$.tasks[0].id").value("PRJ-2"))
            .andExpect(jsonPath("$.resources.length()").value(1))
            .andExpect(jsonPath("$.resources[0].id").value("bob"))
            .andExpect(jsonPath("$.allocations.length()").value(1))
            .andExpect(jsonPath("$.allocations[0].taskId").value("PRJ-2"))
    }

    @Test
    fun `POST api-import-csv-merge includes skip-count warnings`() {
        val seedJson = """
            {
              "version": "1.0", "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "PRJ-1", "title": "Login page", "type": "STORY"}],
              "resources": [{"id": "alice", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "PRJ-1", "resourceId": "alice", "startDate": "2025-05-01", "endDate": "2025-05-15"}],
              "vacations": []
            }
        """.trimIndent()
        mockMvc.perform(post("/api/import/json").contentType(MediaType.APPLICATION_JSON).content(seedJson))
            .andExpect(status().isOk)

        val csv = """
            Issue key,Summary,Assignee,Start date,End date
            PRJ-1,Login page,Alice,2025-05-01,2025-05-15
        """.trimIndent().toByteArray()

        mockMvc.perform(multipart("/api/import/csv/merge").file(MockMultipartFile("file", "merge.csv", "text/csv", csv)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.warnings[?(@ =~ /.*task.*skipped.*/i)]").isNotEmpty)
            .andExpect(jsonPath("$.warnings[?(@ =~ /.*resource.*skipped.*/i)]").isNotEmpty)
            .andExpect(jsonPath("$.warnings[?(@ =~ /.*allocation.*skipped.*/i)]").isNotEmpty)
    }

    @Test
    fun `POST api-import-csv-merge preserves existing vacations in plan state`() {
        val seedJson = """
            {
              "version": "1.0", "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "PRJ-1", "title": "Login page", "type": "STORY"}],
              "resources": [{"id": "alice", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "PRJ-1", "resourceId": "alice", "startDate": "2025-05-01", "endDate": "2025-05-15"}],
              "vacations": [{"resourceId": "alice", "startDate": "2025-05-21", "endDate": "2025-05-23", "type": "DAY_OFF"}]
            }
        """.trimIndent()
        mockMvc.perform(post("/api/import/json").contentType(MediaType.APPLICATION_JSON).content(seedJson))
            .andExpect(status().isOk)

        val csv = """
            Issue key,Summary,Assignee,Start date,End date
            PRJ-2,Dashboard,Bob,2025-05-10,2025-05-20
        """.trimIndent().toByteArray()

        mockMvc.perform(multipart("/api/import/csv/merge").file(MockMultipartFile("file", "merge.csv", "text/csv", csv)))
            .andExpect(status().isOk)

        val snapshot = assertNotNull(planStateHolder.snapshot)
        assertEquals(1, snapshot.vacations.size)
        assertEquals("alice", snapshot.vacations[0].resourceId)
        assertEquals(2, snapshot.tasks.size)
    }

    @Test
    fun `POST api-import-json rejects snapshot with broken references`() {
        val json = """
            {
              "version": "1.0",
              "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "T-1", "title": "Task One"}],
              "resources": [{"id": "res-1", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "T-1", "resourceId": "MISSING", "startDate": "2025-05-01", "endDate": "2025-05-10"}],
              "vacations": []
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/import/json")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json),
        )
            .andExpect(status().isUnprocessableEntity)
            .andExpect(jsonPath("$.error").exists())
    }
}
