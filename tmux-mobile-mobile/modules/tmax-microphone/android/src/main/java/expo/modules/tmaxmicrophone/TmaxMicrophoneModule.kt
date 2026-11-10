package expo.modules.tmaxmicrophone

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRouting
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.jni.NativeArrayBuffer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.sharedobjects.SharedObject
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

class MicrophoneOptions : Record {
  @Field var sampleRate: Int = 16000
  @Field var channels: Int = 1
  @Field var encoding: String = "float32"
}

class PhoneMicrophoneException(message: String) : CodedException(message)

class TmaxMicrophoneModule : Module() {
  private val streams = ConcurrentHashMap.newKeySet<PhoneMicrophoneStream>()

  override fun definition() = ModuleDefinition {
    Name("TmaxMicrophone")
    Constants("builtInOnly" to true)
    Class(PhoneMicrophoneStream::class) {
      Constructor { options: MicrophoneOptions ->
        PhoneMicrophoneStream(appContext, options) { streams.remove(it) }.also { streams.add(it) }
      }
      AsyncFunction("start") Coroutine { stream: PhoneMicrophoneStream -> stream.start() }
      Function("stop") { stream: PhoneMicrophoneStream -> stream.stop() }
    }
    OnActivityEntersBackground { streams.forEach { it.stop() } }
    OnDestroy {
      streams.forEach { it.stop() }
      streams.clear()
    }
  }
}

class PhoneMicrophoneStream(
  appContext: AppContext,
  private val options: MicrophoneOptions,
  private val onReleased: (PhoneMicrophoneStream) -> Unit
) : SharedObject(appContext) {
  private class Capture(val recorder: AudioRecord) {
    val gate = RouteGate(AudioDeviceInfo.TYPE_BUILTIN_MIC)
    val ready = CompletableDeferred<Unit>()
    val stopped = AtomicBoolean(false)
    val errorSent = AtomicBoolean(false)
    var workerStarted = false
    var listener: AudioRouting.OnRoutingChangedListener? = null
  }

  companion object {
    private val owner = AtomicReference<PhoneMicrophoneStream?>(null)
    private const val ROUTE_ERROR = "Phone microphone became unavailable. Recording stopped; your text was kept."
  }

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val handler = Handler(Looper.getMainLooper())
  private val stopRequested = AtomicBoolean(false)
  @Volatile private var capture: Capture? = null

  suspend fun start() {
    if (stopRequested.get()) throw PhoneMicrophoneException("Recording stopped.")
    if (!owner.compareAndSet(null, this)) throw PhoneMicrophoneException("Microphone is already in use.")
    var current: Capture? = null
    try {
      val context = appContext?.reactContext ?: throw PhoneMicrophoneException("Microphone context unavailable.")
      if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw PhoneMicrophoneException("Microphone permission denied.")
      }
      if (options.sampleRate != 16000 || options.channels != 1 || options.encoding != "float32") {
        throw PhoneMicrophoneException("Unsupported phone microphone format.")
      }
      val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val input = manager.getDevices(AudioManager.GET_DEVICES_INPUTS)
        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_MIC }
        ?: throw PhoneMicrophoneException("Phone microphone is unavailable.")
      val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_FLOAT)
      if (minimum <= 0) throw PhoneMicrophoneException("Phone microphone format is unavailable.")
      val recorder = AudioRecord.Builder()
        .setAudioSource(MediaRecorder.AudioSource.MIC)
        .setAudioFormat(AudioFormat.Builder().setSampleRate(16000).setChannelMask(AudioFormat.CHANNEL_IN_MONO)
          .setEncoding(AudioFormat.ENCODING_PCM_FLOAT).build())
        .setBufferSizeInBytes(maxOf(minimum, 12800)).build()
      current = Capture(recorder)
      capture = current
      if (stopRequested.get()) throw PhoneMicrophoneException("Recording stopped.")
      if (recorder.state != AudioRecord.STATE_INITIALIZED || !recorder.setPreferredDevice(input)) {
        throw PhoneMicrophoneException("Could not select the phone microphone.")
      }
      val session = current
      session.listener = AudioRouting.OnRoutingChangedListener {
        session.gate.routeChanged(routeType(session))
        if (!session.gate.active) fail(session, ROUTE_ERROR)
      }
      recorder.addOnRoutingChangedListener(session.listener!!, handler)
      recorder.startRecording()
      if (stopRequested.get()) throw PhoneMicrophoneException("Recording stopped.")
      session.workerStarted = true
      scope.launch { read(session) }
      // Actual routing is only available after capture starts. No audio crosses
      // the bridge until a complete read has confirmed built-in routing.
      withTimeout(2500) { session.ready.await() }
    } catch (error: Throwable) {
      current?.let { stopCapture(it) }
      if (current != null && !current.workerStarted) current.recorder.release()
      owner.compareAndSet(this, null)
      if (error is PhoneMicrophoneException) throw error
      throw PhoneMicrophoneException("Could not start the phone microphone. Try again.")
    }
  }

  private fun routeType(session: Capture): Int? = try { session.recorder.routedDevice?.type } catch (_: Exception) { null }

  private fun read(session: Capture) {
    try {
      while (!session.stopped.get()) {
        val revision = session.gate.revision
        val before = routeType(session)
        val buffer = ByteBuffer.allocateDirect(6400).order(ByteOrder.nativeOrder())
        val count = session.recorder.read(buffer, buffer.capacity(), AudioRecord.READ_BLOCKING)
        if (session.stopped.get()) break
        val after = routeType(session)
        if (count < 0) throw PhoneMicrophoneException("Phone microphone read failed.")
        if (count == 0) continue
        if (!session.gate.accept(before, after, revision)) {
          if (!session.gate.active) throw PhoneMicrophoneException(ROUTE_ERROR)
          continue
        }
        session.ready.complete(Unit)
        buffer.limit(count)
        handler.post {
          if (capture === session && session.gate.canDeliver(routeType(session), revision)) {
            emit("audioStreamBuffer", mapOf("data" to NativeArrayBuffer(buffer), "sampleRate" to 16000, "channels" to 1))
          }
        }
      }
    } catch (error: Exception) {
      if (!session.stopped.get()) fail(session, error.message ?: ROUTE_ERROR)
    } finally {
      stopCapture(session)
      session.recorder.release()
    }
  }

  private fun fail(session: Capture, message: String) {
    session.ready.completeExceptionally(PhoneMicrophoneException(message))
    stopCapture(session)
    if (session.errorSent.compareAndSet(false, true)) handler.post {
      if (capture === session) emit("audioStreamError", mapOf("message" to message))
    }
  }

  private fun stopCapture(session: Capture) {
    session.gate.close()
    if (!session.stopped.compareAndSet(false, true)) return
    session.listener?.let { session.recorder.removeOnRoutingChangedListener(it) }
    try { session.recorder.stop() } catch (_: Exception) {}
    owner.compareAndSet(this, null)
  }

  fun stop() {
    stopRequested.set(true)
    capture?.let { session ->
      session.ready.completeExceptionally(PhoneMicrophoneException("Recording stopped."))
      stopCapture(session)
    }
  }

  override fun sharedObjectDidRelease() {
    stop()
    scope.cancel()
    onReleased(this)
    super.sharedObjectDidRelease()
  }
}
