package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.dto.ImportCsvResponse
import org.burufi.proompt.planning.parser.CsvParser
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

@Service
class CsvImportService(private val csvParser: CsvParser) {

    fun import(file: MultipartFile): ImportCsvResponse {
        require(!file.isEmpty) { "Uploaded CSV file is empty" }
        return csvParser.parse(file.inputStream)
    }
}
