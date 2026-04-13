package org.burufi.proompt.planning.integration

import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

class ValidateControllerTest : AbstractIntegrationTest() {

    @Test
    fun `valid snapshot returns valid true`() {
        val json = """
            {
              "version": "1.0",
              "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "T-1", "title": "Task"}],
              "resources": [{"id": "res-1", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "T-1", "resourceId": "res-1", "startDate": "2025-05-01", "endDate": "2025-05-10"}],
              "vacations": []
            }
        """.trimIndent()

        mockMvc.perform(post("/api/validate").contentType(MediaType.APPLICATION_JSON).content(json))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.issues").isEmpty)
    }

    @Test
    fun `snapshot with broken reference returns valid false with issues`() {
        val json = """
            {
              "version": "1.0",
              "generatedAt": "2025-05-01T00:00:00Z",
              "tasks": [{"id": "T-1", "title": "Task"}],
              "resources": [{"id": "res-1", "name": "Alice", "role": "DEVELOPER"}],
              "allocations": [{"taskId": "T-1", "resourceId": "GHOST", "startDate": "2025-05-01", "endDate": "2025-05-10"}],
              "vacations": []
            }
        """.trimIndent()

        mockMvc.perform(post("/api/validate").contentType(MediaType.APPLICATION_JSON).content(json))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.issues.length()").value(1))
            .andExpect(jsonPath("$.issues[0].severity").value("ERROR"))
    }
}
