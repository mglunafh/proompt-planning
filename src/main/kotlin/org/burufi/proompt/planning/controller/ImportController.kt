package org.burufi.proompt.planning.controller

import com.fasterxml.jackson.databind.ObjectMapper
import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.model.AllocationPlan
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.service.CsvImportService
import org.burufi.proompt.planning.service.JsonImportService
import org.burufi.proompt.planning.service.PlanStateHolder
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/import")
class ImportController(
    private val csvImportService: CsvImportService,
    private val jsonImportService: JsonImportService,
    private val planStateHolder: PlanStateHolder,
    private val objectMapper: ObjectMapper,
) {

    @PostMapping("/csv", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun importCsv(@RequestParam("file") file: MultipartFile): ResponseEntity<ImportCsvResponse> {
        val response = csvImportService.import(file)
        val allocations = jsonImportService.normalizeAllocations(response.allocations, response.resources)
        val defaultPlan = AllocationPlan(UUID.randomUUID().toString(), "Plan 1", allocations)
        val snapshot = Snapshot(
            version = "1.0",
            generatedAt = Instant.now(),
            tasks = response.tasks,
            resources = response.resources,
            allocations = emptyList(),
            plans = listOf(defaultPlan),
            activePlanId = defaultPlan.id,
        )
        planStateHolder.update(snapshot, file.originalFilename ?: "import.csv")
        return ResponseEntity.ok(response.copy(allocations = allocations))
    }

    @PostMapping("/csv/merge", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun mergeCsv(@RequestParam("file") file: MultipartFile): ResponseEntity<ImportCsvResponse> {
        val existing = planStateHolder.snapshot
        val response = csvImportService.merge(file, existing)
        val existingPlans = existing?.plans ?: emptyList()
        val plans = if (existingPlans.isEmpty()) {
            listOf(AllocationPlan(UUID.randomUUID().toString(), "Plan 1", emptyList()))
        } else {
            existingPlans
        }
        val activePlanId = existing?.activePlanId ?: plans.first().id
        val merged = Snapshot(
            version = "1.0",
            generatedAt = Instant.now(),
            tasks = response.tasks,
            resources = response.resources,
            allocations = emptyList(),
            vacations = existing?.vacations ?: emptyList(),
            plans = plans,
            activePlanId = activePlanId,
        )
        planStateHolder.update(merged, file.originalFilename ?: "merge.csv")
        return ResponseEntity.ok(response)
    }

    @PostMapping("/plan", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun importPlan(@RequestParam("file") file: MultipartFile): ResponseEntity<Snapshot> {
        val snapshot = objectMapper.readValue(file.inputStream, Snapshot::class.java)
        val result = jsonImportService.import(snapshot)
        planStateHolder.update(result, file.originalFilename ?: "snapshot.json")
        return ResponseEntity.ok(result)
    }
}
