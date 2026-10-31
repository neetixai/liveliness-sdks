import Foundation

/// What the capture UI is framing: a face (front camera, oval guide) or an
/// ID document (back camera, card-shaped guide).
public enum NeetixCaptureMode: String, Sendable {
    case selfie
    case document
}

#if os(iOS)
import AVFoundation
import SwiftUI
import UIKit

// MARK: - Public SwiftUI view

/// Full-screen guided capture: AVFoundation preview, oval/card guide overlay,
/// live quality hints (brightness + motion stability sampled from the video
/// stream), auto-capture after 1.5 s of stable good-quality frames (with a
/// countdown ring), a manual shutter fallback, and a retake/confirm review
/// step. Output is normalized JPEG (longest side <= 1280 px, quality 0.8) —
/// ready for `NeetixClient` uploads.
///
///     NeetixCaptureView(mode: .selfie) { jpeg in
///         Task { let res = try await client.liveness(person: .jpeg(jpeg)) }
///     } onCancel: { dismiss() }
///
/// Requires `NSCameraUsageDescription` in the host app's Info.plist.
@available(iOS 15.0, *)
public struct NeetixCaptureView: View {
    private let mode: NeetixCaptureMode
    private let onCapture: (Data) -> Void
    private let onCancel: (() -> Void)?
    @StateObject private var controller: CaptureController

    /// - Parameters:
    ///   - mode: `.selfie` (front camera, oval guide) or `.document`
    ///     (back camera, ID-1 card guide).
    ///   - autoCapture: when true (default) a photo is taken automatically
    ///     after 1.5 s of stable, well-lit frames; the shutter button always
    ///     works either way.
    ///   - onCapture: called once with the confirmed JPEG (user tapped
    ///     "Use Photo").
    ///   - onCancel: called when the user taps Cancel; pass nil to hide the
    ///     Cancel button.
    public init(
        mode: NeetixCaptureMode = .selfie,
        autoCapture: Bool = true,
        onCapture: @escaping (Data) -> Void,
        onCancel: (() -> Void)? = nil
    ) {
        self.mode = mode
        self.onCapture = onCapture
        self.onCancel = onCancel
        _controller = StateObject(
            wrappedValue: CaptureController(mode: mode, autoCapture: autoCapture))
    }

