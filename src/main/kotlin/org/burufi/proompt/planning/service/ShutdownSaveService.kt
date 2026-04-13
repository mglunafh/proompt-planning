package org.burufi.proompt.planning.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class ShutdownSaveService(
    private val planStateHolder: PlanStateHolder,
    private val objectMapper: ObjectMapper,
) : DisposableBean {

    private val log = LoggerFactory.getLogger(ShutdownSaveService::class.java)

    override fun destroy() {
        val snapshot = planStateHolder.snapshot ?: return
        val filename = planStateHolder.sourceFilename ?: "snapshot"

        val dataDir = File(System.getProperty("user.dir"), "data")
        if (!dataDir.exists()) {
            if (!dataDir.mkdirs()) {
                log.warn("Shutdown save skipped: could not create directory: ${dataDir.absolutePath}")
                return
            }
        } else if (!dataDir.isDirectory) {
            log.warn("Shutdown save skipped: path is not a directory: ${dataDir.absolutePath}")
            return
        }

        val rawBase = filename.substringBeforeLast('.')
        val baseName = rawBase.replace(Regex("_\\d{8}_\\d{6}$"), "")
        val datetime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
        val saveFile = File(dataDir, "${baseName}_${datetime}.json")

        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(saveFile, snapshot)
            log.info("Plan saved on shutdown: ${saveFile.absolutePath}")
        } catch (e: Exception) {
            log.warn("Shutdown save failed: ${e.message}")
        }
    }
}
