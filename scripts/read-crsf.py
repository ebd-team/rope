#!/usr/bin/env python3
"""
Read CRSF RC channel frames from a USB serial adapter.

Typical usage with a TX12 JR bay + FT232:
    python read-crsf.py
    python read-crsf.py --port COM11
    python read-crsf.py --port /dev/ttyUSB0 --baud 420000 --raw
"""

from __future__ import annotations

import argparse
from collections import Counter
import sys
import time

import serial
import serial.tools.list_ports


CRSF_SYNC_BYTES = {0xC8, 0xEE, 0xEA}
CRSF_RC_CHANNELS_PACKED = 0x16
DEFAULT_BAUD_RATES = (420000, 416666, 115200, 400000, 250000)
MIN_FRAME_LEN = 2
MAX_FRAME_LEN = 64
CHANNEL_COUNT = 16


def crc8_dvb_s2(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0xD5) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


def list_ports() -> list[str]:
    return [port.device for port in serial.tools.list_ports.comports()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read CRSF RC channel frames from a serial adapter."
    )
    parser.add_argument("--port", help="Serial port, for example COM11 or /dev/ttyUSB0.")
    parser.add_argument(
        "--baud",
        type=int,
        help="Serial baud rate. If omitted, the script tries common CRSF rates.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=0.2,
        help="Serial read timeout in seconds. Default: 0.2",
    )
    parser.add_argument(
        "--scan-seconds",
        type=float,
        default=3.0,
        help="How long to probe each baud while auto-detecting. Default: 3.0",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Also print raw 11-bit channel values instead of CRSF-mapped microseconds only.",
    )
    parser.add_argument(
        "--dump-bytes",
        type=int,
        metavar="COUNT",
        help="Dump COUNT raw bytes and exit.",
    )
    parser.add_argument(
        "--analyze-bytes",
        type=int,
        metavar="COUNT",
        help="Capture COUNT raw bytes, inspect CRSF sync/CRC patterns, and exit.",
    )
    return parser.parse_args()


def decode_rc_channels(payload: bytes) -> list[int]:
    if len(payload) != 22:
        raise ValueError(f"RC payload must be 22 bytes, got {len(payload)}")

    bits = int.from_bytes(payload, byteorder="little")
    return [(bits >> (index * 11)) & 0x7FF for index in range(CHANNEL_COUNT)]


def crsf_to_microseconds(value: int) -> int:
    # Standard CRSF mapping: 172 -> 988us, 1811 -> 2012us.
    return int(round((value - 172) * (1024.0 / 1639.0) + 988))


def read_frame(ser: serial.Serial) -> tuple[int, int, bytes, int] | None:
    while True:
        sync = ser.read(1)
        if not sync:
            return None
        if sync[0] in CRSF_SYNC_BYTES:
            break

    length_bytes = ser.read(1)
    if not length_bytes:
        return None

    frame_len = length_bytes[0]
    if frame_len < MIN_FRAME_LEN or frame_len > MAX_FRAME_LEN:
        return None

    frame_data = ser.read(frame_len)
    if len(frame_data) != frame_len:
        return None

    frame_type = frame_data[0]
    payload = frame_data[1:-1]
    received_crc = frame_data[-1]
    expected_crc = crc8_dvb_s2(frame_data[:-1])

    if expected_crc != received_crc:
        return None

    return sync[0], frame_type, payload, received_crc


def has_rc_frames(port: str, baud: int, timeout: float, scan_seconds: float) -> bool:
    deadline = time.time() + scan_seconds
    try:
        with serial.Serial(port=port, baudrate=baud, timeout=timeout) as ser:
            time.sleep(0.2)
            while time.time() < deadline:
                frame = read_frame(ser)
                if frame is None:
                    continue
                _, frame_type, payload, _ = frame
                if frame_type == CRSF_RC_CHANNELS_PACKED and len(payload) == 22:
                    return True
    except serial.SerialException:
        return False
    return False


def choose_port(requested_port: str | None) -> str:
    if requested_port:
        return requested_port

    ports = list_ports()
    if not ports:
        print("No serial ports found.", file=sys.stderr)
        sys.exit(1)

    if len(ports) == 1:
        return ports[0]

    print(f"Available ports: {', '.join(ports)}")
    return ports[0]


def choose_baud(port: str, requested_baud: int | None, timeout: float, scan_seconds: float) -> int:
    if requested_baud:
        return requested_baud

    for baud in DEFAULT_BAUD_RATES:
        print(f"Probing {port} at {baud} baud...")
        if has_rc_frames(port, baud, timeout, scan_seconds):
            print(f"Using {baud} baud")
            return baud

    print(
        "No valid RC channel frames detected during auto-probe. "
        "Falling back to 420000 baud.",
        file=sys.stderr,
    )
    return DEFAULT_BAUD_RATES[0]


