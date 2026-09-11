#!/usr/bin/env python3
"""
pngshrink.py — recover the original pixel grid from an upscaled pixel-art PNG.

Wikimedia stores the Windows 95 message-box icons as ~500px nearest-neighbour
blow-ups of 32x32 originals. Scaling those back down with a normal resampler
blurs the art; this samples the CENTRE of each source block instead, which
reproduces the original pixels exactly.

    python3 pngshrink.py <in.png> <out.png> [size]     # default 32

Pure stdlib. Handles 8-bit greyscale/RGB/RGBA PNGs with filter types 0-4.
"""
import struct, sys, zlib
from ico2png import _png

_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def read_png(path):
    with open(path, "rb") as fh:
        blob = fh.read()
    assert blob[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"

    pos, idat, pal, trns = 8, b"", None, None
    width = height = depth = color = 0
    while pos < len(blob):
        ln = struct.unpack_from(">I", blob, pos)[0]
        tag = blob[pos + 4:pos + 8]
        data = blob[pos + 8:pos + 8 + ln]
        if tag == b"IHDR":
            width, height, depth, color = struct.unpack_from(">IIBB", data, 0)
        elif tag == b"PLTE":
            pal = data
        elif tag == b"tRNS":
            trns = data
        elif tag == b"IDAT":
            idat += data
        elif tag == b"IEND":
            break
        pos += 12 + ln

    assert depth == 8, "only 8-bit PNGs supported (got %d)" % depth
    nch = _CHANNELS[color]
    raw = zlib.decompress(idat)

    stride = width * nch
    out = bytearray(height * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(height):
        ftype = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        for i in range(stride):
            a = line[i - nch] if i >= nch else 0
            b = prev[i]
            c = prev[i - nch] if i >= nch else 0
            x = line[i]
            if ftype == 1:   line[i] = (x + a) & 255
            elif ftype == 2: line[i] = (x + b) & 255
            elif ftype == 3: line[i] = (x + (a + b) // 2) & 255
            elif ftype == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (x + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line

    # Normalise everything to RGBA.
    rgba = bytearray(width * height * 4)
    for i in range(width * height):
        px = out[i * nch:(i + 1) * nch]
        if color == 0:   r = g = b = px[0]; a = 255
        elif color == 4: r = g = b = px[0]; a = px[1]
        elif color == 2: r, g, b = px; a = 255
        elif color == 6: r, g, b, a = px
        elif color == 3:
            idx = px[0]
            r, g, b = pal[idx * 3:idx * 3 + 3]
            a = trns[idx] if trns and idx < len(trns) else 255
        rgba[i * 4:i * 4 + 4] = bytes((r, g, b, a))
    return width, height, bytes(rgba)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 32

    w, h, rgba = read_png(src)
    out = bytearray(n * n * 4)
    for y in range(n):
        sy = min(h - 1, int((y + 0.5) * h / n))
        for x in range(n):
            sx = min(w - 1, int((x + 0.5) * w / n))
            o, i = (y * n + x) * 4, (sy * w + sx) * 4
            out[o:o + 4] = rgba[i:i + 4]
    with open(dst, "wb") as fh:
        fh.write(_png(n, n, bytes(out)))
    print(f"{src} {w}x{h} -> {dst} {n}x{n}")


if __name__ == "__main__":
    main()
