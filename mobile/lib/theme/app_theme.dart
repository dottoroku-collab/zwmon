import 'package:flutter/material.dart';

class AppTheme {
  static BoxDecoration get gradientBackground {
    return const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xFF6A11CB), Color(0xFF2575FC)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      primarySwatch: Colors.blue,
      primaryColor: const Color(0xFF6A11CB),
      scaffoldBackgroundColor: const Color(0xFFF3F4F6),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(color: Colors.black87),
        bodyMedium: TextStyle(color: Colors.black87),
      ),
      colorScheme: ColorScheme.light(
        primary: const Color(0xFF6A11CB),
        secondary: const Color(0xFF2575FC),
        surface: Colors.white.withOpacity(0.8),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primarySwatch: Colors.indigo,
      primaryColor: const Color(0xFF2575FC),
      scaffoldBackgroundColor: const Color(0xFF121212),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(color: Colors.white70),
        bodyMedium: TextStyle(color: Colors.white70),
      ),
      colorScheme: ColorScheme.dark(
        primary: const Color(0xFF2575FC),
        secondary: const Color(0xFF6A11CB),
        surface: Colors.black.withOpacity(0.5),
      ),
    );
  }
}
