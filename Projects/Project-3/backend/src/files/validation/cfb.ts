/**
 * Just enough of the OLE2 / Compound File Binary format ([MS-CFB]) to answer one
 * question: what streams does this container hold? `file-type` can say a buffer IS a
 * compound file, but Word (`.doc`), PowerPoint and Windows Installer (`.msi`) files
 * are compound files too — only one holding a `Workbook` (BIFF8) or `Book` (BIFF5)
 * stream is an Excel `.xls`.
 *
 * Every offset is bounds-checked and the chain walks are capped: this parses
 * attacker-supplied bytes, so a malformed file must end in `null`, never a hang or
 * an exception.
 */
const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const HEADER_SIZE = 512;
const FREE_SECTOR = 0xffffffff;
const END_OF_CHAIN = 0xfffffffe;
/** A generous ceiling on sectors walked, far above any real directory. */
const MAX_WALK = 100_000;
const DIRECTORY_ENTRY_SIZE = 128;

export function cfbEntryNames(bytes: Uint8Array): string[] | null {
  if (bytes.length < HEADER_SIZE) return null;
  if (!SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorShift = view.getUint16(30, true);
  // The format allows exactly 512-byte (v3) and 4096-byte (v4) sectors.
  if (sectorShift !== 9 && sectorShift !== 12) return null;
  const sectorSize = 1 << sectorShift;
  const entriesPerSector = sectorSize / 4;

  /** Sector `n` as a view, or `null` when it lies outside the file. */
  const sector = (n: number): DataView | null => {
    const offset = (n + 1) * sectorSize;
    return offset + sectorSize <= bytes.length
      ? new DataView(bytes.buffer, bytes.byteOffset + offset, sectorSize)
      : null;
  };

  // Which sectors hold the FAT: 109 slots in the header, then a chain of DIFAT sectors.
  const fatSectors: number[] = [];
  for (let slot = 0; slot < 109; slot += 1) {
    const value = view.getUint32(76 + slot * 4, true);
    if (value !== FREE_SECTOR) fatSectors.push(value);
  }
  let difat = view.getUint32(68, true);
  const difatCount = view.getUint32(72, true);
  for (let walked = 0; walked < difatCount && difat < END_OF_CHAIN && walked < MAX_WALK; walked += 1) {
    const current = sector(difat);
    if (!current) break;
    for (let slot = 0; slot < entriesPerSector - 1; slot += 1) {
      const value = current.getUint32(slot * 4, true);
      if (value !== FREE_SECTOR) fatSectors.push(value);
    }
    difat = current.getUint32((entriesPerSector - 1) * 4, true);
  }

  /** The sector that follows `n` in its chain. */
  const following = (n: number): number | null => {
    const fatSector = fatSectors[Math.floor(n / entriesPerSector)];
    if (fatSector === undefined) return null;
    return sector(fatSector)?.getUint32((n % entriesPerSector) * 4, true) ?? null;
  };

  const names: string[] = [];
  let current: number | null = view.getUint32(48, true);
  for (let walked = 0; current !== null && current < END_OF_CHAIN && walked < MAX_WALK; walked += 1) {
    const directory = sector(current);
    if (!directory) break;

    for (let offset = 0; offset + DIRECTORY_ENTRY_SIZE <= sectorSize; offset += DIRECTORY_ENTRY_SIZE) {
      const objectType = directory.getUint8(offset + 66);
      const nameBytes = directory.getUint16(offset + 64, true);
      // 0 = unused slot. The length includes the UTF-16 terminator; the field holds 32 characters.
      if (objectType === 0 || nameBytes < 2 || nameBytes > 64) continue;

      let name = '';
      for (let at = 0; at < nameBytes - 2; at += 2) {
        name += String.fromCharCode(directory.getUint16(offset + at, true));
      }
      names.push(name);
    }
    current = following(current);
  }

  return names;
}

/** True when the compound file holds an Excel workbook stream. */
export function isExcelWorkbook(bytes: Uint8Array): boolean {
  const names = cfbEntryNames(bytes);
  return names !== null && (names.includes('Workbook') || names.includes('Book'));
}
