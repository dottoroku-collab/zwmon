import 'dart:ui';
import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/glass_container.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;
  const TaskDetailScreen({super.key, required this.taskId});

  @override
  TaskDetailScreenState createState() => TaskDetailScreenState();
}

class TaskDetailScreenState extends State<TaskDetailScreen> {
  Map<String, dynamic>? _task;
  bool _isLoading = true;
  final TextEditingController _logController = TextEditingController();
  bool _isUpdating = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchTaskDetails();
    // Auto-refresh every 10 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _fetchTaskDetails(showLoading: false);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _logController.dispose();
    super.dispose();
  }

  Future<void> _fetchTaskDetails({bool showLoading = true}) async {
    if (showLoading) setState(() => _isLoading = true);
    try {
      final task = await ApiService.getTaskDetails(widget.taskId);
      setState(() {
        _task = task;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memuat detail task: $e')),
        );
      }
    }
  }

  Future<void> _updateStatus(String status) async {
    setState(() => _isUpdating = true);
    try {
      await ApiService.updateTaskStatus(widget.taskId, status);
      await _fetchTaskDetails(); // Refresh
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status berhasil diubah menjadi $status')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal mengubah status: $e')),
        );
      }
    } finally {
      setState(() => _isUpdating = false);
    }
  }

  Future<void> _addLog() async {
    if (_logController.text.trim().isEmpty) return;
    setState(() => _isUpdating = true);
    try {
      await ApiService.addTaskLog(widget.taskId, _logController.text.trim());
      _logController.clear();
      await _fetchTaskDetails(); // Refresh
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Log/Update berhasil ditambahkan')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menambahkan log: $e')),
        );
      }
    } finally {
      setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          title: const Text('Detail Task'),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.primary.withOpacity(0.1),
                Theme.of(context).colorScheme.secondary.withOpacity(0.1),
              ],
            ),
          ),
          child: const Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_task == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Detail Task')),
        body: const Center(child: Text('Task tidak ditemukan')),
      );
    }

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(_task!['title'] ?? 'Detail Task'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              color: Theme.of(context).colorScheme.surface.withOpacity(0.5),
            ),
          ),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.primary.withOpacity(0.1),
              Theme.of(context).colorScheme.secondary.withOpacity(0.1),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      GlassContainer(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Deskripsi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                            const SizedBox(height: 8),
                            Text(_task!['description'] ?? 'Tidak ada deskripsi'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      GlassContainer(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Aksi Cepat', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                ElevatedButton.icon(
                                  icon: const Icon(Icons.warning, color: Colors.white),
                                  label: const Text('Lapor Kendala', style: TextStyle(color: Colors.white)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.red.withOpacity(0.8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: _isUpdating ? null : () => _updateStatus('Blocked'),
                                ),
                                ElevatedButton.icon(
                                  icon: const Icon(Icons.check, color: Colors.white),
                                  label: const Text('Minta Review', style: TextStyle(color: Colors.white)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green.withOpacity(0.8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: _isUpdating ? null : () => _updateStatus('Review'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text('Logbook / Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                      const SizedBox(height: 8),
                      if (_task!['logs'] != null && (_task!['logs'] as List).isNotEmpty)
                        ...(_task!['logs'] as List).map((log) => Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: GlassContainer(
                            padding: const EdgeInsets.all(12.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(log['message'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                                const SizedBox(height: 4),
                                Text(
                                  '${log['user_name'] ?? 'Sistem'} - ${log['timestamp'] ?? ''}',
                                  style: TextStyle(fontSize: 12, color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7)),
                                ),
                              ],
                            ),
                          ),
                        ))
                      else
                        const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text('Belum ada log/pembaruan.'),
                        ),
                    ],
                  ),
                ),
              ),
              GlassContainer(
                borderRadius: const BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16)),
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _logController,
                        decoration: InputDecoration(
                          hintText: 'Tulis progres/update...',
                          filled: true,
                          fillColor: Theme.of(context).colorScheme.surface.withOpacity(0.5),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.send, color: Colors.white),
                        onPressed: _isUpdating ? null : _addLog,
                      ),
                    )
                  ],
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
