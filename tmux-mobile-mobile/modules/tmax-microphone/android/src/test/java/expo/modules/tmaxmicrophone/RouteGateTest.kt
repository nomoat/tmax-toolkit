package expo.modules.tmaxmicrophone

import org.junit.Assert.*
import org.junit.Test

class RouteGateTest {
  private val builtin = 15
  private val bluetooth = 7

  @Test fun startupDropsUnknownAndExternalAudioUntilBuiltInRouteIsVerified() {
    val gate = RouteGate(builtin)
    assertFalse(gate.accept(null, null, gate.revision))
    assertFalse(gate.accept(bluetooth, bluetooth, gate.revision))
    assertFalse(gate.verified)
    assertTrue(gate.accept(builtin, builtin, gate.revision))
    assertTrue(gate.canDeliver(builtin, gate.revision))
  }

  @Test fun routeChangeDuringReadDropsBufferEvenIfRouteReturnsToBuiltIn() {
    val gate = RouteGate(builtin)
    val startedAt = gate.revision
    gate.routeChanged(builtin)
    assertFalse(gate.accept(builtin, builtin, startedAt))
    assertTrue(gate.accept(builtin, builtin, gate.revision))
  }

  @Test fun activeCaptureStopsOnBluetoothOrUnknownRouteAndCannotResumeSilently() {
    for (route in listOf(bluetooth, null)) {
      val gate = RouteGate(builtin)
      assertTrue(gate.accept(builtin, builtin, gate.revision))
      gate.routeChanged(route)
      assertFalse(gate.canDeliver(builtin, gate.revision))
      gate.routeChanged(builtin)
      assertFalse(gate.accept(builtin, builtin, gate.revision))
    }
  }

  @Test fun beforeAndAfterReadChecksCatchRouteChangesWithoutCallback() {
    val gate = RouteGate(builtin)
    assertTrue(gate.accept(builtin, builtin, gate.revision))
    assertFalse(gate.accept(builtin, bluetooth, gate.revision))
    assertFalse(gate.canDeliver(builtin, gate.revision))
  }

  @Test fun queuedBuffersCannotEscapeAfterStopOrRouteChange() {
    val gate = RouteGate(builtin)
    val bufferedAt = gate.revision
    assertTrue(gate.accept(builtin, builtin, bufferedAt))
    gate.routeChanged(builtin)
    assertFalse(gate.canDeliver(builtin, bufferedAt))
    gate.close()
    assertFalse(gate.canDeliver(builtin, gate.revision))
    assertFalse(gate.accept(builtin, builtin, gate.revision))
  }
}
