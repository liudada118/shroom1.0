import ExpoModulesCore
import UIKit

/** Native USB transport and bounded AA550399 frame parser for the RN host. */
public final class ShroomUsbSerialModule: Module {
  private let worker = DispatchQueue(label: "shroom.usb.reader", qos: .userInitiated)
  private let client = ShroomDriverClient()
  private var connected = false
  private var generation: UInt64 = 0
  private var connectionID = UUID().uuidString
  private var sequence: UInt64 = 0
  private var latestFrame: [String: Any]?
  private var lastEmission: TimeInterval = 0

  /** Register real USB operations; unavailable hardware and drivers produce explicit failures. */
  public func definition() -> ModuleDefinition {
    Name("ShroomUsbSerial")
    Events("onFrame", "onState")

    AsyncFunction("capabilities") { () -> [String: Any] in
      #if targetEnvironment(simulator)
      return ["supported": false, "platform": "ios", "reason": "模拟器不支持 USB；请使用 M 系列 iPad 真机。"]
      #else
      let isPad = UIDevice.current.userInterfaceIdiom == .pad
      return ["supported": isPad, "platform": "ios", "reason": "USB 直连需要 M 系列 iPad、嵌入并启用 DriverKit 驱动及 Apple 签名授权。"]
      #endif
    }
    AsyncFunction("listDevices") { () throws -> [[String: Any]] in
      return try ShroomDriverClient.listDevices() as? [[String: Any]] ?? []
    }
    AsyncFunction("connect") { (options: [String: Any]) async throws in
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        self.worker.async {
          self.stopReader(emit: false)
          self.connectionID = options["connectionId"] as? String ?? UUID().uuidString
          self.state("connecting")
          do {
            let baud = options["baudRate"] as? Int ?? 1_000_000
            try self.client.connect(withBaudRate: baud, deviceID: options["deviceId"] as? String)
            self.connected = true
            self.state("connected")
            continuation.resume()
            self.scheduleRead()
          } catch {
            self.state("error", message: error.localizedDescription)
            continuation.resume(throwing: error)
          }
        }
      }
    }
    AsyncFunction("disconnect") { () async in
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        self.worker.async { self.stopReader(emit: true); continuation.resume() }
      }
    }
    OnAppEntersBackground {
      self.worker.async { self.stopReader(emit: true) }
    }
    OnDestroy {
      self.worker.async { self.stopReader(emit: false) }
    }
  }

  /** Schedule one bounded read at a time, leaving queue gaps for disconnect and lifecycle cleanup. */
  private func scheduleRead() {
    let expectedGeneration = generation
    worker.asyncAfter(deadline: .now() + .milliseconds(1)) { [weak self] in
      guard let self, self.connected, self.generation == expectedGeneration else { return }
      do {
        let batch = try self.client.readBatch()
        self.accept(batch)
        self.flushFrame()
        self.scheduleRead()
      } catch {
        self.stopReader(emit: false)
        self.state("error", message: error.localizedDescription)
      }
    }
  }

  /** Convert native decoded frames to the pressure-frame contract and retain the newest one. */
  private func accept(_ batch: Data) {
    for payload in client.decodeBatch(batch) {
      sequence += 1
      latestFrame = ["type": "pressure.frame", "version": 1, "source": "usb",
        "sequence": sequence, "timestamp": Int64(Date().timeIntervalSince1970 * 1000), "connectionId": connectionID,
        "rows": 32, "columns": 32, "values": payload.map { $0.intValue }]
    }
  }

  /** Emit the most recent complete frame at no more than 30 Hz to bound the native-to-JS queue. */
  private func flushFrame() {
    let now = Date().timeIntervalSince1970
    guard let frame = latestFrame, now - lastEmission >= 1.0 / 30.0 else { return }
    latestFrame = nil
    lastEmission = now
    sendEvent("onFrame", frame)
  }

  /** Close the driver and reset all per-connection parser and display state. */
  private func stopReader(emit: Bool) {
    generation += 1
    connected = false
    client.disconnect()
    latestFrame = nil
    sequence = 0
    lastEmission = 0
    if emit { state("disconnected") }
  }

  /** Send a lifecycle event consumed by the connection controls. */
  private func state(_ status: String, message: String? = nil) {
    var value: [String: Any] = ["status": status, "connectionId": connectionID]
    if let message { value["message"] = message }
    sendEvent("onState", value)
  }
}
