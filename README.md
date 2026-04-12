[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/wojo_o)

# Inker v0.3.2

Self-hosted e-ink device management server built for the homelab community. Works with [TRMNL](https://usetrmnl.com/) devices (supports firmware 1.7.8) and any BYOD e-ink display. Design screens, create custom widgets with live data from your local network, and manage your displays from a modern web interface.

Inker is heading in its own direction — focusing on homelab integrations like server monitoring, smart home dashboards, network stats, and self-hosted service displays. TRMNL device compatibility is maintained, but the plugin ecosystem will be Inker-native.

![Dashboard](https://github.com/user-attachments/assets/fd9affac-5c57-4448-9338-ea8f83add08a)

## Features

- **Screen Designer** — Drag & drop widget placement, snap guides, freehand drawing, auto-fit zoom for any resolution
- **Built-in Widgets** — Clock, date, text, weather, countdown, days until, QR code, image, GitHub stars, battery, WiFi, device info
- **Custom Widgets** — Connect to any JSON API or RSS feed (including local network sources), JavaScript transformations, grid layouts
- **Plugins** — Coming soon — homelab-native integrations for server monitoring, smart home, network stats
- **Playlists** — Rotate multiple screens on devices automatically
- **Device Management** — Auto-provisioning, firmware 1.7.8 support, real-time status, logs
- **BYOD Support** — Register any e-ink device manually with custom screen resolution
- **Custom Ports** — Run on any port with Docker port mapping (e.g. `800:80`)

## Screenshots

| Screen Designer | Devices | Screens |
|:-:|:-:|:-:|
|  ![Devices](https://github.com/user-attachments/assets/e6ba89e7-7bac-419e-bb2e-54a1c0350e07) | ![Screens](https://github.com/user-attachments/assets/510c7d5c-730a-457d-af7d-50ee04b2dc43) | ![Screen Designer](https://github.com/user-attachments/assets/0e4fb32a-bde5-475f-8800-49b06cfce2e9) |

| List of sources | Custom Data Sources | Custom Widgets |
|:-:|:-:|:-:|
| ![Extensions](https://github.com/user-attachments/assets/534b5104-8f1c-4a42-8c58-f2cef74dbc92) | ![Custom data sources](https://github.com/user-attachments/assets/03ed0dc8-7ae0-44fa-ace7-890b5ec8f385) | ![Custom widgets](https://github.com/user-attachments/assets/0eb10812-568a-46db-b58e-7e82c19ea403) |

## Quick start

### Docker Run

```bash
docker run -d \
  --name inker \
  --restart unless-stopped \
  -p 80:80 \
  -v inker_postgres:/var/lib/postgresql/17/main \
  -v inker_redis:/data \
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
      - postgres_data:/var/lib/postgresql/17/main
      - redis_data:/data
      - uploads_data:/app/uploads
    environment:
      TZ: UTC
      ADMIN_PIN: "1111"  # Quotes required — YAML strips leading zeros without them

volumes:
  postgres_data:
  redis_data:
  uploads_data:
```

```bash
docker compose up -d
```

Open **http://your-server-ip** and log in with PIN `1111`.

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
  -v inker_postgres:/var/lib/postgresql/17/main \
  -v inker_redis:/data \
  -v inker_uploads:/app/uploads \
  wojooo/inker:latest
```

### Build from source

```bash
git clone https://github.com/wojo-o/inker.git
cd inker
docker compose up -d --build
```

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
cd backend && bun test      # 395 tests
cd frontend && bun run test  # 19 tests
```

## License

Source Available — see [LICENSE](LICENSE) for details.
