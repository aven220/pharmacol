# Fase 4 — App Flutter

## Pantallas

| Ruta | Pantalla |
|------|----------|
| `/login` | Inicio de sesión |
| `/home` | Búsqueda de medicamentos |
| `/medicamentos/:id` | Detalle INVIMA |
| `/favoritos` | Favoritos del usuario |
| `/profile` | Perfil y cierre de sesión |

## Stack

- **Riverpod** — estado y DI
- **GoRouter** — navegación con guard de auth
- **Dio** — HTTP + refresh token automático
- **Hive** — caché offline de búsquedas
- **Secure Storage** — tokens JWT
- **Material Design 3** — tema teal farmacéutico

## Primera vez

```bash
cd apps/mobile
bash scripts/init_platforms.sh   # requiere Flutter SDK
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/v1
```

## Modo offline

- Búsquedas recientes cacheadas en Hive
- Indicador visual cloud_off en AppBar
- Detalle requiere conexión (Fase 4.1: cache de detalle)

## Próximo (Fase 5)

- OCR con Google ML Kit
- Escáner código de barras / QR
