[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/wojo_o)

# Inker v0.6.0

Self-hosted e-ink device management server built for the homelab community. Works with [TRMNL](https://usetrmnl.com/) devices — including the 7.5″ **OG** (800×480, 1-bit) and the 10.3″ **TRMNL X** (1872×1404, 16-level grayscale) — and any BYOD e-ink display. Design screens, create custom widgets with live data from your local network, and manage your displays from a modern web interface.

Inker is heading in its own direction — focusing on homelab integrations like server monitoring, smart home dashboards, network stats, and self-hosted service displays. TRMNL device compatibility is maintained, but the plugin ecosystem will be Inker-native.

![Dashboard](https://github.com/user-attachments/assets/fd9affac-5c57-4448-9338-ea8f83add08a)

Support project that uses inker:
- https://3dpm.ru/en/open_projects/ESPHome-TRMNL_7+5/

## Features

- **Screen Designer** — Drag & drop widget placement, snap guides, freehand drawing, auto-fit zoom for any resolution
- **Built-in Widgets** — Clock, date, calendar, text, weather, countdown, days until, QR code, image, GitHub stars, battery, WiFi, device info
- **Calendar Widget** — Monthly calendar with localized month/day names, weekend highlight, dividing lines, and adjustable font size
- **Custom Widgets** — Connect to any JSON API or RSS feed (including local network sources), JavaScript transformations, grid layouts with word-wrapped cells
- **Plugins** — Grafana panel integration with dashboard picker, live preview, and section grid compositing. More homelab-native plugins coming soon!
- **TRMNL OG & X** — Automatic model detection; full **TRMNL X** support (10.3″, 1872×1404, 16-level grayscale) alongside the 7.5″ OG (800×480, 1-bit)
- **Spectra 6 colour e-ink** — Pick the *Spectra 6 7.3″ (800x480, colour)* display format for a 6-colour panel (black, white, yellow, red, blue, green): plugins and designed screens are dithered server-side to a 6-colour PNG. Uploaded screens stay black & white
- **Playlists** — Rotate multiple screens on devices automatically, with optional **TRMNL X touch-bar** tap-to-advance (per playlist)
- **Device Management** — Auto-provisioning, firmware support, real-time status, logs
- **BYOD Support** — Register any e-ink device manually with custom screen resolution
- **Custom Ports** — Run on any port with Docker port mapping (e.g. `800:80`)

## Screenshots

| Devices | Screens | Screen Designer |
|:-:|:-:|:-:|
| ![Devices](https://github.com/user-attachments/assets/e6ba89e7-7bac-419e-bb2e-54a1c0350e07) | ![Screens](https://github.com/user-attachments/assets/510c7d5c-730a-457d-af7d-50ee04b2dc43) | ![Screen Designer](https://github.com/user-attachments/assets/0e4fb32a-bde5-475f-8800-49b06cfce2e9) |

| List of sources | Custom Data Sources | Custom Widgets |
|:-:|:-:|:-:|
| ![Extensions](https://github.com/user-attachments/assets/534b5104-8f1c-4a42-8c58-f2cef74dbc92) | ![Custom data sources](https://github.com/user-attachments/assets/03ed0dc8-7ae0-44fa-ace7-890b5ec8f385) | ![Custom widgets](https://github.com/user-attachments/assets/0eb10812-568a-46db-b58e-7e82c19ea403) |

<div align="center">

| Grafana Plugin |
|:-:|
| <img width="735" height="559" alt="image" src="https://github.com/user-attachments/assets/4312d7c6-7b99-45d6-bb27-5b0f902f60c9" /> |

</div>

| #1 Example Grafana | #2 Example Grafana |
|:-:|:-:|
|<img width="800" height="480" alt="image" src="https://github.com/user-attachments/assets/4073360a-470b-4fd2-ae4c-362e71b3467e" />|<img width="800" height="480" alt="image" src="https://github.com/user-attachments/assets/224994f6-27e4-41c0-9a0c-7b88598b6c22" />|

## Quick start & Technical information

### Docker Run

```bash
docker run -d \
  --name inker \
  --restart unless-stopped \
  -p 80:80 \
  -v inker_uploads:/app/uploads \
  wojooo/inker:latest
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  inker:
    image: wojooo/inker:latest
    container_name: inker
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - uploads_data:/app/uploads
    environment:
      TZ: UTC
      ADMIN_PIN: "1111"  # Quotes required — YAML strips leading zeros without them

volumes:
  uploads_data:
```

```bash
docker compose up -d
```

Open **http://your-server-ip** and log in with PIN `1111`.

> **Database:** Inker uses an embedded **SQLite** database stored at `/app/uploads/inker.db` on the `uploads` volume — there's no separate database server to run or manage. Back up the `uploads` volume to back up all your data.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PIN` | Login PIN | `1111` |
| `TZ` | Timezone for widgets | `UTC` |
| `INKER_PORT` | External port (for custom port mapping, e.g. `INKER_PORT=800`) | `80` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated, or `*` for all) | same-origin |

Pass with `-e`:
```bash
docker run -d \
  --name inker \
  --restart unless-stopped \
  -p 80:80 \
  -e ADMIN_PIN="1111" \
  -e TZ=Europe/Warsaw \
  -v inker_uploads:/app/uploads \
  wojooo/inker:latest
```

### Build from source

```bash
git clone https://github.com/usetrmnl/inker.git
cd inker
docker compose up -d --build
```

## Raspberry Pi / ARM64 (beta)

Inker's Docker image is **multi-architecture** — the same tag runs on both x86-64 servers and 64-bit ARM boards like the Raspberry Pi. Docker automatically pulls the correct build for your hardware, so the install command is identical:

```bash
docker run -d \
  --name inker \
  --restart unless-stopped \
  -p 80:80 \
  -v inker_uploads:/app/uploads \
  wojooo/inker:latest
```

**Requirements:**
- A **64-bit** OS (Raspberry Pi OS 64-bit or Debian arm64) — 32-bit installs are **not** supported.
- Raspberry Pi 4 or 5 recommended (screen rendering runs a headless Chromium).

> **Beta:** ARM64 support is new and hasn't been fully verified on every Pi setup yet. If something doesn't work, please [open an issue](https://github.com/usetrmnl/inker/issues) with your Pi model and OS version — feedback is welcome.

## Updating

```bash
docker compose pull
docker compose up -d
```

All data (screens, devices, playlists, settings) is preserved — database schema updates are applied automatically on startup.

> **Warning:** Never use `docker compose down -v` to update — the `-v` flag deletes all volumes and you will lose your data.

## Troubleshooting

If something isn't working after an update or on first run, reset the volumes and start fresh:

```bash
docker compose down -v
docker compose up -d
```

> **Note:** This removes all data (database, uploads). Only use on a fresh install or when you don't mind losing data.

## Testing

```bash
cd backend && bun test      # 432 tests
cd frontend && bun run test  # 19 tests
```

## License

Source Available — see [LICENSE](LICENSE) for details.
