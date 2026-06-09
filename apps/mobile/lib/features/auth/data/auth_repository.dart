import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/models.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage_service.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    storage: ref.watch(secureStorageProvider),
  );
});

class AuthRepository {
  AuthRepository({required Dio dio, required SecureStorageService storage})
      : _dio = dio,
        _storage = storage;

  final Dio _dio;
  final SecureStorageService _storage;

  Future<AuthTokens> login(String email, String password) async {
    return unwrapApi(
      _dio.post('/auth/login', data: {'email': email, 'password': password}),
      (json) => AuthTokens.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<UserProfile> getProfile() async {
    return unwrapApi(
      _dio.get('/auth/me'),
      (json) => UserProfile.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> saveTokens(AuthTokens tokens) {
    return _storage.saveTokens(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
  }

  Future<void> logout() async {
    final refresh = await _storage.getRefreshToken();
    if (refresh != null) {
      try {
        await _dio.post('/auth/logout', data: {'refreshToken': refresh});
      } catch (_) {}
    }
    await _storage.clearTokens();
  }

  Future<bool> hasSession() async {
    final token = await _storage.getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
