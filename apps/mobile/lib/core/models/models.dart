class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: json['expiresIn'] as String? ?? '15m',
      );

  final String accessToken;
  final String refreshToken;
  final String expiresIn;
}

class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.nombre,
    required this.roles,
    required this.permissions,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        email: json['email'] as String,
        nombre: json['nombre'] as String,
        roles: (json['roles'] as List<dynamic>).cast<String>(),
        permissions: (json['permissions'] as List<dynamic>).cast<String>(),
      );

  final String id;
  final String email;
  final String nombre;
  final List<String> roles;
  final List<String> permissions;

  bool get canUseOcr => permissions.contains('ocr:use');
  bool get canUseIa => permissions.contains('ia:use');
}

class MedicamentoSummary {
  const MedicamentoSummary({
    required this.id,
    required this.nombreComercial,
    this.concentracion,
    this.formaFarmaceutica,
    this.estadoRegistro,
    this.numeroRegistro,
    this.laboratorio,
  });

  factory MedicamentoSummary.fromJson(Map<String, dynamic> json) {
    final registro = json['registroInvima'] as Map<String, dynamic>?;
    final lab = json['laboratorio'] as Map<String, dynamic>?;
    return MedicamentoSummary(
      id: json['id'] as String,
      nombreComercial: json['nombreComercial'] as String,
      concentracion: json['concentracion'] as String?,
      formaFarmaceutica: json['formaFarmaceutica'] as String?,
      estadoRegistro: json['estadoRegistro'] as String?,
      numeroRegistro: registro?['numeroRegistro'] as String?,
      laboratorio: lab?['razonSocial'] as String?,
    );
  }

  final String id;
  final String nombreComercial;
  final String? concentracion;
  final String? formaFarmaceutica;
  final String? estadoRegistro;
  final String? numeroRegistro;
  final String? laboratorio;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nombreComercial': nombreComercial,
        'concentracion': concentracion,
        'formaFarmaceutica': formaFarmaceutica,
        'estadoRegistro': estadoRegistro,
        'registroInvima': {'numeroRegistro': numeroRegistro},
        'laboratorio': {'razonSocial': laboratorio},
      };
}

class PaginatedResult<T> {
  const PaginatedResult({required this.items, required this.meta});

  final List<T> items;
  final PaginationMeta meta;
}

class PaginationMeta {
  const PaginationMeta({
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory PaginationMeta.fromJson(Map<String, dynamic> json) => PaginationMeta(
        total: json['total'] as int,
        page: json['page'] as int,
        limit: json['limit'] as int,
        totalPages: json['totalPages'] as int,
      );

  final int total;
  final int page;
  final int limit;
  final int totalPages;
}

class FavoriteItem {
  const FavoriteItem({
    required this.id,
    required this.entidadTipo,
    required this.entidadId,
    this.notas,
    required this.createdAt,
  });

  factory FavoriteItem.fromJson(Map<String, dynamic> json) => FavoriteItem(
        id: json['id'] as String,
        entidadTipo: json['entidadTipo'] as String,
        entidadId: json['entidadId'] as String,
        notas: json['notas'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String entidadTipo;
  final String entidadId;
  final String? notas;
  final DateTime createdAt;
}