    public var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let jpeg = controller.capturedJPEG, let image = UIImage(data: jpeg) {
                reviewView(image: image, jpeg: jpeg)
            } else {
                captureView
            }
        }
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
    }

    // MARK: Live capture

    private var captureView: some View {
        ZStack {
            CameraPreview(session: controller.session)
                .ignoresSafeArea()
            GuideOverlay(mode: mode, progress: controller.stableProgress)
                .ignoresSafeArea()
            VStack {
                Text(hintText(controller.hint))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color.black.opacity(0.6)))
                    .padding(.top, 20)
                    .padding(.horizontal, 24)
                Spacer()
                if controller.hint == .steady, let seconds = controller.countdownSeconds,
                    seconds > 0 {
                    Text("\(seconds)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .shadow(radius: 4)
                        .padding(.bottom, 8)
                }
                HStack {
                    if let onCancel {
                        Button("Cancel") {
                            controller.stop()
                            onCancel()
                        }
                        .font(.body.weight(.medium))
                        .foregroundColor(.white)
                        .frame(width: 72)
                    } else {
                        Color.clear.frame(width: 72, height: 1)
                    }
                    Spacer()
                    shutterButton
                    Spacer()
                    Color.clear.frame(width: 72, height: 1)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 28)
            }
        }
    }

    private var shutterButton: some View {
        Button(action: { controller.manualCapture() }) {
            ZStack {
                Circle().strokeBorder(Color.white, lineWidth: 4)
                    .frame(width: 72, height: 72)
                Circle().fill(Color.white)
                    .frame(width: 58, height: 58)
            }
        }
        .accessibilityLabel("Take photo")
        .disabled(!controller.canShoot)
        .opacity(controller.canShoot ? 1 : 0.4)
    }

    private func hintText(_ hint: CaptureController.Hint) -> String {
        switch hint {
        case .initializing: return "Starting camera…"
        case .permissionDenied: return "Camera access denied — enable it in Settings"
        case .cameraUnavailable: return "Camera unavailable on this device"
        case .tooDark: return "Too dark — find more light"
        case .tooBright: return "Too bright — avoid direct light"
        case .holdStill:
            return mode == .selfie
                ? "Center your face in the oval and hold still"
                : "Align the document inside the frame and hold still"
        case .steady: return "Hold still…"
        case .capturing: return "Capturing…"
        }
    }

    // MARK: Review

    private func reviewView(image: UIImage, jpeg: Data) -> some View {
        VStack(spacing: 24) {
            Spacer()
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .cornerRadius(14)
                .padding(.horizontal, 20)
            Spacer()
            HStack(spacing: 16) {
                Button(action: { controller.retake() }) {
                    Text("Retake")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.white.opacity(0.15))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                Button(action: {
                    controller.stop()
                    onCapture(jpeg)
                }) {
                    Text("Use Photo")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.white)
                        .foregroundColor(.black)
                        .cornerRadius(12)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }
}

// MARK: - Guide overlay

@available(iOS 15.0, *)
private struct GuideShape: Shape {
    let mode: NeetixCaptureMode
    func path(in rect: CGRect) -> Path {
        switch mode {
        case .selfie: return Path(ellipseIn: rect)
        case .document: return Path(roundedRect: rect, cornerRadius: 16)
        }
    }
}

@available(iOS 15.0, *)
private struct GuideOverlay: View {
    let mode: NeetixCaptureMode
    /// 0…1 progress toward the 1.5 s auto-capture; drawn as a ring.
    let progress: Double

    var body: some View {
        GeometryReader { geo in
            let rect = guideRect(in: geo.size)
            ZStack {
                Path { p in
                    p.addRect(CGRect(origin: .zero, size: geo.size))
                    p.addPath(GuideShape(mode: mode).path(in: rect))
                }
                .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))
                GuideShape(mode: mode)
                    .stroke(Color.white.opacity(0.85), lineWidth: 2)
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)
                if progress > 0 {
                    GuideShape(mode: mode)
                        .trim(from: 0, to: progress)
                        .stroke(
                            Color.green,
                            style: StrokeStyle(lineWidth: 5, lineCap: .round)
                        )
                        .frame(width: rect.width, height: rect.height)
                        .position(x: rect.midX, y: rect.midY)
                        .animation(.linear(duration: 0.1), value: progress)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func guideRect(in size: CGSize) -> CGRect {
        switch mode {
        case .selfie:
            let w = min(size.width * 0.72, size.height * 0.5)
            let h = w * 1.33
            return CGRect(x: (size.width - w) / 2, y: size.height * 0.42 - h / 2,
                          width: w, height: h)
        case .document:
            let w = size.width * 0.92
            let h = w / 1.586 // ID-1 card aspect
            return CGRect(x: (size.width - w) / 2, y: size.height * 0.45 - h / 2,
                          width: w, height: h)
        }
    }
}

// MARK: - Preview layer bridge

@available(iOS 15.0, *)
private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}

// MARK: - Capture controller

/// Owns the AVCaptureSession, samples video frames for brightness/stability,
/// runs the 1.5 s-stable auto-capture state machine, and normalizes output
/// JPEGs. Internal — drive it through `NeetixCaptureView`.
@available(iOS 15.0, *)
final class CaptureController: NSObject, ObservableObject {
    enum Hint: Equatable {
        case initializing
        case permissionDenied
        case cameraUnavailable
        case tooDark
        case tooBright
        case holdStill
        case steady
        case capturing
    }

    // Tunables.
    static let requiredStableSeconds: CFTimeInterval = 1.5
    private static let gridSide = 16
    private static let minBrightness = 0.18 // mean luma, 0…1
    private static let maxBrightness = 0.85
    private static let maxMotion = 0.045 // mean |Δluma| between frames, 0…1
    static let maxOutputDimension: CGFloat = 1280
    static let jpegQuality: CGFloat = 0.8

    let session = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let sessionQueue = DispatchQueue(label: "in.neetix.capture.session")
    private let videoQueue = DispatchQueue(label: "in.neetix.capture.frames")
    private let mode: NeetixCaptureMode
    private let autoCapture: Bool

    // UI state — main thread only.
    @Published private(set) var hint: Hint = .initializing
    @Published private(set) var stableProgress: Double = 0
    @Published private(set) var countdownSeconds: Int?
    @Published private(set) var capturedJPEG: Data?

    var canShoot: Bool {
        hint != .initializing && hint != .permissionDenied && hint != .cameraUnavailable
    }

    // Frame-analysis state — videoQueue only.
    private var previousGrid: [Double]?
    private var stableSince: CFTimeInterval?
    private var captureInFlight = false
    private var frozen = false // true while the review screen is up
    private var configured = false

    init(mode: NeetixCaptureMode, autoCapture: Bool) {
        self.mode = mode
        self.autoCapture = autoCapture
        super.init()
    }

    // MARK: Lifecycle

    func start() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureAndRun()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self else { return }
                if granted {
                    self.configureAndRun()
                } else {
                    self.publish(hint: .permissionDenied, progress: 0, countdown: nil)
                }
            }
        default:
            publish(hint: .permissionDenied, progress: 0, countdown: nil)
        }
    }

    func stop() {
        sessionQueue.async { [self] in
            if session.isRunning { session.stopRunning() }
        }
    }

    func retake() {
        DispatchQueue.main.async {
            self.capturedJPEG = nil
            self.stableProgress = 0
            self.countdownSeconds = nil
        }
        videoQueue.async { [self] in
            frozen = false
            captureInFlight = false
            stableSince = nil
            previousGrid = nil
        }
        sessionQueue.async { [self] in
            if !session.isRunning { session.startRunning() }
        }
    }

    func manualCapture() {
        videoQueue.async { [self] in
            guard !captureInFlight, !frozen else { return }
            captureInFlight = true
            stableSince = nil
            publish(hint: .capturing, progress: 0, countdown: nil)
            takePhoto()
        }
    }

    private func configureAndRun() {
        sessionQueue.async { [self] in
            if !configured {
                configured = true
                session.beginConfiguration()
                session.sessionPreset = .photo
                let position: AVCaptureDevice.Position = mode == .selfie ? .front : .back
                guard
                    let device = AVCaptureDevice.default(
                        .builtInWideAngleCamera, for: .video, position: position),
                    let input = try? AVCaptureDeviceInput(device: device),
                    session.canAddInput(input)
                else {
                    session.commitConfiguration()
                    publish(hint: .cameraUnavailable, progress: 0, countdown: nil)
                    return
                }
                session.addInput(input)
                videoOutput.videoSettings = [
                    kCVPixelBufferPixelFormatTypeKey as String:
                        kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
                ]
                videoOutput.alwaysDiscardsLateVideoFrames = true
                videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
                if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }
                if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
                session.commitConfiguration()
            }
            if !session.isRunning { session.startRunning() }
            publish(hint: .holdStill, progress: 0, countdown: nil)
        }
    }

    // MARK: Quality evaluation (videoQueue)

    private func evaluate(brightness: Double, motion: Double) {
        if brightness < Self.minBrightness { resetStability(.tooDark); return }
        if brightness > Self.maxBrightness { resetStability(.tooBright); return }
        guard autoCapture else {
            publish(hint: .holdStill, progress: 0, countdown: nil)
            return
        }
        if motion > Self.maxMotion { resetStability(.holdStill); return }

        let now = CACurrentMediaTime()
        if stableSince == nil { stableSince = now }
        let elapsed = now - stableSince!
        let progress = min(1, elapsed / Self.requiredStableSeconds)
        let remaining = max(0, Self.requiredStableSeconds - elapsed)
        if elapsed >= Self.requiredStableSeconds {
            captureInFlight = true
            stableSince = nil
            publish(hint: .capturing, progress: 1, countdown: nil)
            takePhoto()
        } else {
            publish(hint: .steady, progress: progress, countdown: Int(remaining.rounded(.up)))
        }
    }

    private func resetStability(_ hint: Hint) {
        stableSince = nil
        publish(hint: hint, progress: 0, countdown: nil)
    }

    private func publish(hint: Hint, progress: Double, countdown: Int?) {
        // Quantize so 30 fps sampling doesn't spam SwiftUI invalidations.
        let quantized = (progress * 20).rounded() / 20
        DispatchQueue.main.async {
            if self.hint != hint { self.hint = hint }
            if self.stableProgress != quantized { self.stableProgress = quantized }
            if self.countdownSeconds != countdown { self.countdownSeconds = countdown }
        }
    }

    private func takePhoto() {
        let settings = AVCapturePhotoSettings(format: [
            AVVideoCodecKey: AVVideoCodecType.jpeg
        ])
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    // MARK: Frame math

    /// Downsample the luma (Y) plane to a 16×16 grid of mean values (0…255).
    private static func lumaGrid(from sampleBuffer: CMSampleBuffer) -> [Double]? {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer),
            CVPixelBufferIsPlanar(pixelBuffer)
        else { return nil }
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return nil }
        let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        let rowBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
        guard width >= gridSide * 4, height >= gridSide * 4 else { return nil }
        let ptr = base.assumingMemoryBound(to: UInt8.self)

        let cellW = width / gridSide
        let cellH = height / gridSide
        let strideX = max(1, cellW / 4)
        let strideY = max(1, cellH / 4)
        var grid = [Double](repeating: 0, count: gridSide * gridSide)
        for gy in 0..<gridSide {
            for gx in 0..<gridSide {
                var sum = 0
                var count = 0
                var y = gy * cellH
                let yEnd = y + cellH
                let xStart = gx * cellW
                let xEnd = xStart + cellW
                while y < yEnd {
                    var x = xStart
                    while x < xEnd {
                        sum += Int(ptr[y * rowBytes + x])
                        count += 1
                        x += strideX
                    }
                    y += strideY
                }
                grid[gy * gridSide + gx] = Double(sum) / Double(max(1, count))
            }
        }
        return grid
    }

    /// Decode, downscale to `maxOutputDimension` on the longest side (also
    /// baking in EXIF orientation), and re-encode as JPEG at `jpegQuality`.
    static func normalizedJPEG(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let size = image.size
        let longest = max(size.width, size.height)
        let scale = longest > maxOutputDimension ? maxOutputDimension / longest : 1
        let target = CGSize(
            width: (size.width * scale).rounded(),
            height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return rendered.jpegData(compressionQuality: jpegQuality)
    }
}

