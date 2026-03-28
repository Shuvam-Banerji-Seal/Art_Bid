# No-IP Public Access Setup (2-Day Use)

This guide exposes your app to the internet using No-IP dynamic DNS.
It keeps PostgreSQL local and untouched.

## 1. Create No-IP Hostname
1. Create/login at https://www.noip.com/.
2. Go to Dynamic DNS > Create Hostname.
3. Create a host such as `myartapp.ddns.net`.
4. Set Host Type to `DNS Host (A)`.
5. Save.

## 2. Keep No-IP DNS Updated from Your PC
Use one of the methods below.

### Option A: No-IP DUC (native)
1. Install No-IP DUC from your distro package manager or No-IP docs.
2. Sign in with your No-IP credentials in DUC.
3. Select the hostname you created.
4. Keep DUC running in background.

### Option B: Docker updater (easy)
Run a container that updates your current public IP to No-IP:

```bash
docker run -d --name noip-duc --restart unless-stopped \
  -e NOIP_USERNAME="YOUR_NOIP_EMAIL" \
  -e NOIP_PASSWORD="YOUR_NOIP_PASSWORD" \
  -e NOIP_HOSTNAMES="myartapp.ddns.net" \
  ghcr.io/noipcom/noip-duc:latest
```

## 3. Router Port Forwarding (most important)
Forward router WAN traffic to this machine LAN IP (`10.20.74.136` in your case).

Recommended temporary mapping:
- External port `80` -> Internal `10.20.74.136:5173` (TCP)

Optional for backend direct access (usually not needed):
- External port `3001` -> Internal `10.20.74.136:3001` (TCP)

Notes:
- If your ISP blocks inbound ports or uses CGNAT, internet access may fail.
- If blocked, call ISP and ask for public IPv4 or use a VPS reverse proxy.

## 4. Start App in No-IP Mode
From project root:

```bash
chmod +x ops/start_noip_public.sh
./ops/start_noip_public.sh myartapp.ddns.net 80
```

This script:
- Starts backend + frontend safely.
- Adds your No-IP domain into backend CORS allow-list.
- Prints public URL.
- Does not touch PostgreSQL processes.

## 5. Test from External Network
Do not test from same Wi-Fi first.
Use mobile data and open:

- `http://myartapp.ddns.net`

If it fails:
1. Verify No-IP host resolves to your current public IP.
2. Verify DUC is running and updated recently.
3. Verify router forward is enabled and points to correct LAN IP.
4. Verify local firewall allows inbound TCP 5173.

## 6. HTTPS for Public Domain (optional but recommended)
For trusted HTTPS (no browser warning), do this:
1. Put Nginx/Caddy on ports 80/443.
2. Proxy to local frontend (`127.0.0.1:5173`).
3. Issue Let's Encrypt certificate for your No-IP domain.

Example target URL after TLS setup:
- `https://myartapp.ddns.net`

## 7. 2-Day Hygiene
1. Keep No-IP updater running continuously.
2. Keep machine awake and network stable.
3. Stop exposure after demo by disabling router forwarding.
