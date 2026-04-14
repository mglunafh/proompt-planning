package org.burufi.proompt.planning.model

data class Resource(
    val id: String,
    val name: String,
    val role: Role,
)

enum class Role {
    ANALYST,
    DEVELOPER,
    PRODUCT_OWNER,
    TESTER,
}
