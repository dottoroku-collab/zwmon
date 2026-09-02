import 'dart:ui';
import 'package:flutter/material.dart';

class GlassContainer extends StatelessWidget {
  final Widget child;
  final double blur;
  final double opacity;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;

  const GlassContainer({
    Key? key,
    required this.child,
    this.blur = 10.0,
    this.opacity = 0.2,
    this.padding = const EdgeInsets.all(16.0),
    this.borderRadius,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final Color glassColor = isDark ? Colors.black : Colors.white;

    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(16.0),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: glassColor.withValues(alpha: opacity),
            borderRadius: borderRadius ?? BorderRadius.circular(16.0),
            border: Border.all(
              color: glassColor.withValues(alpha: opacity * 1.5),
              width: 1.0,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
