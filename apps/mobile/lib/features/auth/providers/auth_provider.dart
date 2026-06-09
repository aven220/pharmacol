import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/models.dart';
import '../data/auth_repository.dart';

final authStateProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthState {
  const AuthState({this.user, this.isAuthenticated = false});

  final UserProfile? user;
  final bool isAuthenticated;

  AuthState copyWith({UserProfile? user, bool? isAuthenticated}) => AuthState(
        user: user ?? this.user,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      );
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final repo = ref.read(authRepositoryProvider);
    final hasSession = await repo.hasSession();
    if (!hasSession) return const AuthState();

    try {
      final user = await repo.getProfile();
      return AuthState(user: user, isAuthenticated: true);
    } catch (_) {
      await repo.logout();
      return const AuthState();
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final tokens = await repo.login(email, password);
      await repo.saveTokens(tokens);
      final user = await repo.getProfile();
      return AuthState(user: user, isAuthenticated: true);
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthState());
  }
}
