import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/checkin_provider.dart';
import '../widgets/neumorphic.dart';

class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  final _codeController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CheckinProvider>().reset();
    });
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    final checkin = context.read<CheckinProvider>();
    await checkin.submitCheckin(_codeController.text);
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final checkin = context.watch<CheckinProvider>();
    final isChecking = checkin.isCheckingIn;
    final result = checkin.lastResult;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFFC7D2FE), // Soft Lavender/Indigo
            Color(0xFFE0E7FF), // Soft violet
            Color(0xFFF0F4F8), // Soft light-blueish grey
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text(
            'Session Check-In',
            style: TextStyle(
              color: Color(0xFF2D3748),
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          foregroundColor: const Color(0xFF2D3748),
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (result == null && !isChecking) ...[
                    // Prompt Screen
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F4F8),
                          shape: BoxShape.circle,
                          boxShadow: [
                            const BoxShadow(
                              color: Colors.white,
                              offset: Offset(-6, -6),
                              blurRadius: 12,
                            ),
                            BoxShadow(
                              color: const Color(0xFFD1D9E6).withOpacity(0.8),
                              offset: const Offset(6, 6),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.qr_code_scanner_rounded,
                          size: 60,
                          color: Color(0xFF6C63FF),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    const Text(
                      'Enter Session Code',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFF2D3748),
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16.0),
                      child: Text(
                        'Ask the instructor for the active 6-digit code. Signals (Wi-Fi access point and GPS location) are validated in the background.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF718096),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          height: 1.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 36),
                    
                    NeumorphicCard(
                      borderRadius: 24,
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _formKey,
                        child: TextFormField(
                          controller: _codeController,
                          style: const TextStyle(
                            color: Color(0xFF2D3748),
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 8,
                          ),
                          textAlign: TextAlign.center,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          decoration: InputDecoration(
                            hintText: '000000',
                            hintStyle: const TextStyle(
                              color: Colors.blueGrey,
                              letterSpacing: 8,
                            ),
                            counterText: '',
                            filled: true,
                            fillColor: const Color(0xFFE6EDF5),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(color: Color(0xFF6C63FF), width: 1.5),
                            ),
                          ),
                          validator: (val) {
                            if (val == null || val.trim().length != 6) {
                              return 'Enter exactly 6 digits';
                            }
                            return null;
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    
                    NeumorphicButton(
                      color: const Color(0xFF6C63FF),
                      onPressed: _submit,
                      child: const Text(
                        'Check In',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ] else if (isChecking) ...[
                    // Loading / Gathering signals state
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F4F8),
                          shape: BoxShape.circle,
                          boxShadow: [
                            const BoxShadow(
                              color: Colors.white,
                              offset: Offset(-6, -6),
                              blurRadius: 12,
                            ),
                            BoxShadow(
                              color: const Color(0xFFD1D9E6).withOpacity(0.8),
                              offset: const Offset(6, 6),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: const SizedBox(
                          height: 48,
                          width: 48,
                          child: CircularProgressIndicator(
                            strokeWidth: 4,
                            valueColor: AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                    const Text(
                      'Verifying Classroom Presence...',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFF2D3748),
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 24),
                    NeumorphicCard(
                      borderRadius: 20,
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          _loadingStep('Syncing rotating check-in code...', true),
                          const Divider(color: Colors.black12, height: 16),
                          _loadingStep('Polling local Wi-Fi BSSID access points...', true),
                          const Divider(color: Colors.black12, height: 16),
                          _loadingStep('Acquiring high-accuracy GPS coordinates...', true),
                        ],
                      ),
                    ),
                  ] else if (result != null) ...[
                    // Result Screen (Success or Failure)
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F4F8),
                          shape: BoxShape.circle,
                          boxShadow: [
                            const BoxShadow(
                              color: Colors.white,
                              offset: Offset(-6, -6),
                              blurRadius: 12,
                            ),
                            BoxShadow(
                              color: const Color(0xFFD1D9E6).withOpacity(0.8),
                              offset: const Offset(6, 6),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: Icon(
                          result.isAccepted ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                          size: 80,
                          color: result.isAccepted ? const Color(0xFF4AD66D) : const Color(0xFFF35B7A),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      result.isAccepted ? 'Check-In Successful!' : 'Check-In Failed',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFF2D3748),
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: Text(
                        result.isAccepted
                            ? 'Your presence has been successfully registered. Your course percentage metrics are updated.'
                            : (result.rejectionReason ?? 'Unknown error occurred during validation.'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFF718096),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          height: 1.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 48),
                    if (!result.isAccepted)
                      NeumorphicButton(
                        color: Colors.white,
                        onPressed: () {
                          checkin.reset();
                          _codeController.clear();
                        },
                        child: const Text(
                          'Try Again',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF6C63FF),
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    if (result.isAccepted)
                      NeumorphicButton(
                        color: const Color(0xFF6C63FF),
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text(
                          'Back to Home',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _loadingStep(String title, bool active) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: active ? const Color(0xFF4AD66D).withOpacity(0.15) : Colors.black12,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check,
              size: 14,
              color: active ? const Color(0xFF4AD66D) : Colors.blueGrey,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                color: active ? const Color(0xFF2D3748) : Colors.blueGrey,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
