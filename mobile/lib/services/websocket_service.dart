import 'dart:convert';
import 'package:audioplayers/audioplayers.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'api_service.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  WebSocketChannel? _channel;
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isConnected = false;

  Future<void> connect() async {
    if (_isConnected) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      if (token == null) return;

      // Extract base domain from ApiService.baseUrl
      // e.g., https://api.zwmon.com/api -> wss://api.zwmon.com/ws/$token
      final uri = Uri.parse(ApiService.baseUrl);
      final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
      final wsUrl = Uri.parse('$scheme://${uri.host}${uri.port == 80 || uri.port == 443 ? '' : ':${uri.port}'}/ws/$token');

      _channel = WebSocketChannel.connect(wsUrl);
      _isConnected = true;

      _channel!.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onDone: () {
          _isConnected = false;
          _reconnect();
        },
        onError: (error) {
          print('WebSocket error: $error');
          _isConnected = false;
          _reconnect();
        },
      );
    } catch (e) {
      print('Failed to connect WebSocket: $e');
      _reconnect();
    }
  }

  void _reconnect() {
    Future.delayed(const Duration(seconds: 5), () {
      if (!_isConnected) {
        connect();
      }
    });
  }

  void _handleMessage(dynamic message) async {
    try {
      final data = jsonDecode(message as String);
      
      if (data['type'] == 'ptt_audio') {
        final audioUrl = data['url'];
        final senderId = data['sender_id'];
        
        final prefs = await SharedPreferences.getInstance();
        final currentUserId = prefs.getString('user_id');
        
        // Do not play if I am the sender
        if (senderId != currentUserId) {
          final uri = Uri.parse(ApiService.baseUrl);
          final fullUrl = '${uri.scheme}://${uri.host}${uri.port == 80 || uri.port == 443 ? '' : ':${uri.port}'}$audioUrl';
          
          await _audioPlayer.play(UrlSource(fullUrl));
        }
      }
    } catch (e) {
      print('Error parsing WebSocket message: $e');
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _isConnected = false;
  }
}
