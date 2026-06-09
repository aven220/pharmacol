import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../medicamentos/providers/medicamentos_provider.dart';
import '../../../core/models/models.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    setState(() => _query = _controller.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(isOnlineProvider);
    final results = _query.isEmpty
        ? null
        : ref.watch(medicamentosSearchProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: const Text('PharmaCol'),
        actions: [
          IconButton(
            icon: Icon(online ? Icons.cloud_done : Icons.cloud_off),
            tooltip: online ? 'En línea' : 'Sin conexión',
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SearchBar(
              controller: _controller,
              hintText: 'Medicamento, principio activo, INVIMA, CUM...',
              leading: const Icon(Icons.search),
              trailing: [
                if (_controller.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      _controller.clear();
                      setState(() => _query = '');
                    },
                  ),
              ],
              onSubmitted: (_) => _search(),
            ),
          ),
          if (!online)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                child: ListTile(
                  leading: Icon(Icons.offline_bolt,
                      color: Theme.of(context).colorScheme.tertiary),
                  title: const Text('Modo offline'),
                  subtitle: const Text('Mostrando resultados en caché'),
                ),
              ),
            ),
          Expanded(child: _buildResults(results)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _search(),
        icon: const Icon(Icons.search),
        label: const Text('Buscar'),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
          NavigationDestination(icon: Icon(Icons.favorite_border), label: 'Favoritos'),
        ],
        onDestinationSelected: (index) {
          if (index == 1) context.go('/favoritos');
        },
      ),
    );
  }

  Widget _buildResults(AsyncValue<PaginatedResult<MedicamentoSummary>>? results) {
    if (_query.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.medication_liquid,
                size: 64, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 16),
            Text(
              'Busca medicamentos registrados en INVIMA',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ],
        ),
      );
    }

    return results!.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(e.toString())),
      data: (data) {
        if (data.items.isEmpty) {
          return const Center(child: Text('Sin resultados'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: data.items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final item = data.items[index];
            return _MedicamentoCard(item: item);
          },
        );
      },
    );
  }
}

class _MedicamentoCard extends StatelessWidget {
  const _MedicamentoCard({required this.item});

  final MedicamentoSummary item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(item.nombreComercial, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (item.concentracion != null) Text(item.concentracion!),
            if (item.numeroRegistro != null)
              Text(item.numeroRegistro!, style: const TextStyle(fontSize: 12)),
            if (item.laboratorio != null)
              Text(item.laboratorio!, style: const TextStyle(fontSize: 12)),
          ],
        ),
        trailing: _EstadoChip(estado: item.estadoRegistro),
        onTap: () => context.push('/medicamentos/${item.id}'),
      ),
    );
  }
}

class _EstadoChip extends StatelessWidget {
  const _EstadoChip({this.estado});

  final String? estado;

  @override
  Widget build(BuildContext context) {
    final isVigente = estado?.toUpperCase() == 'VIGENTE';
    return Chip(
      label: Text(estado ?? '—', style: const TextStyle(fontSize: 11)),
      backgroundColor: isVigente
          ? Colors.green.withValues(alpha: 0.15)
          : Colors.orange.withValues(alpha: 0.15),
      visualDensity: VisualDensity.compact,
    );
  }
}
