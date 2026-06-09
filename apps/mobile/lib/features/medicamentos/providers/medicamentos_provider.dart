import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/models.dart';
import '../data/medicamentos_repository.dart';

final searchQueryProvider = StateProvider<String>((ref) => '');

final medicamentosSearchProvider =
    FutureProvider.autoDispose.family<PaginatedResult<MedicamentoSummary>, String>(
  (ref, query) async {
    if (query.trim().isEmpty) {
      return const PaginatedResult(
        items: [],
        meta: PaginationMeta(total: 0, page: 1, limit: 20, totalPages: 1),
      );
    }
    final online = ref.watch(isOnlineProvider);
    return ref.read(medicamentosRepositoryProvider).search(
          query: query,
          online: online,
        );
  },
);

final medicamentoDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, id) async {
    final online = ref.watch(isOnlineProvider);
    return ref.read(medicamentosRepositoryProvider).getDetail(id, online: online);
  },
);

final favoritosProvider = FutureProvider.autoDispose<List<FavoriteItem>>((ref) {
  return ref.read(favoritosRepositoryProvider).list();
});
