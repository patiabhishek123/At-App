import 'package:flutter/material.dart';

class NeumorphicCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final Color color;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final List<BoxShadow>? extraShadows;

  const NeumorphicCard({
    super.key,
    required this.child,
    this.borderRadius = 24,
    this.color = const Color(0xFFF0F4F8),
    this.padding = const EdgeInsets.all(20),
    this.margin = const EdgeInsets.all(0),
    this.extraShadows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: extraShadows ??
            [
              const BoxShadow(
                color: Colors.white,
                offset: Offset(-8, -8),
                blurRadius: 16,
              ),
              BoxShadow(
                color: const Color(0xFFD1D9E6).withOpacity(0.9),
                offset: const Offset(8, 8),
                blurRadius: 16,
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
  final Color color;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  const NeumorphicButton({
    super.key,
    required this.child,
    this.onPressed,
    this.borderRadius = 24,
    this.color = Colors.white,
    this.padding = const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
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
    
    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _isPressed = true),
      onTapUp: disabled ? null : (_) => setState(() => _isPressed = false),
      onTapCancel: disabled ? null : () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        margin: widget.margin,
        padding: widget.padding,
        decoration: BoxDecoration(
          color: disabled ? widget.color.withOpacity(0.6) : widget.color,
          borderRadius: BorderRadius.circular(widget.borderRadius),
          boxShadow: disabled
              ? []
              : _isPressed
                  ? [
                      BoxShadow(
                        color: const Color(0xFFD1D9E6).withOpacity(0.8),
                        offset: const Offset(1, 1),
                        blurRadius: 4,
                      ),
                      const BoxShadow(
                        color: Colors.white,
                        offset: Offset(-1, -1),
                        blurRadius: 4,
                      ),
                    ]
                  : [
                      const BoxShadow(
                        color: Colors.white,
                        offset: Offset(-6, -6),
                        blurRadius: 12,
                      ),
                      BoxShadow(
                        color: const Color(0xFFD1D9E6).withOpacity(0.9),
                        offset: const Offset(6, 6),
                        blurRadius: 12,
                      ),
                    ],
        ),
        child: widget.child,
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
    this.size = 140,
    this.progressColor = const Color(0xFF6C63FF),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFF0F4F8),
        shape: BoxShape.circle,
        boxShadow: [
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-8, -8),
            blurRadius: 16,
          ),
          BoxShadow(
            color: const Color(0xFFD1D9E6).withOpacity(0.9),
            offset: const Offset(8, 8),
            blurRadius: 16,
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size - 30,
            height: size - 30,
            decoration: BoxDecoration(
              color: const Color(0xFFF0F4F8),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.white.withOpacity(0.9),
                  offset: const Offset(3, 3),
                  blurRadius: 6,
                ),
                BoxShadow(
                  color: const Color(0xFFD1D9E6).withOpacity(0.9),
                  offset: const Offset(-3, -3),
                  blurRadius: 6,
                ),
              ],
            ),
          ),
          SizedBox(
            width: size - 20,
            height: size - 20,
            child: CircularProgressIndicator(
              value: value,
              strokeWidth: 10,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(progressColor),
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                centerText,
                style: const TextStyle(
                  color: Color(0xFF2D3748),
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (labelText.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  labelText,
                  style: const TextStyle(
                    color: Colors.blueGrey,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
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
