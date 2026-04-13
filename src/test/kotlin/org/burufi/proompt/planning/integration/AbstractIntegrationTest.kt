package org.burufi.proompt.planning.integration

import org.burufi.proompt.planning.service.PlanStateHolder
import org.junit.jupiter.api.AfterEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc

@SpringBootTest
@AutoConfigureMockMvc
abstract class AbstractIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var planStateHolder: PlanStateHolder

    @AfterEach
    fun cleanUpPlanState() {
        planStateHolder.reset()
    }
}
