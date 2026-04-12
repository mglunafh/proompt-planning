package org.burufi.proompt.planning.controller

import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.service.CsvImportService
import org.burufi.proompt.planning.service.JsonImportService
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/import")
class ImportController(
    private val csvImportService: CsvImportService,
    private val jsonImportService: JsonImportService,
) {

    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun importCsv(@RequestParam("file") file: MultipartFile): ResponseEntity<ImportCsvResponse> =
        ResponseEntity.ok(csvImportService.import(file))

    @PostMapping("/json", consumes = [MediaType.APPLICATION_JSON_VALUE])
    fun importJson(@RequestBody snapshot: Snapshot): ResponseEntity<Snapshot> =
        ResponseEntity.ok(jsonImportService.import(snapshot))
}
