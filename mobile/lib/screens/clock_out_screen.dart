import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_container.dart';

class ClockOutScreen extends StatefulWidget {
  const ClockOutScreen({super.key});

  @override
  State<ClockOutScreen> createState() => _ClockOutScreenState();
}

class _ClockOutScreenState extends State<ClockOutScreen> {
  bool _isInitializing = true;
  bool _isSubmitting = false;
  Position? _currentPosition;

  @override
  void initState() {
    super.initState();
    _initializeLocation();
  }

  Future<void> _initializeLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Location services are disabled.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permissions are denied');
        }
      }

      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permissions are permanently denied');
      }

      _currentPosition = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isInitializing = false;
        });
      }
    }
  }

  Future<void> _submitClockOut() async {
    if (_currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Menunggu lokasi GPS...')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final token = await ApiService.getToken();
      
      final response = await ApiService.clockOut(
        token: token!,
        latitude: _currentPosition!.latitude,
        longitude: _currentPosition!.longitude,
      );

      if (response['success'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('is_clocked_in', false);
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Clock Out Berhasil!'),
                backgroundColor: Colors.green),
          );
          context.go('/tasks');
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(response['message'] ?? 'Gagal Clock Out'),
                backgroundColor: Colors.red),
          );
          // If the error is about daily report, we can offer to navigate there
          if (response['message'] != null && response['message'].toString().toLowerCase().contains('laporan')) {
            // Wait a moment then show dialog or just let user navigate
            // Or we can auto navigate if they press OK
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Laporan Harian Diperlukan'),
                content: const Text('Anda belum mengisi Laporan Pekerjaan Hari Ini. Silakan isi terlebih dahulu sebelum Clock Out.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Batal'),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      context.push('/daily-report');
                    },
                    child: const Text('Isi Laporan Sekarang'),
                  ),
                ],
              )
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Terjadi kesalahan: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isInitializing) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Clock Out', style: TextStyle(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: AppTheme.gradientBackground,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GlassContainer(
                  child: Column(
                    children: [
                      const Icon(Icons.location_on, size: 64, color: Colors.white),
                      const SizedBox(height: 16),
                      const Text(
                        'Konfirmasi Clock Out',
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _currentPosition != null
                            ? 'Lokasi GPS berhasil didapatkan.\nPastikan Anda sudah mengisi Laporan Harian.'
                            : 'Mencari lokasi GPS...',
                        style: const TextStyle(color: Colors.white70),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  height: 60,
                  child: ElevatedButton(
                    onPressed: _isSubmitting || _currentPosition == null
                        ? null
                        : _submitClockOut,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'SUBMIT CLOCK OUT',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
