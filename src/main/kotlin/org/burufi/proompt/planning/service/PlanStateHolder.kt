package org.burufi.proompt.planning.service

import org.burufi.proompt.planning.model.Snapshot
import org.springframework.stereotype.Component

@Component
class PlanStateHolder {

    @Volatile var snapshot: Snapshot? = null
        internal set

    @Volatile var sourceFilename: String? = null
        internal set

    fun update(snapshot: Snapshot, filename: String) {
        this.snapshot = snapshot
        this.sourceFilename = filename
    }

    fun reset() {
        snapshot = null
        sourceFilename = null
    }
}
