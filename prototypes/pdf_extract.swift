import Foundation
import PDFKit
guard CommandLine.arguments.count > 1,
      let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write("could not open PDF\n".data(using: .utf8)!)
    exit(1)
}
for i in 0..<doc.pageCount {
    if let s = doc.page(at: i)?.string { print(s) }
}
