import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/medicamentos_provider.dart';
import '../data/medicamentos_repository.dart';

class MedicamentoDetailPage extends ConsumerWidget {
  const MedicamentoDetailPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(medicamentoDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Detalle')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (data) => _DetailBody(data: data, id: id),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.data, required this.id});

  final Map<String, dynamic> data;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final registro = data['registroInvima'] as Map<String, dynamic>?;
    final titular = data['titular'] as Map<String, dynamic>?;
    final principios = data['principiosActivos'] as List<dynamic>? ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          data['nombreComercial'] as String? ?? '—',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        _InfoTile('Registro INVIMA', registro?['numeroRegistro'] as String?),
        _InfoTile('Estado', data['estadoRegistro'] as String?),
        _InfoTile('Concentración', data['concentracion'] as String?),
        _InfoTile('Forma farmacéutica', data['formaFarmaceutica'] as String?),
        _InfoTile('Titular', titular?['razonSocial'] as String?),
        if (principios.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Principios activos', style: Theme.of(context).textTheme.titleMedium),
          ...principios.map((p) {
            final pa = p['principioActivo'] as Map<String, dynamic>?;
            return ListTile(
              dense: true,
              title: Text(pa?['nombreOficial'] as String? ?? '—'),
              subtitle: Text(p['concentracion'] as String? ?? ''),
            );
          }),
        ],
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () async {
            try {
              await ref.read(favoritosRepositoryProvider).add(
                    entidadTipo: 'MEDICAMENTO',
                    entidadId: id,
                  );
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Agregado a favoritos')),
                );
              }
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(e.toString())),
                );
              }
            }
          },
          icon: const Icon(Icons.favorite_border),
          label: const Text('Agregar a favoritos'),
        ),
      ],
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile(this.label, this.value);

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          Expanded(child: Text(value!)),
        ],
      ),
    );
  }
}
