import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://api.zwmon.com/api'; // Or use dotenv for configuration

  // Login
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      
      // Save token to SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      if (data['user'] != null) {
        await prefs.setString('user_id', data['user']['id'] ?? '');
        await prefs.setString('user_role', data['user']['role'] ?? '');
        await prefs.setString('user_name', data['user']['full_name'] ?? data['user']['username'] ?? '');
      }
      
      return data;
    } else {
      throw Exception('Gagal login: ${response.body}');
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user_id');
    await prefs.remove('user_role');
    await prefs.remove('user_name');
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  // Tasks
  static Future<List<dynamic>> getTasks() async {
    final token = await getToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.get(
      Uri.parse('$baseUrl/tasks'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load tasks');
    }
  }

  static Future<Map<String, dynamic>> getTaskDetails(String taskId) async {
    final token = await getToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.get(
      Uri.parse('$baseUrl/tasks/$taskId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load task details');
    }
  }

  static Future<void> updateTaskStatus(String taskId, String status) async {
    final token = await getToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.put(
      Uri.parse('$baseUrl/tasks/$taskId/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'status': status}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to update task status');
    }
  }

  static Future<void> addTaskLog(String taskId, String message, {String action = 'update_progress'}) async {
    final token = await getToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/tasks/$taskId/logs'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'message': message, 'action': action}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to add task log');
    }
  }

  // Attendance Endpoints
  static Future<Map<String, dynamic>> registerFaceReference({
    required String token,
    required File imageFile,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/attendance/face-reference'));
    request.headers['Authorization'] = 'Bearer $token';
    
    request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
    
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      return {'success': true, ...jsonDecode(response.body)};
    } else {
      try {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['detail'] ?? 'Terjadi kesalahan'};
      } catch (e) {
        return {'success': false, 'message': 'Terjadi kesalahan sistem'};
      }
    }
  }

  static Future<Map<String, dynamic>> clockIn({
    required String token,
    required double latitude,
    required double longitude,
    required File imageFile,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/attendance/clock-in'));
    request.headers['Authorization'] = 'Bearer $token';
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();
    
    request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
    
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      return {'success': true, ...jsonDecode(response.body)};
    } else {
      try {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['detail'] ?? 'Terjadi kesalahan'};
      } catch (e) {
        return {'success': false, 'message': 'Terjadi kesalahan sistem'};
      }
    }
  }

  static Future<Map<String, dynamic>> clockOut({
    required String token,
    required double latitude,
    required double longitude,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/attendance/clock-out'),
      headers: {
        'Authorization': 'Bearer $token',
      },
      body: {
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
      }
    );
    
    if (response.statusCode == 200) {
      return {'success': true, ...jsonDecode(response.body)};
    } else {
      try {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['detail'] ?? 'Terjadi kesalahan'};
      } catch (e) {
        return {'success': false, 'message': 'Terjadi kesalahan sistem'};
      }
    }
  }

  static Future<Map<String, dynamic>> submitDailyReport({
    required String token,
    required String reportText,
    required File imageFile,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/attendance/daily-report'));
    request.headers['Authorization'] = 'Bearer $token';
    request.fields['report_text'] = reportText;
    
    request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
    
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      return {'success': true, ...jsonDecode(response.body)};
    } else {
      try {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['detail'] ?? 'Terjadi kesalahan'};
      } catch (e) {
        return {'success': false, 'message': 'Terjadi kesalahan sistem'};
      }
    }
  }

  static Future<void> sendLocationPing({
    required String token,
    required double latitude,
    required double longitude,
    double? batteryLevel,
    double? speed,
  }) async {
    await http.post(
      Uri.parse('$baseUrl/attendance/ping'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'latitude': latitude,
        'longitude': longitude,
        'battery_level': batteryLevel,
        'speed': speed,
      }),
    );
  }

  static Future<bool> sendPttAudio({
    required String token,
    required String filePath,
  }) async {
    try {
      final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/ptt/upload'));
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(await http.MultipartFile.fromPath('audio_file', filePath));
      
      final response = await request.send();
      return response.statusCode == 200;
    } catch (e) {
      print('Failed to send PTT audio: $e');
      return false;
    }
  }
}