@available(iOS 15.0, *)
extension CaptureController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard !frozen, !captureInFlight else { return }
        guard let grid = Self.lumaGrid(from: sampleBuffer) else { return }
        let brightness = grid.reduce(0, +) / Double(grid.count) / 255.0
        let motion: Double
        if let previous = previousGrid {
            var acc = 0.0
            for i in 0..<grid.count { acc += abs(grid[i] - previous[i]) }
            motion = acc / Double(grid.count) / 255.0
        } else {
            motion = 1.0 // first frame: not yet stable
        }
        previousGrid = grid
        evaluate(brightness: brightness, motion: motion)
    }
}

@available(iOS 15.0, *)
extension CaptureController: AVCapturePhotoCaptureDelegate {
    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        guard error == nil,
            let data = photo.fileDataRepresentation(),
            let jpeg = Self.normalizedJPEG(from: data)
        else {
            // Capture failed: resume live analysis.
            videoQueue.async { [self] in
                captureInFlight = false
                stableSince = nil
                previousGrid = nil
            }
            publish(hint: .holdStill, progress: 0, countdown: nil)
            return
        }
        videoQueue.async { [self] in
            frozen = true
            captureInFlight = false
        }
        DispatchQueue.main.async {
            self.capturedJPEG = jpeg
            self.stableProgress = 0
            self.countdownSeconds = nil
        }
    }
}

#else

#if canImport(SwiftUI)
import SwiftUI

/// Non-iOS stub so cross-platform SwiftUI code referencing the capture view
/// still compiles. Camera capture is iOS-only.
@available(macOS 12.0, tvOS 15.0, watchOS 8.0, *)
public struct NeetixCaptureView: View {
    public init(
        mode: NeetixCaptureMode = .selfie,
        autoCapture: Bool = true,
        onCapture: @escaping (Data) -> Void,
        onCancel: (() -> Void)? = nil
    ) {}

    public var body: some View {
        Text("NeetixCaptureView is available on iOS only.")
    }
}
#endif

#endif
