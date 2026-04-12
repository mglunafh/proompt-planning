package org.burufi.proompt.planning.controller

import org.burufi.proompt.planning.dto.ValidationResponse
import org.burufi.proompt.planning.model.Snapshot
import org.burufi.proompt.planning.service.ValidationService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/validate")
class ValidateController(private val validationService: ValidationService) {

    @PostMapping
    fun validate(@RequestBody snapshot: Snapshot): ResponseEntity<ValidationResponse> =
        ResponseEntity.ok(validationService.validate(snapshot))
}
