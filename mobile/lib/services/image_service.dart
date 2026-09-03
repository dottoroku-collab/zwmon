import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';

class ImageService {
  static final ImagePicker _picker = ImagePicker();

  /// Mengambil foto dari kamera atau galeri, lalu melakukan kompresi
  static Future<File?> pickAndCompressImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(source: source);
      if (pickedFile == null) return null;

      File originalFile = File(pickedFile.path);
      File? compressedFile = await compressImage(originalFile);
      
      return compressedFile ?? originalFile;
    } catch (e) {
      print('Error picking image: $e');
      return null;
    }
  }

  /// Mengompres foto dengan target kualitas dan ukuran yang ditentukan
  static Future<File?> compressImage(File file) async {
    try {
      final filePath = file.absolute.path;
      final outPath = "${filePath.substring(0, filePath.lastIndexOf('.'))}_compressed.jpg";

      var result = await FlutterImageCompress.compressAndGetFile(
        file.absolute.path,
        outPath,
        quality: 70, // Kompresi kualitas menjadi 70%
        minWidth: 1280, // Resolusi maksimum lebar
        minHeight: 720, // Resolusi maksimum tinggi
      );

      if (result != null) {
        return File(result.path);
      }
      return null;
    } catch (e) {
      print('Error compressing image: $e');
      return null;
    }
  }
}
