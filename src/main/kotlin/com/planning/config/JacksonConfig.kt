package com.planning.config

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.kotlinModule
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder

@Configuration
class JacksonConfig {

    @Bean
    fun objectMapper(builder: Jackson2ObjectMapperBuilder): ObjectMapper =
        builder
            .modules(JavaTimeModule(), kotlinModule())
            .featuresToDisable(
                SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
                DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
            )
            .build()
}
