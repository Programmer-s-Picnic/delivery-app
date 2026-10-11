import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Update availability is based on *published* APK versions, not source commits.
class ApkUpdate {
  const ApkUpdate({required this.version, required this.url, required this.installedVersion});
  final String version;
  final Uri url;
  final String installedVersion;
}

class ApkUpdateChecker {
  static const _manifest = 'https://easymandi.in/apk/build.json';

  /// Android can install an update only if its versionCode increases.
  static int? versionCode(String value) {
    final match = RegExp(r'^[0-9]+(?:\.[0-9]+)*\+([0-9]+)$').firstMatch(value);
    return match == null ? null : int.tryParse(match.group(1)!);
  }

  static bool isNewer(String published, String installed) {
    final newCode = versionCode(published);
    final oldCode = versionCode(installed);
    return newCode != null && oldCode != null && newCode > oldCode;
  }

  static String? customerApkForAbis(List<String> supportedAbis) {
    if (supportedAbis.contains('arm64-v8a')) return 'easymani64.apk';
    if (supportedAbis.contains('armeabi-v7a')) return 'easymani32.apk';
    return null;
  }

  static Future<ApkUpdate?> check(String role) async {
    if (!Platform.isAndroid) return null;
    if (role != 'customer' && role != 'delivery') {
      throw ArgumentError.value(role, 'role');
    }
    final installed = await PackageInfo.fromPlatform();
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final uri = Uri.parse(_manifest).replace(
        queryParameters: {'checkedAt': DateTime.now().millisecondsSinceEpoch.toString()},
      );
      final request = await client.getUrl(uri).timeout(const Duration(seconds: 10));
      request.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');
      final response = await request.close().timeout(const Duration(seconds: 10));
      if (response.statusCode != HttpStatus.ok ||
          response.contentLength > 8192) {
        throw const FormatException('Release metadata unavailable');
      }
      final body = await response.transform(utf8.decoder).join().timeout(
        const Duration(seconds: 10),
      );
      if (body.length > 8192) throw const FormatException('Invalid release metadata');
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic> || decoded['domain'] != 'easymandi.in') {
        throw const FormatException('Invalid release metadata');
      }
      final published = decoded[role];
      if (published is! Map<String, dynamic> || published['version'] is! String) {
        throw const FormatException('Missing app version');
      }
      final latest = published['version'] as String;
      final local = installed.version + '+' + installed.buildNumber;
      if (!isNewer(latest, local)) return null;

      String apk;
      if (role == 'customer') {
        final abis = (await DeviceInfoPlugin().androidInfo).supportedAbis;
        final compatible = customerApkForAbis(abis);
        if (compatible == null) return null;
        apk = compatible;
      } else {
        apk = 'easymanideliverypartner.apk';
      }
      final paths = decoded['paths'];
      if (paths is! List || !paths.contains('/apk/' + apk)) {
        throw const FormatException('APK is not listed in the release manifest');
      }
      return ApkUpdate(
        version: latest,
        installedVersion: local,
        url: Uri.parse('https://easymandi.in/apk/' + apk),
      );
    } finally {
      client.close(force: true);
    }
  }
}
