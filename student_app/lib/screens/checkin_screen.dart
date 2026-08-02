import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/checkin_provider.dart';

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

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Session Check-In'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
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
                  Icon(Icons.qr_code_scanner_rounded, size: 80, color: Colors.blueGrey[400]),
                  const SizedBox(height: 24),
                  const Text(
                    'Enter Session Code',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Ask the instructor for the active 6-digit code. Signals (Wi-Fi access point and GPS location) are validated in the background.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.blueGrey[300], fontSize: 13),
                  ),
                  const SizedBox(height: 32),
                  Form(
                    key: _formKey,
                    child: TextFormField(
                      controller: _codeController,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 6,
                      ),
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: InputDecoration(
                        hintText: '000000',
                        hintStyle: TextStyle(color: Colors.blueGrey[600], letterSpacing: 6),
                        counterText: '',
                        filled: true,
                        fillColor: const Color(0xFF1E293B),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Colors.emeraldAccent, width: 2),
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
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.emeraldAccent[400],
                      foregroundColor: const Color(0xFF0F172A),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Check In',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ] else if (isChecking) ...[
                  // Loading / Gathering signals state
                  const CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation(Colors.emeraldAccent),
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'Verifying Classroom Presence...',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _loadingStep('Syncing rotating check-in code...', true),
                  _loadingStep('Polling local Wi-Fi BSSID access points...', true),
                  _loadingStep('Acquiring high-accuracy GPS coordinates...', true),
                ] else if (result != null) ...[
                  // Result Screen (Success or Failure)
                  Icon(
                    result.isAccepted ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                    size: 100,
                    color: result.isAccepted ? Colors.emeraldAccent[400] : Colors.redAccent,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    result.isAccepted ? 'Check-In Successful!' : 'Check-In Failed',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    result.isAccepted
                        ? 'Your presence has been successfully registered. Your course percentage metrics are updated.'
                        : (result.rejectionReason ?? 'Unknown error occurred during validation.'),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.blueGrey[200], fontSize: 14),
                  ),
                  const SizedBox(height: 40),
                  if (!result.isAccepted)
                    ElevatedButton(
                      onPressed: () {
                        checkin.reset();
                        _codeController.clear();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Try Again', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  if (result.isAccepted)
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.emeraldAccent[400],
                        side: BorderSide(color: Colors.emeraldAccent[400]!),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Back to Home', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _loadingStep(String title, bool active) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          Icon(Icons.check, size: 14, color: active ? Colors.emeraldAccent[400] : Colors.blueGrey),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: active ? Colors.white70 : Colors.blueGrey,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
