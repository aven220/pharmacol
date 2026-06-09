import 'package:hive_flutter/hive_flutter.dart';

class HiveService {
  static const searchCacheBox = 'search_cache';
  static const favoritesBox = 'favorites_local';
  static const pendingBox = 'pending_queue';

  Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox<Map>(searchCacheBox);
    await Hive.openBox<Map>(favoritesBox);
    await Hive.openBox<Map>(pendingBox);
  }

  Box<Map> get searchCache => Hive.box<Map>(searchCacheBox);
  Box<Map> get favorites => Hive.box<Map>(favoritesBox);
  Box<Map> get pending => Hive.box<Map>(pendingBox);

  Future<void> cacheSearch(String query, List<Map<String, dynamic>> items) async {
    await searchCache.put(query.toLowerCase(), {
      'query': query,
      'items': items,
      'cachedAt': DateTime.now().toIso8601String(),
    });
  }

  List<Map<String, dynamic>>? getCachedSearch(String query) {
    final data = searchCache.get(query.toLowerCase());
    if (data == null) return null;
    final items = data['items'];
    if (items is List) {
      return items.cast<Map<String, dynamic>>();
    }
    return null;
  }

  Future<void> clearAll() async {
    await searchCache.clear();
    await favorites.clear();
    await pending.clear();
  }
}
