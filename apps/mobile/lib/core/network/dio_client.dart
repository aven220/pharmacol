import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/api_config.dart';
import 'secure_storage_service.dart';

final secureStorageProvider = Provider<SecureStorageService>(
  (ref) => SecureStorageService(),
);

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: ApiConfig.connectTimeout,
      receiveTimeout: ApiConfig.receiveTimeout,
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _tryRefreshToken(dio, storage);
          if (refreshed) {
            final token = await storage.getAccessToken();
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await dio.fetch(error.requestOptions);
            handler.resolve(response);
            return;
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});

Future<bool> _tryRefreshToken(Dio dio, SecureStorageService storage) async {
  final refreshToken = await storage.getRefreshToken();
  if (refreshToken == null) return false;

  try {
    final response = await Dio(BaseOptions(baseUrl: ApiConfig.baseUrl)).post(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = response.data['data'] as Map<String, dynamic>;
    await storage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    return true;
  } catch (_) {
    await storage.clearTokens();
    return false;
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;

  static ApiException fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] != null) {
      return ApiException(data['error'].toString(), statusCode: e.response?.statusCode);
    }
    return ApiException(
      e.message ?? 'Error de conexión',
      statusCode: e.response?.statusCode,
    );
  }
}

Future<T> unwrapApi<T>(Future<Response<dynamic>> future, T Function(dynamic json) mapper) async {
  try {
    final response = await future;
    final body = response.data as Map<String, dynamic>;
    if (body['success'] == true) {
      return mapper(body['data']);
    }
    throw ApiException(body['error']?.toString() ?? 'Error desconocido');
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}
