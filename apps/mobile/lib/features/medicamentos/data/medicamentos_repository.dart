import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/models.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/hive_service.dart';

import '../../../core/providers/core_providers.dart';

final medicamentosRepositoryProvider = Provider<MedicamentosRepository>((ref) {
  return MedicamentosRepository(
    dio: ref.watch(dioProvider),
    hive: ref.watch(hiveServiceProvider),
  );
});

final connectivityProvider = StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

final isOnlineProvider = Provider<bool>((ref) {
  final connectivity = ref.watch(connectivityProvider);
  return connectivity.maybeWhen(
    data: (results) => !results.contains(ConnectivityResult.none),
    orElse: () => true,
  );
});

class MedicamentosRepository {
  MedicamentosRepository({required Dio dio, required HiveService hive})
      : _dio = dio,
        _hive = hive;

  final Dio _dio;
  final HiveService _hive;

  Future<PaginatedResult<MedicamentoSummary>> search({
    required String query,
    String tipo = 'nombre',
    int page = 1,
    int limit = 20,
    bool online = true,
  }) async {
    if (!online) {
      final cached = _hive.getCachedSearch(query);
      if (cached != null) {
        return PaginatedResult(
          items: cached.map(MedicamentoSummary.fromJson).toList(),
          meta: PaginationMeta(
            total: cached.length,
            page: 1,
            limit: limit,
            totalPages: 1,
          ),
        );
      }
      throw ApiException('Sin conexión y sin datos en caché');
    }

    final result = await unwrapApi(
      _dio.get('/medicamentos/search', queryParameters: {
        'q': query,
        'tipo': tipo,
        'page': page,
        'limit': limit,
      }),
      (json) {
        final map = json as Map<String, dynamic>;
        final items = (map['items'] as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(MedicamentoSummary.fromJson)
            .toList();
        return PaginatedResult(
          items: items,
          meta: PaginationMeta.fromJson(map['meta'] as Map<String, dynamic>),
        );
      },
    );

    if (page == 1 && query.isNotEmpty) {
      await _hive.cacheSearch(
        query,
        result.items.map((e) => e.toJson()).toList(),
      );
    }

    return result;
  }

  Future<Map<String, dynamic>> getDetail(String id, {bool online = true}) async {
    if (!online) {
      throw ApiException('Detalle no disponible offline');
    }
    return unwrapApi(
      _dio.get('/medicamentos/$id'),
      (json) => json as Map<String, dynamic>,
    );
  }
}

final favoritosRepositoryProvider = Provider<FavoritosRepository>((ref) {
  return FavoritosRepository(dio: ref.watch(dioProvider));
});

class FavoritosRepository {
  FavoritosRepository({required Dio dio}) : _dio = dio;
  final Dio _dio;

  Future<List<FavoriteItem>> list() async {
    return unwrapApi(
      _dio.get('/favoritos'),
      (json) {
        final map = json as Map<String, dynamic>;
        return (map['items'] as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(FavoriteItem.fromJson)
            .toList();
      },
    );
  }

  Future<void> add({required String entidadTipo, required String entidadId}) async {
    await unwrapApi(
      _dio.post('/favoritos', data: {
        'entidadTipo': entidadTipo,
        'entidadId': entidadId,
      }),
      (_) => null,
    );
  }

  Future<void> remove(String id) async {
    await unwrapApi(_dio.delete('/favoritos/$id'), (_) => null);
  }
}
