import 'package:flutter_test/flutter_test.dart';
import 'package:delivery_partner/app_update.dart';

void main() {
  test('only higher published Android version codes trigger update', () {
    expect(ApkUpdateChecker.isNewer('1.3.15+26', '1.3.14+25'), isTrue);
    expect(ApkUpdateChecker.isNewer('1.3.14+25', '1.3.14+25'), isFalse);
    expect(ApkUpdateChecker.isNewer('1.3.13+24', '1.3.14+25'), isFalse);
    expect(ApkUpdateChecker.isNewer('unknown', '1.3.14+25'), isFalse);
    expect(ApkUpdateChecker.isNewer('1.3.15', '1.3.14+25'), isFalse);
  });

  test('choose the correct APK for supported Android ABIs', () {
    expect(ApkUpdateChecker.customerApkForAbis(['arm64-v8a', 'armeabi-v7a']), 'easymani64.apk');
    expect(ApkUpdateChecker.customerApkForAbis(['armeabi-v7a']), 'easymani32.apk');
    expect(ApkUpdateChecker.customerApkForAbis(['x86_64']), isNull);
  });
}
