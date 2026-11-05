#!/usr/bin/env python3
"""
Relay SIMOTANDI → Agrolens.

Server Agrolens (Coolify, Singapura) diblokir Cloudflare SIMOTANDI Kementan (HTTP 403),
sedangkan IP Indonesia lolos. Skrip ini dijalankan di mesin ber-IP Indonesia (mini PC
Ubuntu, via cron): mengambil halaman periode + data per provinsi dari SIMOTANDI, lalu
mengirimnya ke POST /api/simotandi-sync. Parsing & penyimpanan tetap di server.

Butuh: python3 dan curl (bawaan Ubuntu). Tanpa paket tambahan.

Env:
  AGROLENS_URL   default https://agrolens.gamaagrosejati.co.id
  CRON_SECRET    sama dengan CRON_SECRET di env Coolify (wajib)

Contoh cron (05:20 WIB setiap hari, mesin ber-timezone Asia/Jakarta):
  20 5 * * * AGROLENS_URL=https://agrolens.gamaagrosejati.co.id CRON_SECRET=xxx /usr/bin/python3 /opt/agrolens/simotandi-relay.py >> /var/log/simotandi-relay.log 2>&1

Periode tertentu (mis. mengejar yang terlewat): python3 simotandi-relay.py 52
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime

BASE = 'https://simotandi.pertanian.go.id'
# shortcut: harus sama dengan SUPPORTED_PROVINCES di src/lib/simotandi.ts; server menolak bila ada yang kurang
PROVINCES = ['33', '34', '35']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'


def curl(url, json_mode=False, retries=2):
    """GET lewat curl (lolos Cloudflare dari IP Indonesia). Header meniru browser seperti di simotandi.ts."""
    headers = [
        '-H', f'User-Agent: {UA}',
        '-H', 'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        '-H', 'Cache-Control: no-cache',
        '-H', f'Referer: {BASE}/data-tabular',
    ]
    if json_mode:
        headers += ['-H', 'Accept: application/json, text/javascript, */*; q=0.01', '-H', 'X-Requested-With: XMLHttpRequest']
    else:
        headers += ['-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8']
    for attempt in range(retries + 1):
        r = subprocess.run(['curl', '-sS', '--max-time', '90', '-w', '\n%{http_code}', *headers, url],
                           capture_output=True, text=True)
        body, _, code = r.stdout.rpartition('\n')
        if r.returncode == 0 and code == '200':
            return body
        err = f'HTTP {code or "?"} {r.stderr.strip()[:120]} {body[:120]!r}'
        if attempt == retries:
            raise RuntimeError(f'{url}: {err}')
        time.sleep(2 * (attempt + 1))


def main():
    agrolens = os.environ.get('AGROLENS_URL', 'https://agrolens.gamaagrosejati.co.id').rstrip('/')
    secret = os.environ.get('CRON_SECRET')
    if not secret:
        sys.exit('CRON_SECRET belum di-set')

    html = curl(f'{BASE}/data-tabular')
    start = html.find('id="periode"')
    block = html[start:html.find('</select>', start)] if start >= 0 else ''
    # (id, kode YYYYNN). Periode terbaru = kode terbesar; ID tidak berurutan.
    opts = re.findall(r'<option[^>]*value="(\d+)"[^>]*>\s*(\d{6})', block)
    if not opts:
        sys.exit('Daftar periode tidak ditemukan di halaman SIMOTANDI')
    # Argumen opsional: ID periode tertentu, untuk mengejar periode yang terlewat
    periode = int(sys.argv[1]) if len(sys.argv) > 1 else int(max(opts, key=lambda o: o[1])[0])

    provinces = {}
    for kdpr in PROVINCES:
        provinces[kdpr] = curl(f'{BASE}/data-tabular/data?periode={periode}&provinsi={kdpr}', json_mode=True)
        json.loads(provinces[kdpr])  # pastikan JSON valid sebelum dikirim
        time.sleep(1)

    payload = json.dumps({'periode': periode, 'periodsHtml': html, 'provinces': provinces})
    r = subprocess.run(
        ['curl', '-sS', '--max-time', '120', '-w', '\n%{http_code}', '-X', 'POST',
         '-H', 'Content-Type: application/json', '-H', f'Authorization: Bearer {secret}',
         '--data-binary', '@-', f'{agrolens}/api/simotandi-sync'],
        input=payload, capture_output=True, text=True)
    body, _, code = r.stdout.rpartition('\n')
    stamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{stamp}] periode={periode} kirim={len(payload)//1024}KB → HTTP {code} {body[:300]}')
    if code != '200':
        sys.exit(1)


if __name__ == '__main__':
    main()
