package org.burufi.proompt.planning.integration

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
class ImportControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

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
