import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local, per-role notification alert settings. Notification history remains server-owned.
class MandiNoticeSettings {
  MandiNoticeSettings._();
  static final MandiNoticeSettings instance = MandiNoticeSettings._();

  static const categories = <String, String>{
    'order_new': 'New orders',
    'order_confirmed': 'Order accepted',
    'order_preparing': 'Order being prepared',
    'order_delivered': 'Order delivered',
    'order_cancelled': 'Order cancelled',
    'payment_pending': 'Payment or receipt submitted',
    'payment_verified': 'Payment confirmed',
    'payment_problem': 'Payment problem',
    'delivery_assigned': 'Assigned / reassigned',
    'delivery_picked_up': 'Delivery picked up',
    'delivery_out': 'Out for delivery',
    'handoff_code': 'Customer handoff code',
    'general': 'Other updates',
  };
  static const hindiNames = <String, String>{
    'order_new': 'नया ऑर्डर',
    'order_confirmed': 'ऑर्डर स्वीकार हुआ',
    'order_preparing': 'ऑर्डर तैयार हो रहा है',
    'order_delivered': 'ऑर्डर डिलीवर हुआ',
    'order_cancelled': 'ऑर्डर रद्द हुआ',
    'payment_pending': 'भुगतान / रसीद जमा हुई',
    'payment_verified': 'भुगतान की पुष्टि',
    'payment_problem': 'भुगतान में समस्या',
    'delivery_assigned': 'डिलीवरी की जिम्मेदारी',
    'delivery_picked_up': 'डिलीवरी उठाई गई',
    'delivery_out': 'डिलीवरी रास्ते में',
    'handoff_code': 'डिलीवरी का कोड',
    'general': 'अन्य सूचनाएँ',
  };
  static const sounds = <String, String>{
    'none': 'None', 'chime': 'Chime', 'bell': 'Bell',
    'ping': 'Ping', 'double': 'Double beep', 'alert': 'Alert',
  };

  String _role = 'customer';
  bool masterMute = false;
  final Map<String, Map<String, dynamic>> rules = {};
  bool _loaded = false;
  final AudioPlayer _player = AudioPlayer();
  final Map<String, Uint8List> _samples = {};

  Future<void> load(String role) async {
    if (_loaded && role == _role) return;
    _role = role;
    _loaded = false;
    rules.clear();
    Map<String, dynamic> stored = {};
    try {
      final preferences = await SharedPreferences.getInstance();
      final value = preferences.getString('easy-mandi-alert-prefs-v1-$_role');
      if (value != null) stored = Map<String, dynamic>.from(jsonDecode(value) as Map);
    } catch (_) { /* Local preferences are optional. */ }
    masterMute = stored['masterMute'] == true;
    final saved = stored['rules'] is Map ? Map<String, dynamic>.from(stored['rules'] as Map) : <String, dynamic>{};
    for (final category in categories.keys) {
      final old = saved[category] is Map ? Map<String, dynamic>.from(saved[category] as Map) : <String, dynamic>{};
      final sound = old['sound']?.toString() ?? 'none';
      rules[category] = {
        'mute': old['mute'] == true,
        'vibration': old['vibration'] == true,
        'sound': sounds.containsKey(sound) ? sound : 'none',
      };
    }
    _loaded = true;
  }

  Future<void> save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('easy-mandi-alert-prefs-v1-$_role',
          jsonEncode({'masterMute': masterMute, 'rules': rules}));
    } catch (_) { /* Alerts still work if local persistence is unavailable. */ }
  }

  static String classify(Map<dynamic, dynamic> notice) {
    final explicit = (notice['type'] ?? notice['notification_type'] ?? '').toString().toLowerCase();
    if (categories.containsKey(explicit)) return explicit;
    final m = (notice['message'] ?? '').toString().toLowerCase();
    if (RegExp(r'code|otp|handoff|verification pin').hasMatch(m)) return 'handoff_code';
    if (RegExp(r'payment|receipt|upi|cod|paid|refund').hasMatch(m)) {
      if (RegExp(r'failed|rejected|declined|problem|invalid').hasMatch(m)) return 'payment_problem';
      if (RegExp(r'verified|approved|confirmed|received|marked paid|successful').hasMatch(m)) return 'payment_verified';
      return 'payment_pending';
    }
    if (RegExp(r'reassigned|assigned|partner changed|delivery person changed').hasMatch(m)) return 'delivery_assigned';
    if (m.contains('out for delivery')) return 'delivery_out';
    if (RegExp(r'picked up|pickup').hasMatch(m)) return 'delivery_picked_up';
    if (RegExp(r'cancelled|canceled').hasMatch(m)) return 'order_cancelled';
    if (RegExp(r'delivered|completed').hasMatch(m)) return 'order_delivered';
    if (RegExp(r'preparing|being prepared|packed').hasMatch(m)) return 'order_preparing';
    if (RegExp(r'accepted|confirmed').hasMatch(m)) return 'order_confirmed';
    if (RegExp(r'placed|created|new order').hasMatch(m)) return 'order_new';
    return 'general';
  }

  /// Plays once when a fresh notification is observed during foreground polling.
  Future<void> notify(String role, List<Map<String, dynamic>> notices) async {
    if (notices.isEmpty) return;
    await load(role);
    if (masterMute) return;
    final alreadyPlayed = <String>{};
    for (final notice in notices) {
      if (notice['read_at'] != null) continue;
      final type = classify(notice);
      if (!alreadyPlayed.add(type)) continue;
      final setting = rules[type]!;
      if (setting['mute'] == true) continue;
      if (setting['vibration'] == true) {
        try { await HapticFeedback.vibrate(); } catch (_) {}
      }
      final sound = setting['sound'] as String;
      if (sound != 'none') await preview(sound);
    }
  }

  Future<void> preview(String sound) async {
    if (sound == 'none' || !sounds.containsKey(sound)) return;
    try {
      final bytes = _samples.putIfAbsent(sound, () => _wave(sound));
      await _player.stop();
      await _player.play(BytesSource(bytes));
    } catch (_) { /* User may have disabled sound at OS level. */ }
  }

  Uint8List _wave(String sound) {
    const sampleRate = 16000;
    final melody = switch (sound) {
      'bell' => <(int, int)>[(988, 150), (784, 160), (988, 190)],
      'ping' => <(int, int)>[(880, 170)],
      'double' => <(int, int)>[(620, 110), (0, 75), (620, 110)],
      'alert' => <(int, int)>[(740, 130), (0, 85), (740, 130), (0, 85), (740, 210)],
      _ => <(int, int)>[(659, 120), (880, 220)]
    };
    final count = melody.fold<int>(0, (sum, n) => sum + (sampleRate * n.$2 ~/ 1000));
    final buffer = ByteData(44 + count * 2);
    void tag(int at, String word) { for (var i = 0; i < word.length; i++) buffer.setUint8(at + i, word.codeUnitAt(i)); }
    tag(0, 'RIFF'); buffer.setUint32(4, 36 + count * 2, Endian.little); tag(8, 'WAVE');
    tag(12, 'fmt '); buffer.setUint32(16, 16, Endian.little);
    buffer.setUint16(20, 1, Endian.little); buffer.setUint16(22, 1, Endian.little);
    buffer.setUint32(24, sampleRate, Endian.little); buffer.setUint32(28, sampleRate * 2, Endian.little);
    buffer.setUint16(32, 2, Endian.little); buffer.setUint16(34, 16, Endian.little);
    tag(36, 'data'); buffer.setUint32(40, count * 2, Endian.little);
    var at = 0;
    for (final (frequency, ms) in melody) {
      final samples = sampleRate * ms ~/ 1000;
      for (var i = 0; i < samples; i++) {
        final envelope = math.min(1.0, i / 180.0) * math.min(1.0, (samples - i) / 290.0);
        final value = frequency == 0 ? 0 : (math.sin(2 * math.pi * frequency * i / sampleRate) * 6200 * envelope).round();
        buffer.setInt16(44 + at * 2, value, Endian.little);
        at++;
      }
    }
    return buffer.buffer.asUint8List();
  }
}

