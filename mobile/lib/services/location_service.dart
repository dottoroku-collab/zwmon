import 'dart:async';
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  Timer? _timer;
  bool _isTracking = false;

  Future<void> startTracking(String backendUrl, String token) async {
    if (_isTracking) return;

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return Future.error('Location services are disabled.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return Future.error('Location permissions are denied');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return Future.error('Location permissions are permanently denied, we cannot request permissions.');
    }

    _isTracking = true;
    print("Mulai tracking lokasi setiap 30 menit");

    // Ping pertama
    await _sendLocation(backendUrl, token);

    // Jadwal ping selanjutnya setiap 30 menit
    _timer = Timer.periodic(const Duration(minutes: 30), (timer) async {
      await _sendLocation(backendUrl, token);
    });
  }

  void stopTracking() {
    _timer?.cancel();
    _isTracking = false;
    print("Berhenti tracking lokasi");
  }

  Future<void> _sendLocation(String backendUrl, String token) async {
    try {
      Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);

      final url = Uri.parse('$backendUrl/api/location/update');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'latitude': position.latitude,
          'longitude': position.longitude,
        }),
      );

      if (response.statusCode == 200) {
        print("Lokasi berhasil dikirim: ${position.latitude}, ${position.longitude}");
      } else {
        print("Gagal mengirim lokasi: ${response.body}");
      }
    } catch (e) {
      print("Error mengirim lokasi: $e");
    }
  }
}
