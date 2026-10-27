// Renders the icons macOS itself shows (Finder/Dock) into src/assets/icons/*.png.
// Run on a Mac from the repo root: swift scripts/export-apple-icons.swift
// The icons are Apple's artwork; re-run after a macOS update to pick up restyles.
import AppKit
import UniformTypeIdentifiers

let size = 256
let out = URL(fileURLWithPath: "src/assets/icons", isDirectory: true)
let coreTypes = "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/"

enum Source {
  case type(UTType)
  case icns(String)
}

let icons: [(String, Source)] = [
  ("finder", .icns("/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns")),
  ("preview", .icns("/System/Applications/Preview.app/Contents/Resources/AppIcon.icns")),
  ("system-information", .icns("/System/Applications/Utilities/System Information.app/Contents/Resources/ASP.icns")),
  ("trash", .icns(coreTypes + "TrashIcon.icns")),
  ("folder", .icns(coreTypes + "GenericFolderIcon.icns")),
  ("folder-desktop", .icns(coreTypes + "DesktopFolderIcon.icns")),
  ("folder-documents", .icns(coreTypes + "DocumentsFolderIcon.icns")),
  ("folder-pictures", .icns(coreTypes + "PicturesFolderIcon.icns")),
  ("doc-md", .icns(coreTypes + "GenericDocumentIcon.icns")),
  ("doc-pdf", .type(.pdf)),
  ("doc-vcf", .type(.vCard)),
  ("doc-webloc", .icns(coreTypes + "InternetLocation.icns")),
]

func image(for source: Source) -> NSImage? {
  switch source {
  case .type(let type): return NSWorkspace.shared.icon(for: type)
  case .icns(let path): return NSImage(contentsOfFile: path)
  }
}

func png(_ image: NSImage) -> Data? {
  guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)
  else { return nil }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])
}

try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
var failed = false
for (name, source) in icons {
  guard let img = image(for: source), let data = png(img) else {
    print("FAILED \(name)")
    failed = true
    continue
  }
  try data.write(to: out.appendingPathComponent("\(name).png"))
  print("ok \(name)")
}
exit(failed ? 1 : 0)
