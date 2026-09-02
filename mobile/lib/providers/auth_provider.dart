import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  String? _userName;
  String? _userRole;
  bool _isLoading = true;

  bool get isAuthenticated => _isAuthenticated;
  String? get userName => _userName;
  String? get userRole => _userRole;
  bool get isLoading => _isLoading;

  AuthProvider() {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await ApiService.getToken();
    if (token != null) {
      _isAuthenticated = true;
      // In a real app we might fetch user profile here
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService.login(email, password);
      _isAuthenticated = true;
      if (data['user'] != null) {
        _userName = data['user']['full_name'] ?? data['user']['username'];
        _userRole = data['user']['role'];
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await ApiService.logout();
    _isAuthenticated = false;
    _userName = null;
    _userRole = null;
    notifyListeners();
  }
}
