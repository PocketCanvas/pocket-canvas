export type NativeCrashFrame = {
  library: string;
  pc: string;
  relPc: string;
  symbol: string;
  symbolOffset: number;
  buildId: string;
};

export type TombstoneSignal = {
  number: number;
  name: string;
  code: number;
  codeName: string;
  faultAddress: string;
};

export type TombstoneTrace = {
  frames: NativeCrashFrame[];
  signal: TombstoneSignal | null;
};

function hexAddress(value: bigint) {
  return `0x${value.toString(16)}`;
}

const SKIP_SYMBOL = /^(Java_expo|art::|kotlin|__start_thread|__pthread_start)/;

export function libraryBasename(path: string): string {
  const bang = path.lastIndexOf('!');
  const sliced = bang >= 0 ? path.slice(bang + 1) : path;
  const slash = Math.max(sliced.lastIndexOf('/'), sliced.lastIndexOf('\\'));
  return (slash >= 0 ? sliced.slice(slash + 1) : sliced).replace(
    /\/data\/data\/[^/\s]+\/files\/\S+/g,
    '<app-file>',
  );
}

export function crashFrameTopSymbol(frames: NativeCrashFrame[]): string | null {
  for (const frame of frames) {
    const symbol = frame.symbol.replace(/\+\d+$/, '');
    if (!symbol || symbol === 'unknown') continue;
    if (SKIP_SYMBOL.test(symbol)) continue;
    return symbol;
  }
  return null;
}

class ProtoReader {
  pos = 0;
  data: Uint8Array;
  constructor(data: Uint8Array) {
    this.data = data;
  }

  remaining() {
    return this.pos < this.data.length;
  }

  readVarint() {
    let result = 0n;
    let shift = 0n;
    while (this.pos < this.data.length) {
      const byte = BigInt(this.data[this.pos++] & 0xff);
      result |= (byte & 0x7fn) << shift;
      if ((byte & 0x80n) === 0n) return result;
      shift += 7n;
      if (shift > 63n) break;
    }
    return result;
  }

  readBytes() {
    const length = Number(this.readVarint());
    const start = this.pos;
    this.pos = Math.min(this.data.length, start + length);
    return this.data.subarray(start, this.pos);
  }

  readString() {
    return new TextDecoder().decode(this.readBytes());
  }

  skip(wire: number) {
    if (wire === 0) this.readVarint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.readBytes();
    else if (wire === 5) this.pos += 4;
  }
}

type ThreadTrace = { id: number; frames: NativeCrashFrame[] };

function parseFrame(bytes: Uint8Array): NativeCrashFrame {
  const reader = new ProtoReader(bytes);
  let relPc = 0n;
  let pc = 0n;
  let symbol = '';
  let fileName = '';
  let functionOffset = 0n;
  let buildId = '';
  while (reader.remaining()) {
    const tag = Number(reader.readVarint());
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) relPc = reader.readVarint();
    else if (field === 2 && wire === 0) pc = reader.readVarint();
    else if (field === 4 && wire === 2) symbol = reader.readString();
    else if (field === 5 && wire === 0) functionOffset = reader.readVarint();
    else if (field === 6 && wire === 2) fileName = reader.readString();
    else if (field === 8 && wire === 2) buildId = reader.readString();
    else reader.skip(wire);
  }
  return {
    library: libraryBasename(fileName),
    pc: hexAddress(pc !== 0n ? pc : relPc),
    relPc: hexAddress(relPc),
    symbol,
    symbolOffset: Number(functionOffset),
    buildId,
  };
}

function parseSignal(bytes: Uint8Array): TombstoneSignal {
  const reader = new ProtoReader(bytes);
  let number = 0;
  let name = '';
  let code = 0;
  let codeName = '';
  let faultAddress = 0n;
  while (reader.remaining()) {
    const tag = Number(reader.readVarint());
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) number = Number(reader.readVarint());
    else if (field === 2 && wire === 2) name = reader.readString();
    else if (field === 3 && wire === 0) code = Number(reader.readVarint());
    else if (field === 4 && wire === 2) codeName = reader.readString();
    else if (field === 9 && wire === 0) faultAddress = reader.readVarint();
    else reader.skip(wire);
  }
  return { number, name, code, codeName, faultAddress: hexAddress(faultAddress) };
}

