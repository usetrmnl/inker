[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/wojo_o)

# Inker v0.1.0

Self-hosted e-ink device management system for [TRMNL](https://usetrmnl.com/) devices and devices compatible with TRMNL 1.6.9 software. Design screens, create custom widgets, and manage your displays from a modern web interface.

![Dashboard](https://github.com/user-attachments/assets/fd9affac-5c57-4448-9338-ea8f83add08a)

## Features

- **Screen Designer** — Drag & drop widget placement, snap guides, freehand drawing, export/import
- **Built-in Widgets** — Clock, date, text, weather, countdown, days until, QR code, image, GitHub stars, battery, WiFi, device info
- **Custom Widgets** — Connect to any JSON API or RSS feed, field extraction, JavaScript transformations, grid layouts
- **Playlists** — Rotate multiple screens on devices automatically
- **Device Management** — Auto-provisioning, real-time status, configurable refresh rates, logs

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

## Troubleshooting

If something isn't working after an update or on first run, reset the volumes and start fresh:

```bash
docker compose down -v
docker compose up -d
```

> **Note:** This removes all data (database, uploads). Only use on a fresh install or when you don't mind losing data.

## Testing

```bash
cd backend && bun test      # 357 tests
cd frontend && bun run test  # 19 tests
```

## License

Source Available — see [LICENSE](LICENSE) for details.
