import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/task_list_screen.dart';
import 'screens/task_detail_screen.dart';
import 'screens/clock_in_screen.dart';
import 'screens/clock_out_screen.dart';
import 'screens/daily_report_screen.dart';
import 'screens/face_registration_screen.dart';
import 'services/background_service.dart';

import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeBackgroundService();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const ZWMONApp(),
    ),
  );
}

class ZWMONApp extends StatelessWidget {
  const ZWMONApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    final GoRouter router = GoRouter(
      initialLocation: '/login',
      redirect: (BuildContext context, GoRouterState state) {
        final bool loggedIn = authProvider.isAuthenticated;
        final bool loggingIn = state.uri.toString() == '/login';
        
        if (authProvider.isLoading) return null;

        if (!loggedIn && !loggingIn) return '/login';
        if (loggedIn && loggingIn) return '/tasks';
        
        return null;
      },
      refreshListenable: authProvider,
      routes: <RouteBase>[
        GoRoute(
          path: '/login',
          builder: (BuildContext context, GoRouterState state) {
            return const LoginScreen();
          },
        ),
        GoRoute(
          path: '/tasks',
          builder: (BuildContext context, GoRouterState state) {
            return const TaskListScreen();
          },
        ),
        GoRoute(
          path: '/task/:id',
          builder: (BuildContext context, GoRouterState state) {
            return TaskDetailScreen(taskId: state.pathParameters['id']!);
          },
        ),
        GoRoute(
          path: '/clock-in',
          builder: (BuildContext context, GoRouterState state) {
            return const ClockInScreen();
          },
        ),
        GoRoute(
          path: '/clock-out',
          builder: (BuildContext context, GoRouterState state) {
            return const ClockOutScreen();
          },
        ),
        GoRoute(
          path: '/register-face',
          builder: (BuildContext context, GoRouterState state) {
            return const FaceRegistrationScreen();
          },
        ),
        GoRoute(
          path: '/daily-report',
          builder: (BuildContext context, GoRouterState state) {
            return const DailyReportScreen();
          },
        ),
      ],
    );

    return MaterialApp.router(
      title: 'ZWMON Mobile',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system, // Auto detect system theme
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}

