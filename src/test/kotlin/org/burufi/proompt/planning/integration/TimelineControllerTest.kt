package org.burufi.proompt.planning.integration

import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

class TimelineControllerTest : AbstractIntegrationTest() {

    private val baseSnapshot = """
        {
          "version": "1.0",
          "generatedAt": "2025-05-01T00:00:00Z",
          "tasks": [
            {"id": "T-1", "title": "Task One"},
            {"id": "T-2", "title": "Task Two"}
          ],
          "resources": [
            {"id": "res-1", "name": "Alice", "role": "DEVELOPER"}
          ],
          "allocations": [
            {"taskId": "T-1", "resourceId": "res-1", "startDate": "2025-05-01", "endDate": "2025-05-15"},
            {"taskId": "T-2", "resourceId": "res-1", "startDate": "2025-06-01", "endDate": "2025-06-30"}
          ],
          "vacations": []
        }
    """.trimIndent()

    @Test
    fun `filters allocations to requested date range`() {
        val request = """
            {
              "snapshot": $baseSnapshot,
              "from": "2025-05-01",
              "to": "2025-05-31",
              "mode": "RESOURCE"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/timeline")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.allocations.length()").value(1))
            .andExpect(jsonPath("$.allocations[0].taskId").value("T-1"))
            .andExpect(jsonPath("$.tasks.length()").value(1))
    }

    @Test
    fun `returns empty when no allocations overlap range`() {
        val request = """
            {
              "snapshot": $baseSnapshot,
              "from": "2025-01-01",
              "to": "2025-01-31",
              "mode": "RESOURCE"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/timeline")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.allocations.length()").value(0))
            .andExpect(jsonPath("$.tasks.length()").value(0))
    }

    @Test
    fun `task mode returns same filtered data`() {
        val request = """
            {
              "snapshot": $baseSnapshot,
              "from": "2025-06-01",
              "to": "2025-06-30",
              "mode": "TASK"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/timeline")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.allocations[0].taskId").value("T-2"))
    }
}
