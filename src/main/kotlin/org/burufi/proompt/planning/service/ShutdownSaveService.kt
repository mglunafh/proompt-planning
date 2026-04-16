package org.burufi.proompt.planning.service

import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component

@Component
class ShutdownSaveService(
    private val planStateHolder: PlanStateHolder,
    private val planSaveService: PlanSaveService,
) : DisposableBean {

    override fun destroy() {
        val snapshot = planStateHolder.snapshot ?: return
        planSaveService.save(snapshot)
    }
}
