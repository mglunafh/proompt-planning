package org.burufi.proompt.planning.controller

import org.burufi.proompt.planning.dto.TimelineRequest
import org.burufi.proompt.planning.dto.TimelineResponse
import org.burufi.proompt.planning.service.TimelineService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/timeline")
class TimelineController(private val timelineService: TimelineService) {

    @PostMapping
    fun getTimeline(@RequestBody request: TimelineRequest): ResponseEntity<TimelineResponse> =
        ResponseEntity.ok(timelineService.filter(request))
}
