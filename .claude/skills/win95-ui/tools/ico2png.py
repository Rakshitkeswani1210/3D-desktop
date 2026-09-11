#!/usr/bin/env python3
"""
ico2png.py — decode Windows .ico files to RGBA PNG, exactly.

macOS `sips` mishandles the 1-bit AND mask in classic 4bpp/8bpp icons and
returns a near-transparent image, so this does it by hand. Pure stdlib: no
Pillow, no ImageMagick.

    python3 ico2png.py <in.ico> <outdir> [--size 32]

Writes <outdir>/<stem>.png (largest frame, or the requested --size).
"""
import binascii, os, struct, sys, zlib


def _png(width, height, rgba):
    """Encode raw RGBA bytes as a PNG."""
    raw = b"".join(
        b"\x00" + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height)
    )

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", binascii.crc32(tag + data) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def decode(blob, want=None):
    """Return (width, height, rgba_bytes) for one frame of an .ico."""
    reserved, kind, count = struct.unpack_from("<HHH", blob, 0)
    if reserved != 0 or count == 0:
        raise ValueError("not an .ico")

    frames = []
    for i in range(count):
        w, h, _ncol, _res, _planes, bpp, nbytes, off = struct.unpack_from(
            "<BBBBHHII", blob, 6 + i * 16)
        frames.append((w or 256, h or 256, bpp, nbytes, off))

    if want:
        pick = min(frames, key=lambda f: (abs(f[0] - want), -f[0]))
    else:
        pick = max(frames, key=lambda f: (f[0], f[2]))
    w, h, _bpp, nbytes, off = pick
    data = blob[off:off + nbytes]

    # Vista-era icons embed a whole PNG. Pass it straight through.
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return None, None, data

    (hsize, bw, bh, _planes, bpp) = struct.unpack_from("<IiiHH", data, 0)
    w, h = bw, bh // 2  # biHeight covers XOR + AND masks stacked

    pos = hsize
    palette = []
    if bpp <= 8:
        for _ in range(1 << bpp):
            b, g, r, _a = data[pos:pos + 4]
            palette.append((r, g, b))
            pos += 4

    xor_stride = ((w * bpp + 31) // 32) * 4
    and_stride = ((w + 31) // 32) * 4
    xor = data[pos:pos + xor_stride * h]
    andm = data[pos + xor_stride * h:pos + xor_stride * h + and_stride * h]

    out = bytearray(w * h * 4)
    for y in range(h):
        src = (h - 1 - y) * xor_stride          # rows are stored bottom-up
        amask = (h - 1 - y) * and_stride
        for x in range(w):
            if bpp == 4:
                byte = xor[src + (x >> 1)]
                idx = (byte >> 4) if x % 2 == 0 else (byte & 0x0F)
                r, g, b = palette[idx]
            elif bpp == 8:
                r, g, b = palette[xor[src + x]]
            elif bpp == 1:
                idx = (xor[src + (x >> 3)] >> (7 - (x & 7))) & 1
                r, g, b = palette[idx]
            elif bpp == 24:
                b, g, r = xor[src + x * 3:src + x * 3 + 3]
            elif bpp == 32:
                b, g, r, _ = xor[src + x * 4:src + x * 4 + 4]
            else:
                raise ValueError("unsupported bpp %d" % bpp)

            # AND mask: a set bit means "transparent here".
            transparent = (andm[amask + (x >> 3)] >> (7 - (x & 7))) & 1 if andm else 0
            if bpp == 32 and not andm:
                a = xor[src + x * 4 + 3]
            else:
                a = 0 if transparent else 255

            o = (y * w + x) * 4
            out[o:o + 4] = bytes((r, g, b, a))

    return w, h, bytes(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want = None
    for a in sys.argv[1:]:
        if a.startswith("--size"):
            want = int(a.split("=", 1)[1]) if "=" in a else None
    if "--size" in sys.argv:
        want = int(sys.argv[sys.argv.index("--size") + 1])
    if len(args) < 2:
        sys.exit(__doc__)

    src, outdir = args[0], args[1]
    os.makedirs(outdir, exist_ok=True)
    with open(src, "rb") as fh:
        w, h, payload = decode(fh.read(), want)
    dst = os.path.join(outdir, os.path.splitext(os.path.basename(src))[0] + ".png")
    with open(dst, "wb") as fh:
        fh.write(payload if w is None else _png(w, h, payload))
    print(dst)


if __name__ == "__main__":
    main()
