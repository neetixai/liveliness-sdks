// iOS camera capture. Gated behind UIKit so the networking core still builds
// and tests on macOS/Linux via `swift build`.
#if canImport(UIKit) && canImport(AVFoundation)
import AVFoundation
import UIKit

/// A minimal front-camera capture session that yields JPEG `Data` for upload.
/// Prefer `NeetixCaptureView` (SwiftUI, guided capture) for new integrations;
/// this stays for UIKit apps that want a bare preview layer.
///
/// Usage:
///   let cam = try NeetixCamera()
///   view.layer.addSublayer(cam.previewLayer)
///   let jpeg = try await cam.capture()
///   let result = try await client.liveness(person: .jpeg(jpeg))
public final class NeetixCamera: NSObject {
    private let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    public let previewLayer: AVCaptureVideoPreviewLayer
    private var continuation: CheckedContinuation<Data, Error>?

    public init(position: AVCaptureDevice.Position = .front) throws {
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        super.init()
        session.beginConfiguration()
        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input), session.canAddOutput(output)
        else {
            throw NeetixError.transport(NSError(domain: "NeetixCamera", code: 1))
        }
        session.addInput(input)
        session.addOutput(output)
        previewLayer.videoGravity = .resizeAspectFill
        session.commitConfiguration()
        session.startRunning()
    }

    /// Capture a single JPEG frame.
    public func capture() async throws -> Data {
        try await withCheckedThrowingContinuation { cont in
            self.continuation = cont
            let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            output.capturePhoto(with: settings, delegate: self)
        }
    }

    public func stop() { session.stopRunning() }
}

extension NeetixCamera: AVCapturePhotoCaptureDelegate {
    public func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error {
            continuation?.resume(throwing: NeetixError.transport(error))
        } else if let data = photo.fileDataRepresentation() {
            continuation?.resume(returning: data)
        } else {
            continuation?.resume(throwing: NeetixError.decoding("no photo data"))
        }
        continuation = nil
    }
}
#endif