class MandiNotificationSettingsPage extends StatefulWidget {
  const MandiNotificationSettingsPage({super.key, required this.role, this.hindi = false});
  final String role;
  final bool hindi;
  @override
  State<MandiNotificationSettingsPage> createState() => _MandiNotificationSettingsPageState();
}

class _MandiNotificationSettingsPageState extends State<MandiNotificationSettingsPage> {
  final prefs = MandiNoticeSettings.instance;
  bool ready = false;

  @override
  void initState() {
    super.initState();
    prefs.load(widget.role).then((_) {
      if (mounted) setState(() => ready = true);
    });
  }

  String trn(String english, String hindi) => widget.hindi ? hindi : english;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(trn('Notification settings', 'सूचना सेटिंग्स'))),
    body: !ready
      ? const Center(child: CircularProgressIndicator())
      : ListView(padding: const EdgeInsets.all(12), children: [
        SwitchListTile(
          title: Text(trn('Mute all alert sounds and vibration', 'सभी ध्वनि और कंपन बंद करें')),
          subtitle: Text(trn('Your notification history remains visible.', 'सूचना इतिहास दिखाई देता रहेगा।')),
          value: prefs.masterMute,
          onChanged: (value) { setState(() => prefs.masterMute = value); prefs.save(); },
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(trn('Choose independent settings for each event. They apply while the app is open; system silent mode still takes priority.',
              'हर प्रकार की सूचना के लिए अलग सेटिंग चुनें। ऐप खुला होने पर काम करती हैं; फ़ोन का साइलेंट मोड प्राथमिक रहेगा।')),
        ),
        for (final event in MandiNoticeSettings.categories.entries)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  child: Text(widget.hindi ? MandiNoticeSettings.hindiNames[event.key]! : event.value,
                      style: Theme.of(context).textTheme.titleMedium)),
                SwitchListTile(
                  dense: true, title: Text(trn('Mute', 'म्यूट')),
                  value: prefs.rules[event.key]!['mute'] == true,
                  onChanged: (value) { setState(() => prefs.rules[event.key]!['mute'] = value); prefs.save(); },
                ),
                SwitchListTile(
                  dense: true, title: Text(trn('Vibrate', 'कंपन')),
                  value: prefs.rules[event.key]!['vibration'] == true,
                  onChanged: (value) { setState(() => prefs.rules[event.key]!['vibration'] = value); prefs.save(); },
                ),
                Row(children: [
                  const Icon(Icons.music_note_outlined),
                  const SizedBox(width: 8),
                  Expanded(child: DropdownButton<String>(
                    isExpanded: true, value: prefs.rules[event.key]!['sound'] as String,
                    items: MandiNoticeSettings.sounds.entries.map((s) =>
                      DropdownMenuItem(value: s.key, child: Text(s.value))).toList(),
                    onChanged: (sound) {
                      if (sound == null) return;
                      setState(() => prefs.rules[event.key]!['sound'] = sound);
                      prefs.save();
                      prefs.preview(sound);
                    },
                  )),
                  IconButton(
                    tooltip: trn('Preview sound', 'ध्वनि सुनें'),
                    icon: const Icon(Icons.play_circle_outline),
                    onPressed: () {
                      HapticFeedback.selectionClick();
                      prefs.preview(prefs.rules[event.key]!['sound'] as String);
                    },
                  ),
                ])
              ]),
            ),
          ),
      ]),
  );
}
