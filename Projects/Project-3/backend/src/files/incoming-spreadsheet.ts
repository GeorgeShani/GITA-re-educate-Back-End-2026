/**
 * What `FilesService` needs to know about an upload, and nothing more. A multipart file satisfies it by way of
 * `fromMulterFile`; the MCP tools build one from text or base64. Either way the bytes are sniffed, never the name.
 */
export interface IncomingSpreadsheet {
  buffer: Buffer;
  /** The name as the person meant it: already decoded, not yet sanitised (the service does that). */
  name: string;
  size: number;
}

/**
 * Multer (busboy) reads the `filename` parameter as Latin-1, but browsers and curl
 * send it as UTF-8 bytes, so `ანგარიში.csv` arrives as `áááá…`. Re-reading those
 * bytes as UTF-8 undoes it. A name that is not valid UTF-8 when re-read (it really was
 * Latin-1) is left exactly as received.
 */
export function decodeMultipartName(raw: string): string {
  const repaired = Buffer.from(raw, 'latin1').toString('utf8');
  return repaired.includes('�') ? raw : repaired;
}

export function fromMulterFile(file: Express.Multer.File): IncomingSpreadsheet {
  return { buffer: file.buffer, name: decodeMultipartName(file.originalname), size: file.size };
}
