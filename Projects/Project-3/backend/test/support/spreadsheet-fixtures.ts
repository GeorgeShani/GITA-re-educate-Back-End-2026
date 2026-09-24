import { crc32 } from 'node:zlib';

/**
 * Byte arrays for the file-type checks, BUILT in the test rather than committed as
 * binary files: a fixture you can read cannot quietly become the wrong file. These are
 * real container formats — a real ZIP with a spreadsheet `[Content_Types].xml`, a real
 * OLE2 compound file with a directory — not just magic numbers, because the
 * validator inspects more than the first bytes.
 */

export function csvBytes(rows: string[][] = [['id', 'name'], ['1', 'Ada'], ['2', 'Grace']]): Buffer {
  return Buffer.from(rows.map((row) => row.join(',')).join('\n') + '\n', 'utf8');
}

/** A tiny ZIP (stored, no compression). The CRCs are real, so any strict reader accepts it. */
export function zipBytes(entries: Array<[name: string, content: string]>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function officeZip(mainContentType: string, partName: string): Buffer {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    `<Override PartName="/${partName}" ContentType="${mainContentType}"/></Types>`;
  return zipBytes([
    ['[Content_Types].xml', contentTypes],
    [partName, '<root/>'],
  ]);
}

export function xlsxBytes(): Buffer {
  return officeZip(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    'xl/workbook.xml',
  );
}

/** A Word document: also a ZIP, and must NOT pass as a spreadsheet. */
export function docxBytes(): Buffer {
  return officeZip(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    'word/document.xml',
  );
}

const END_OF_CHAIN = 0xfffffffe;
const FAT_SECTOR = 0xfffffffd;
const FREE = 0xffffffff;

/**
 * A minimal OLE2 compound file (512-byte sectors) holding directory entries with
 * the given stream names. `['Workbook']` is an Excel `.xls`; `['WordDocument']` is a
 * Word `.doc`. More than three streams spill into a second directory sector, which is
 * what exercises the chain walk.
 */
export function compoundFileBytes(streamNames: string[]): Buffer {
  const names = ['Root Entry', ...streamNames];
  const directorySectors = Math.ceil(names.length / 4);
  const sectorCount = 1 + directorySectors; // sector 0 = FAT, then the directory

  const header = Buffer.alloc(512, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header);
  header.writeUInt16LE(0x3e, 24);
  header.writeUInt16LE(3, 26);
  header.writeUInt16LE(0xfffe, 28);
  header.writeUInt16LE(9, 30);
  header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44); // one FAT sector
  header.writeUInt32LE(1, 48); // directory starts at sector 1
  header.writeUInt32LE(4096, 56);
  header.writeUInt32LE(END_OF_CHAIN, 60);
  header.writeUInt32LE(END_OF_CHAIN, 68);
  for (let slot = 0; slot < 109; slot += 1) header.writeUInt32LE(slot === 0 ? 0 : FREE, 76 + slot * 4);

  const fat = Buffer.alloc(512);
  for (let entry = 0; entry < 128; entry += 1) fat.writeUInt32LE(FREE, entry * 4);
  fat.writeUInt32LE(FAT_SECTOR, 0);
  for (let sector = 1; sector < sectorCount; sector += 1) {
    fat.writeUInt32LE(sector === sectorCount - 1 ? END_OF_CHAIN : sector + 1, sector * 4);
  }

  const directory = Buffer.alloc(512 * directorySectors, 0);
  names.forEach((name, index) => {
    const at = index * 128;
    directory.write(name, at, 'utf16le');
    directory.writeUInt16LE((name.length + 1) * 2, at + 64);
    directory.writeUInt8(index === 0 ? 5 : 2, at + 66);
    directory.writeUInt8(1, at + 67);
    directory.writeUInt32LE(FREE, at + 68);
    directory.writeUInt32LE(FREE, at + 72);
    directory.writeUInt32LE(FREE, at + 76);
  });

  return Buffer.concat([header, fat, directory]);
}

export function xlsBytes(): Buffer {
  return compoundFileBytes(['Workbook']);
}

/** A Word 97 `.doc`: an OLE2 compound file with no workbook stream. */
export function docBytes(): Buffer {
  return compoundFileBytes(['WordDocument']);
}

/** A Windows executable's opening bytes ("MZ" header) followed by padding. */
export function exeBytes(): Buffer {
  return Buffer.concat([Buffer.from('MZ'), Buffer.alloc(254, 0x90), Buffer.from('This program cannot be run in DOS mode.')]);
}

/** A PNG signature and a little more. */
export function pngBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('0000000d49484452', 'hex'),
    Buffer.alloc(64, 0),
  ]);
}
