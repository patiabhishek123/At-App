import 'package:flutter/material.dart';

class AppTheme {
  static const Color bg = Color(0xFFF2EFE9);       // Warm beige/off-white background
  static const Color surface = Color(0xFFFCFAF7);  // Creamy white card surface
  static const Color primary = Color(0xFF111111);  // Obsidian black
  static const Color accent = Color(0xFFE4AF3A);   // Ochre yellow for primary interactive highlights
  static const Color border = Color(0xFFEBE6DD);   // Thin divider border
  static const Color textDark = Color(0xFF111111);
  static const Color textMuted = Color(0xFF7A756B);
  
  static const Color success = Color(0xFF2E7D32);
  static const Color danger = Color(0xFFC62828);
  static const Color warning = Color(0xFFEF6C00);
}

class NeumorphicCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final Color? color;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final List<BoxShadow>? extraShadows;

  const NeumorphicCard({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.color,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.all(0),
    this.extraShadows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? AppTheme.surface,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppTheme.border, width: 1.2),
        boxShadow: extraShadows ??
            [
              BoxShadow(
                color: AppTheme.primary.withOpacity(0.02),
                offset: const Offset(0, 4),
                blurRadius: 12,
              ),
            ],
      ),
      child: child,
    );
  }
}

class NeumorphicButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final double borderRadius;
  final Color? color;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  const NeumorphicButton({
    super.key,
    required this.child,
    this.onPressed,
    this.borderRadius = 16,
    this.color,
    this.padding = const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
    this.margin = const EdgeInsets.all(0),
  });

  @override
  State<NeumorphicButton> createState() => _NeumorphicButtonState();
}

class _NeumorphicButtonState extends State<NeumorphicButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final bool disabled = widget.onPressed == null;
    final Color defaultColor = widget.color ?? AppTheme.primary;
    
    // Choose appropriate background/border treatment
    final Color buttonColor = disabled 
        ? defaultColor.withOpacity(0.35) 
        : (_isPressed ? defaultColor.withOpacity(0.85) : defaultColor);

    final bool isOutlineButton = defaultColor != AppTheme.primary && defaultColor != AppTheme.accent;

    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _isPressed = true),
      onTapUp: disabled ? null : (_) => setState(() => _isPressed = false),
      onTapCancel: disabled ? null : () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedScale(
        scale: _isPressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          margin: widget.margin,
          padding: widget.padding,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: buttonColor,
            borderRadius: BorderRadius.circular(widget.borderRadius),
            border: isOutlineButton 
                ? Border.all(color: AppTheme.border, width: 1.2) 
                : null,
            boxShadow: disabled
                ? []
                : [
                    BoxShadow(
                      color: AppTheme.primary.withOpacity(0.04),
                      offset: const Offset(0, 4),
                      blurRadius: 10,
                    ),
                  ],
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

class NeumorphicCircleProgress extends StatelessWidget {
  final double value; // 0.0 to 1.0
  final String centerText;
  final String labelText;
  final double size;
  final Color progressColor;

  const NeumorphicCircleProgress({
    super.key,
    required this.value,
    required this.centerText,
    required this.labelText,
    this.size = 110,
    this.progressColor = AppTheme.primary,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: value,
              strokeWidth: 9,
              backgroundColor: AppTheme.border,
              valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              strokeCap: StrokeCap.round,
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                centerText,
                style: const TextStyle(
                  color: AppTheme.textDark,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  fontFamily: 'monospace',
                ),
              ),
              if (labelText.isNotEmpty) ...[
                const SizedBox(height: 1),
                Text(
                  labelText.toUpperCase(),
                  style: const TextStyle(
                    color: AppTheme.textMuted,
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