function parseThread(bytes: Uint8Array): ThreadTrace {
  const reader = new ProtoReader(bytes);
  let id = 0;
  const frames: NativeCrashFrame[] = [];
  while (reader.remaining()) {
    const tag = Number(reader.readVarint());
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) id = Number(reader.readVarint());
    else if (field === 4 && wire === 2) frames.push(parseFrame(reader.readBytes()));
    else reader.skip(wire);
  }
  return { id, frames };
}

function parseMapEntry(bytes: Uint8Array): ThreadTrace | null {
  const reader = new ProtoReader(bytes);
  let key = 0;
  let thread: ThreadTrace | null = null;
  while (reader.remaining()) {
    const tag = Number(reader.readVarint());
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) key = Number(reader.readVarint());
    else if (field === 2 && wire === 2) thread = parseThread(reader.readBytes());
    else reader.skip(wire);
  }
  if (thread && thread.id === 0) thread.id = key;
  return thread;
}

function looksLikeTextTombstone(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.subarray(0, 64));
  return /^\s*(\*\*\*|tombstone|Build fingerprint|#\d+)/i.test(head);
}

function parseTextSignal(text: string): TombstoneSignal | null {
  const match = text.match(
    /signal\s+(\d+)\s+\(([^)]+)\)(?:,\s+code\s+(\d+)\s+\(([^)]+)\))?(?:,\s+fault addr\s+(0x[0-9a-fA-F]+|0+))?/i,
  );
  if (!match) return null;
  return {
    number: Number(match[1]),
    name: match[2],
    code: match[3] ? Number(match[3]) : 0,
    codeName: match[4] ?? '',
    faultAddress: match[5] ?? '0x0',
  };
}

function parseTextTombstone(bytes: Uint8Array): TombstoneTrace {
  const text = new TextDecoder().decode(bytes);
  const frames: NativeCrashFrame[] = [];
  const linePattern = /^#\d+\s+pc\s+([0-9a-fA-Fx]+)\s+(\S+)(?:\s+\((.+)\))?/;
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(linePattern);
    if (!match) continue;
    const detail = match[3] ?? '';
    const offsetMatch = detail.match(/\+(\d+)\s*$/);
    const buildIdMatch = detail.match(/BuildId:\s*([0-9a-fA-F]+)/i);
    const symbol = detail
      .replace(/\+\d+\s*$/, '')
      .replace(/\s*\(BuildId:.*$/i, '')
      .trim();
    const relPc = match[1].startsWith('0x') ? match[1] : `0x${match[1]}`;
    frames.push({
      library: libraryBasename(match[2]),
      pc: relPc,
      relPc,
      symbol,
      symbolOffset: offsetMatch ? Number(offsetMatch[1]) : 0,
      buildId: buildIdMatch?.[1] ?? '',
    });
    if (frames.length >= 16) break;
  }
  return { frames, signal: parseTextSignal(text) };
}

export function parseTombstoneTrace(bytes: Uint8Array): TombstoneTrace {
  if (bytes.length === 0) return { frames: [], signal: null };
  if (looksLikeTextTombstone(bytes)) return parseTextTombstone(bytes);

  const reader = new ProtoReader(bytes);
  let tid = 0;
  let signal: TombstoneSignal | null = null;
  const threads: ThreadTrace[] = [];
  while (reader.remaining()) {
    const tag = Number(reader.readVarint());
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 6 && wire === 0) tid = Number(reader.readVarint());
    else if (field === 10 && wire === 2) signal = parseSignal(reader.readBytes());
    else if (field === 16 && wire === 2) {
      const thread = parseMapEntry(reader.readBytes());
      if (thread) threads.push(thread);
    } else reader.skip(wire);
  }

  const crashing =
    threads.find((thread) => thread.id === tid) ??
    threads.find((thread) => thread.frames.length > 0);
  return { frames: (crashing?.frames ?? []).slice(0, 16), signal };
}
