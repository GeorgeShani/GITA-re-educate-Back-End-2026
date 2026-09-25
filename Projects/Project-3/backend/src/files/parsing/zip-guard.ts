/**
 * A ZIP can be a few kilobytes that expands to gigabytes ("zip bomb"), and an `.xlsx`
 * IS a ZIP. The 25 MB upload limit is on the compressed bytes, so before anything
 * inflates one, read the central directory — which states every entry's uncompressed
 * size without inflating anything — and refuse if the total is unreasonable.
 *
 * Reads attacker-controlled bytes, so every offset is bounds-checked and a malformed
 * archive yields `null` rather than an exception.
 */
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const ZIP64_MARKER = 0xffffffff;
/** The end record is at most 22 bytes plus a comment of up to 65535. */
const MAX_TAIL = 22 + 0xffff;

export interface ZipSummary {
  entries: number;
  uncompressedBytes: number;
}

export function summariseZip(bytes: Uint8Array): ZipSummary | null {
  if (bytes.length < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - MAX_TAIL); at -= 1) {
    if (view.getUint32(at, true) === END_OF_CENTRAL_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end === -1) return null;

  const entries = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  // Sizes that do not fit 32 bits are stored in a ZIP64 record. Nothing legitimate that
  // Gridline accepts needs that (25 MB cap), so treat it as beyond any budget.
  if (entries === 0xffff || directoryOffset === ZIP64_MARKER) return { entries, uncompressedBytes: Number.POSITIVE_INFINITY };

  let offset = directoryOffset;
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) return null;

    const size = view.getUint32(offset + 24, true);
    if (size === ZIP64_MARKER) return { entries, uncompressedBytes: Number.POSITIVE_INFINITY };
    total += size;

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, uncompressedBytes: total };
}
