import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class PTTButton extends StatefulWidget {
  const PTTButton({Key? key}) : super(key: key);

  @override
  State<PTTButton> createState() => _PTTButtonState();
}

class _PTTButtonState extends State<PTTButton> with SingleTickerProviderStateMixin {
  late AudioRecorder _audioRecorder;
  bool _isRecording = false;
  String? _recordPath;
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _audioRecorder = AudioRecorder();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _audioRecorder.dispose();
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
      if (await _audioRecorder.hasPermission()) {
        final dir = await getApplicationDocumentsDirectory();
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        _recordPath = '${dir.path}/ptt_$timestamp.m4a';
        
        await _audioRecorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc),
          path: _recordPath!,
        );

        setState(() {
          _isRecording = true;
        });
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Izin mikrofon diperlukan')),
          );
        }
      }
    } catch (e) {
      print('Failed to start recording: $e');
    }
  }

  Future<void> _stopRecording() async {
    try {
      final path = await _audioRecorder.stop();
      setState(() {
        _isRecording = false;
      });

      if (path != null) {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');
        if (token != null) {
          final success = await ApiService.sendPttAudio(token: token, filePath: path);
          if (success) {
            // Delete file after sending
            File(path).delete().catchError((e) => print(e));
          } else {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Gagal mengirim audio')),
              );
            }
          }
        }
      }
    } catch (e) {
      print('Failed to stop recording: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (_) => _startRecording(),
      onLongPressEnd: (_) => _stopRecording(),
      onLongPressCancel: () => _stopRecording(),
      child: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isRecording ? Colors.red : Colors.blueAccent,
              boxShadow: _isRecording
                  ? [
                      BoxShadow(
                        color: Colors.red.withOpacity(0.5 * _animationController.value),
                        spreadRadius: 15 * _animationController.value,
                        blurRadius: 15,
                      )
                    ]
                  : [
                      BoxShadow(
                        color: Colors.blueAccent.withOpacity(0.3),
                        spreadRadius: 2,
                        blurRadius: 10,
                      )
                    ],
            ),
            child: Icon(
              _isRecording ? Icons.mic : Icons.mic_none,
              color: Colors.white,
              size: 35,
            ),
          );
        },
      ),
    );
  }
}
