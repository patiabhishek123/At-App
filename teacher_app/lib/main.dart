import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/session_provider.dart';
import 'screens/login_screen.dart';
import 'screens/schedule_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => SessionProvider()),
      ],
      child: const AtAppTeacher(),
    ),
  );
}

class AtAppTeacher extends StatelessWidget {
  const AtAppTeacher({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AtApp Teacher',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A), // Slate 900
        primaryColor: Colors.white,
        colorScheme: const ColorScheme.dark(
          primary: Colors.white,
          secondary: Colors.blueGrey,
          background: Color(0xFF0F172A),
          surface: Color(0xFF1E293B), // Slate 800
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.white70),
          bodyMedium: TextStyle(color: Colors.white60),
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isCheckingStartup) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation(Colors.white),
          ),
        ),
      );
    }

    if (auth.isAuthenticated) {
      return const ScheduleScreen();
    }

    return const LoginScreen();
  }
}
