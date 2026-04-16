package org.burufi.proompt.planning.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.burufi.proompt.planning.model.Snapshot
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Service
class PlanSaveService(
    private val planStateHolder: PlanStateHolder,
    private val objectMapper: ObjectMapper,
) {

    private val log = LoggerFactory.getLogger(PlanSaveService::class.java)

    fun save(snapshot: Snapshot, filename: String? = null) {
        val dataDir = File(System.getProperty("user.dir"), "data")
        if (!dataDir.exists()) {
            if (!dataDir.mkdirs()) {
                log.warn("Save skipped: could not create directory: ${dataDir.absolutePath}")
                return
            }
        } else if (!dataDir.isDirectory) {
            log.warn("Save skipped: path is not a directory: ${dataDir.absolutePath}")
            return
        }

        val saveFile = if (filename != null) {
            val name = filename.removeSuffix(".json")
            File(dataDir, "${name}.json")
        } else {
            val source = planStateHolder.sourceFilename ?: "snapshot"
            val rawBase = source.substringBeforeLast('.')
            val baseName = rawBase.replace(Regex("_\\d{8}_\\d{6}$"), "")
            val datetime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
            File(dataDir, "${baseName}_${datetime}.json")
        }

        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(saveFile, snapshot)
            log.info("Plan saved: ${saveFile.absolutePath}")
        } catch (e: Exception) {
            log.warn("Save failed: ${e.message}")
        }
    }
}
