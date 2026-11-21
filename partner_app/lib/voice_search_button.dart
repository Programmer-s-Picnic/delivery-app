import 'dart:async';

import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// A user-initiated voice shortcut. Only recognized text is returned to search.
/// Audio is handled by the device's configured speech-recognition service.
class VoiceSearchButton extends StatefulWidget {
  const VoiceSearchButton({
    super.key,
    required this.onText,
    this.hindi = false,
  });

  final ValueChanged<String> onText;
  final bool hindi;

  @override
  State<VoiceSearchButton> createState() => _VoiceSearchButtonState();
}

class _VoiceSearchButtonState extends State<VoiceSearchButton> {
  final SpeechToText _speech = SpeechToText();
  bool _initialized = false;
  bool _starting = false;
  bool _listening = false;

  String get _unavailable => widget.hindi
      ? 'वॉइस सर्च उपलब्ध नहीं है। लिखकर खोजें।'
      : 'Voice search is unavailable. Please type your search.';
  String get _failure => widget.hindi
      ? 'आवाज़ नहीं समझ आई। फिर कोशिश करें या लिखें।'
      : 'Speech not recognized. Please try again or type.';

  void _feedback(String text) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(text), duration: const Duration(seconds: 3)),
    );
  }

  Future<void> _toggle() async {
    if (_speech.isListening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    if (_starting) return;
    setState(() => _starting = true);
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if (mounted) setState(() => _listening = status == 'listening');
        },
        onError: (error) {
          if (!mounted) return;
          setState(() => _listening = false);
          _feedback(_failure);
        },
      );
      if (!mounted) return;
      if (!available) {
        _feedback(_unavailable);
        return;
      }
      _initialized = true;
      final supported = await _speech.locales();
      if (!mounted) return;
      final desired = widget.hindi ? 'hi_in' : 'en_in';
      String? localeId;
      for (final lang in supported) {
        if (lang.localeId.toLowerCase().replaceAll('-', '_') == desired) {
          localeId = lang.localeId;
          break;
        }
      }
      await _speech.listen(
        onResult: (result) {
          if (!mounted) return;
          final words = result.recognizedWords.trim();
          if (words.isNotEmpty) widget.onText(words);
        },
        listenOptions: SpeechListenOptions(
          localeId: localeId,
          partialResults: true,
          cancelOnError: true,
          listenMode: ListenMode.confirmation,
        ),
      );
      if (mounted) setState(() => _listening = _speech.isListening);
    } catch (_) {
      _feedback(_failure);
      if (mounted) setState(() => _listening = false);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  void dispose() {
    if (_initialized) unawaited(_speech.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IconButton(
    onPressed: _starting ? null : _toggle,
    tooltip: _listening
        ? (widget.hindi ? 'सुनना बंद करें' : 'Stop listening')
        : (widget.hindi ? 'बोलकर खोजें' : 'Search by voice'),
    icon: Icon(_listening ? Icons.mic : Icons.mic_none_outlined),
    color: _listening ? const Color(0xFFB3261E) : const Color(0xFF176B46),
    iconSize: 21,
    padding: EdgeInsets.zero,
    constraints: const BoxConstraints(minWidth: 42, minHeight: 42),
  );
}
