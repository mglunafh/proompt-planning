package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.model.Snapshot
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class ExportService(private val planSaveService: PlanSaveService) {

    fun export(snapshot: Snapshot): Snapshot {
        val enriched = snapshot.copy(
            version = "1.0.${System.currentTimeMillis()}",
            generatedAt = Instant.now(),
        )
        planSaveService.save(enriched)
        return enriched
    }
}
