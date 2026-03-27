#!/usr/bin/env python3
"""Generate a local development TLS certificate for Art_Bid.

Creates a self-signed certificate with SAN entries for localhost and detected
LAN IPv4 addresses. Intended for HTTPS in local/dev environments.
"""

from __future__ import annotations

import argparse
import ipaddress
import socket
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def get_lan_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()

    # Linux-friendly source of interface IPs.
    try:
        output = subprocess.check_output(
            ["ip", "-4", "-o", "addr", "show", "scope", "global"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in output.splitlines():
            parts = line.split()
            if len(parts) >= 4:
                cidr = parts[3]
                ip = cidr.split("/", 1)[0]
                addresses.add(ip)
    except Exception:
        pass

    # Fallback host resolution.
    try:
        _, _, resolved = socket.gethostbyname_ex(socket.gethostname())
        for ip in resolved:
            if "." in ip and not ip.startswith("127."):
                addresses.add(ip)
    except Exception:
        pass

    return sorted(addresses)


def build_certificate(hostnames: list[str], ip_addresses: list[str], cert_path: Path, key_path: Path) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Art_Bid Development"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ]
    )

    san_entries: list[x509.GeneralName] = []
    for name in hostnames:
        san_entries.append(x509.DNSName(name))
    for ip in ip_addresses:
        san_entries.append(x509.IPAddress(ipaddress.ip_address(ip)))

    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(private_key=key, algorithm=hashes.SHA256())
    )

    key_path.parent.mkdir(parents=True, exist_ok=True)
    cert_path.parent.mkdir(parents=True, exist_ok=True)

    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate local HTTPS cert/key for Art_Bid")
    parser.add_argument("--cert", required=True, help="Path to output certificate PEM file")
    parser.add_argument("--key", required=True, help="Path to output private key PEM file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    cert_path = Path(args.cert).expanduser().resolve()
    key_path = Path(args.key).expanduser().resolve()

    hostnames = ["localhost", socket.gethostname()]
    hostnames = sorted({h for h in hostnames if h})

    ip_addresses = ["127.0.0.1", "::1", *get_lan_ipv4_addresses()]
    ip_addresses = sorted({ip for ip in ip_addresses if ip})

    build_certificate(hostnames, ip_addresses, cert_path, key_path)

    print("Generated HTTPS certificate successfully.")
    print(f"Certificate: {cert_path}")
    print(f"Private key: {key_path}")
    print(f"Hostnames SAN: {', '.join(hostnames)}")
    print(f"IP SAN: {', '.join(ip_addresses)}")


if __name__ == "__main__":
    main()
