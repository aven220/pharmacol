import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../medicamentos/data/medicamentos_repository.dart';
import '../../medicamentos/providers/medicamentos_provider.dart';

class FavoritosPage extends ConsumerWidget {
  const FavoritosPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favoritos = ref.watch(favoritosProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Favoritos')),
      body: favoritos.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No tienes favoritos aún'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = items[index];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.favorite, color: Colors.red),
                  title: Text('${item.entidadTipo} — ${item.entidadId.substring(0, 8)}...'),
                  subtitle: Text(item.notas ?? 'Sin notas'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      await ref.read(favoritosRepositoryProvider).remove(item.id);
                      ref.invalidate(favoritosProvider);
                    },
                  ),
                  onTap: () {
                    if (item.entidadTipo == 'MEDICAMENTO') {
                      context.push('/medicamentos/${item.entidadId}');
                    }
                  },
                ),
              );
            },
          );
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
          NavigationDestination(icon: Icon(Icons.favorite), label: 'Favoritos'),
        ],
        onDestinationSelected: (index) {
          if (index == 0) context.go('/home');
        },
      ),
    );
  }
}
