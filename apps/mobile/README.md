# PharmaCol Mobile

## Requisitos

- Flutter 3.27+ (stable)
- Backend en `http://localhost:3000/v1`

## Setup

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

## Desarrollo

```bash
# iOS Simulator — localhost
flutter run --dart-define=API_BASE_URL=http://localhost:3000/v1

# Android Emulator — host machine
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/v1

# Dispositivo físico — IP de tu Mac
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000/v1
```

## Arquitectura

```
lib/
├── main.dart
├── app.dart
├── core/           # config, network, storage, theme
├── router/         # GoRouter
├── features/       # auth, medicamentos, favoritos, profile
└── shared/         # widgets reutilizables
```

## Modo offline

- Hive cachea resultados de búsqueda recientes
- Favoritos disponibles sin conexión
- Cola de reintentos cuando vuelve la red
