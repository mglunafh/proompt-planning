package org.burufi.proompt.planning.controller

import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.service.ExportService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/export")
class ExportController(private val exportService: ExportService) {

    @PostMapping
    fun export(@RequestBody snapshot: Snapshot): ResponseEntity<Snapshot> =
        ResponseEntity.ok(exportService.export(snapshot))
}
