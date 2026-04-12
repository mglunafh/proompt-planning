package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.exception.ValidationException
import org.burufi.proompt.planning.model.Snapshot
import org.springframework.stereotype.Service

@Service
class JsonImportService(private val validationService: ValidationService) {

    fun import(snapshot: Snapshot): Snapshot {
        val normalized = normalize(snapshot)
        val result = validationService.validate(normalized)
        if (!result.valid) {
            throw ValidationException("Snapshot validation failed", result.issues)
        }
        return normalized
    }

    private fun normalize(snapshot: Snapshot): Snapshot =
        snapshot.copy(
            tasks = snapshot.tasks.map { it.copy(title = it.title.trim(), project = it.project?.trim(), status = it.status?.trim()) },
            resources = snapshot.resources.map { it.copy(name = it.name.trim()) },
        )
}