def format_channels(values: list[int], show_raw: bool) -> str:
    columns = []
    for index, raw in enumerate(values, start=1):
        us = crsf_to_microseconds(raw)
        if show_raw:
            columns.append(f"CH{index:02d}:{us:4d}us({raw:4d})")
        else:
            columns.append(f"CH{index:02d}:{us:4d}")
    return "  ".join(columns)


def find_valid_frames_in_buffer(data: bytes) -> tuple[int, Counter[int]]:
    valid_frames = 0
    frame_types: Counter[int] = Counter()

    for index in range(len(data) - 4):
        if data[index] not in CRSF_SYNC_BYTES:
            continue

        frame_len = data[index + 1]
        if frame_len < MIN_FRAME_LEN or frame_len > MAX_FRAME_LEN:
            continue

        end = index + 2 + frame_len
        if end > len(data):
            continue

        frame_data = data[index + 2 : end]
        expected_crc = crc8_dvb_s2(frame_data[:-1])
        if expected_crc != frame_data[-1]:
            continue

        valid_frames += 1
        frame_types[frame_data[0]] += 1

    return valid_frames, frame_types


def dump_bytes(ser: serial.Serial, count: int) -> None:
    print(f"Reading {count} raw bytes...")
    data = ser.read(count)
    print(f"Received {len(data)} bytes")
    for index, value in enumerate(data, start=1):
        ascii_char = chr(value) if 32 <= value < 127 else "."
        print(f"{index:4d}  0x{value:02X}  {ascii_char}")


def analyze_bytes(ser: serial.Serial, count: int) -> None:
    print(f"Capturing {count} bytes for analysis...")
    data = ser.read(count)
    if not data:
        print("No bytes received")
        return

    inverted = bytes((~byte) & 0xFF for byte in data)
    sync_counts = {sync: data.count(sync) for sync in sorted(CRSF_SYNC_BYTES)}
    inv_sync_counts = {sync: inverted.count(sync) for sync in sorted(CRSF_SYNC_BYTES)}
    valid_frames, frame_types = find_valid_frames_in_buffer(data)
    inv_valid_frames, inv_frame_types = find_valid_frames_in_buffer(inverted)

    print(f"Received {len(data)} bytes")
    print("Sync byte hits in raw stream:")
    for sync, hits in sync_counts.items():
        print(f"  0x{sync:02X}: {hits}")

    print("Sync byte hits after bitwise inversion:")
    for sync, hits in inv_sync_counts.items():
        print(f"  0x{sync:02X}: {hits}")

    print(f"Valid CRSF frames in raw stream: {valid_frames}")
    if frame_types:
        print(
            "Frame types in raw stream: "
            + ", ".join(f"0x{frame_type:02X} x{hits}" for frame_type, hits in frame_types.items())
        )

    print(f"Valid CRSF frames after inversion: {inv_valid_frames}")
    if inv_frame_types:
        print(
            "Frame types after inversion: "
            + ", ".join(f"0x{frame_type:02X} x{hits}" for frame_type, hits in inv_frame_types.items())
        )

    common = Counter(data).most_common(16)
    print("Most common raw bytes:")
    print("  " + " ".join(f"0x{byte:02X}({hits})" for byte, hits in common))

    if inv_valid_frames > valid_frames:
        print("Result: inverted UART is likely.")
    elif valid_frames > 0:
        print("Result: stream contains valid CRSF frames.")
    else:
        print("Result: no valid CRSF frames found in this sample.")


def main() -> int:
    args = parse_args()

    port = choose_port(args.port)
    baud = choose_baud(port, args.baud, args.timeout, args.scan_seconds)

    print(f"Opening {port} at {baud} baud")
    if args.dump_bytes:
        print("Raw byte dump mode")
    elif args.analyze_bytes:
        print("Byte analysis mode")
    else:
        print("Waiting for CRSF RC channel frames. Press Ctrl+C to stop.")

    try:
        with serial.Serial(port=port, baudrate=baud, timeout=args.timeout) as ser:
            time.sleep(0.2)

            if args.dump_bytes:
                dump_bytes(ser, args.dump_bytes)
                return 0

            if args.analyze_bytes:
                analyze_bytes(ser, args.analyze_bytes)
                return 0

            last_print = 0.0

            while True:
                frame = read_frame(ser)
                if frame is None:
                    continue

                _, frame_type, payload, _ = frame
                if frame_type != CRSF_RC_CHANNELS_PACKED:
                    continue

                try:
                    channels = decode_rc_channels(payload)
                except ValueError:
                    continue

                now = time.time()
                if now - last_print < 0.05:
                    continue

                line = format_channels(channels, args.raw)
                print(f"\r{line}", end="", flush=True)
                last_print = now
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    except serial.SerialException as exc:
        print(f"Serial error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
