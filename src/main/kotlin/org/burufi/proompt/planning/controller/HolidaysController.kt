package org.burufi.proompt.planning.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/holidays")
class HolidaysController {

    private val holidays = listOf(
        LocalDate.of(2026, 5, 1),
        LocalDate.of(2026, 5, 9),
        LocalDate.of(2026, 5, 11),
        LocalDate.of(2026, 6, 12),
    )

    @GetMapping
    fun getHolidays(): ResponseEntity<List<LocalDate>> = ResponseEntity.ok(holidays)
}
