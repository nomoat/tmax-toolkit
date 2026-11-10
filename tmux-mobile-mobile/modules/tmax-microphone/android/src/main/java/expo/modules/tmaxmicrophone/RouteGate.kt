package expo.modules.tmaxmicrophone

/** Gate every buffer, including buffers waiting in the native-to-JS queue. */
internal class RouteGate(private val builtInType: Int) {
  @Volatile var revision = 0L
    private set
  @Volatile var verified = false
    private set
  @Volatile var active = true
    private set

  @Synchronized fun routeChanged(type: Int?) {
    revision++
    if (verified && type != builtInType) active = false
  }

  @Synchronized fun accept(before: Int?, after: Int?, readRevision: Long): Boolean {
    if (!active) return false
    if (verified && (before != builtInType || after != builtInType)) {
      active = false
      return false
    }
    if (readRevision != revision || before != builtInType || after != builtInType) return false
    verified = true
    return true
  }

  fun canDeliver(type: Int?, bufferRevision: Long): Boolean =
    active && verified && type == builtInType && bufferRevision == revision

  @Synchronized fun close() { active = false }
}
