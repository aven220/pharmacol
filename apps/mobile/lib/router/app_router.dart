import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/favoritos/presentation/favoritos_page.dart';
import '../features/home/presentation/home_page.dart';
import '../features/medicamentos/presentation/medicamento_detail_page.dart';
import '../features/profile/presentation/profile_page.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

class RouterRefreshNotifier extends ChangeNotifier {
  RouterRefreshNotifier(this.ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = RouterRefreshNotifier(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/login',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authStateProvider);
      if (auth.isLoading) return null;

      final loggedIn = auth.valueOrNull?.isAuthenticated ?? false;
      final location = state.matchedLocation;
      final isLogin = location == '/login';

      if (!loggedIn && !isLogin) return '/login';
      if (loggedIn && isLogin) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginPage(),
      ),
      GoRoute(
        path: '/home',
        builder: (_, __) => const HomePage(),
      ),
      GoRoute(
        path: '/favoritos',
        builder: (_, __) => const FavoritosPage(),
      ),
      GoRoute(
        path: '/profile',
        builder: (_, __) => const ProfilePage(),
      ),
      GoRoute(
        path: '/medicamentos/:id',
        builder: (_, state) => MedicamentoDetailPage(
          id: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});
