import 'dart:async';
import 'dart:ui';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:battery_plus/battery_plus.dart';
import 'api_service.dart';

Future<void> initializeBackgroundService() async {
  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: 'zwmon_location_channel',
      initialNotificationTitle: 'ZWMON Tracking Aktif',
      initialNotificationContent: 'Melacak lokasi di latar belakang',
      foregroundServiceNotificationId: 888,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );

  await service.startService();
}

@pragma('vm:entry-point')
bool onIosBackground(ServiceInstance service) {
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Fetch location every 10 minutes
  Timer.periodic(const Duration(minutes: 10), (timer) async {
    if (service is AndroidServiceInstance) {
      if (await service.isForegroundService()) {
        try {
          final prefs = await SharedPreferences.getInstance();
          final isClockedIn = prefs.getBool('is_clocked_in') ?? false;
          
          if (!isClockedIn) return; // Do not track if not clocked in
          
          final token = prefs.getString('token');
          if (token != null) {
            bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
            if (serviceEnabled) {
              Position position = await Geolocator.getCurrentPosition(
                  desiredAccuracy: LocationAccuracy.high);
              
              final battery = Battery();
              final batteryLevel = await battery.batteryLevel;
              
              await ApiService.sendLocationPing(
                token: token,
                latitude: position.latitude,
                longitude: position.longitude,
                batteryLevel: batteryLevel.toDouble(),
                speed: position.speed,
              );
            }
          }
        } catch (e) {
          print('Background service error: $e');
        }
      }
    }
  });
}
