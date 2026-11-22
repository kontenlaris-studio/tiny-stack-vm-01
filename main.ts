// tiny-stack-vm: an exact interpreter for make.fun's tiny stack ISA v1 —
// wrapping arithmetic, signed/unsigned ops kept apart, every trap's own
// exit code, all limits in the ISA's order, decode cached per pc.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Immediate length per opcode (-1: not an opcode), pops, pushes. Stack
// needs are checked from these before an instruction's own effect or trap.
const IMM = new Int8Array(256).fill(-1), POPS = new Int8Array(256), PUSHES = new Int8Array(256);
// [opcode, imm, pops, pushes] outside the arithmetic block
const DEFS = [[0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],
[48,2,0,0],[49,2,1,0],[50,2,1,0],[51,2,0,0],[52,0,0,0],[64,0,1,1],[65,0,2,0],
[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0]];
for (const [op, imm, pops, pushes] of DEFS) { IMM[op] = imm; POPS[op] = pops; PUSHES[op] = pushes; }
for (let op = 0x10; op <= 0x22; op++) { IMM[op] = 0; POPS[op] = 2; PUSHES[op] = 1; }
POPS[0x17] = PUSHES[0x17] = 1; POPS[0x1b] = PUSHES[0x1b] = 1; IMM[0x1f] = -1; // NEG, NOT; 0x1f is no opcode

function run(prog, input) {
  const n = prog.length;
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const out = new Uint8Array(65_536);
  // Decode cache per pc: opcode, immediate, next pc. -2: bad opcode
  // (trap 5); -3: cut-off immediate (trap 9).
  const dOp = new Int16Array(n).fill(-1), dImm = new Int32Array(n), dNext = new Int32Array(n);
  let sp = 0, csp = 0, olen = 0, inPos = 0, pc = 0, steps = 0;
  const done = (code) => ({ out: out.subarray(0, olen), code });
  for (;;) {
    if (steps >= 1_000_000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    let op = dOp[pc];
    if (op === -1) {
      op = prog[pc];
      const imm = IMM[op];
      if (imm < 0) { dOp[pc] = -2; return done(5); }
      if (pc + imm >= n) { dOp[pc] = -3; return done(9); }
      let v = 0;
      if (imm === 1) v = (prog[pc + 1] << 24) >> 24;
      else if (imm === 4) v = prog[pc + 1] | (prog[pc + 2] << 8) | (prog[pc + 3] << 16) | (prog[pc + 4] << 24);
      else if (imm === 2) { v = prog[pc + 1] | (prog[pc + 2] << 8); if (op !== 0x33) v = (v << 16) >> 16; }
      dOp[pc] = op; dImm[pc] = v; dNext[pc] = pc + 1 + imm;
    } else if (op < 0) return done(op === -2 ? 5 : 9);
    steps++;
    if (sp < POPS[op]) return done(2);
    if (sp - POPS[op] + PUSHES[op] > 256) return done(3);
    const imm = dImm[pc], next = dNext[pc];
    pc = next;
    switch (op) {
      case 0x00: return done(0);
      case 0x01: case 0x02: D[sp++] = imm; break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b); // the low 32 bits of the exact product
        else if (op === 0x13) { if (b === 0) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (b === 0) return done(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 0x15) { if (b === 0) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (b === 0) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        D[sp - 2] = r; sp--;
        break;
      }
      case 0x30: pc = next + imm; break;
      case 0x31: case 0x32: if ((D[--sp] === 0) === (op === 0x31)) pc = next + imm; break;
      case 0x33: if (csp >= 64) return done(7); C[csp++] = next; pc = imm; break;
      case 0x34: if (csp === 0) return done(8); pc = C[--csp]; break;
      case 0x40: case 0x41: {
        const addr = D[sp - 1];
        if (addr < 0 || addr > 255) return done(6);
        if (op === 0x40) D[sp - 1] = M[addr];
        else { M[addr] = D[sp - 2]; sp -= 2; }
        break;
      }
      case 0x50: { // PRINT: decimal ASCII, no padding, no newline
        let v = D[--sp], neg = v < 0;
        if (neg) v = -v; // exact: -(-2^31) is 2^31 as a double
        let digits = 1;
        for (let t = v; t >= 10; t = Math.floor(t / 10)) digits++;
        const len = digits + (neg ? 1 : 0);
        if (olen + len > 65_536) return done(11);
        let at = olen + len;
        for (let i = 0; i < digits; i++) { out[--at] = 48 + (v % 10); v = Math.floor(v / 10); }
        if (neg) out[at - 1] = 45;
        olen += len;
        break;
      }
      case 0x51: if (olen + 1 > 65_536) return done(11); out[olen++] = D[--sp] & 255; break;
      case 0x52: D[sp++] = inPos < input.length ? input[inPos++] : -1; break;
      case 0x53: return done(D[--sp] & 255);
    }
  }
}

for (const ent of readdirSync(IN_DIR, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const prog = readFileSync(join(IN_DIR, ent.name, 'program.bin'));
  let input;
  try { input = readFileSync(join(IN_DIR, ent.name, 'input.bin')); } catch { input = Buffer.alloc(0); }
  const r = run(prog, input);
  mkdirSync(join(OUT_DIR, ent.name), { recursive: true });
  writeFileSync(join(OUT_DIR, ent.name, 'stdout.bin'), r.out);
  writeFileSync(join(OUT_DIR, ent.name, 'exit.txt'), r.code + '\n');
}
