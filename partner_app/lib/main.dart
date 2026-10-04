import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

import 'notification_overlay.dart';

const endpoint = 'https://cserver.learnwithchampak.live/delivery/api/';
const storage = FlutterSecureStorage();

void main() => runApp(const PartnerApp());

class PartnerApp extends StatelessWidget {
  const PartnerApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        navigatorKey: notificationNavigator,
        builder: notificationOverlay,
        title: 'Delivery Partner',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0879B7)),
          scaffoldBackgroundColor: const Color(0xFFF6F9FC),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        home: const JobsPage(),
      );
}

class JobsPage extends StatefulWidget {
  const JobsPage({super.key});

  @override
  State<JobsPage> createState() => _JobsPageState();
}

class _JobsPageState extends State<JobsPage> {
  final mobile = TextEditingController();
  final password = TextEditingController();
  final search = TextEditingController();
  final Set<String> shownNotifications = {};
  Timer? timer;
  String? token;
  String? error;
  String filter = 'active';
  bool busy = false;
  bool polling = false;
  List<dynamic> jobs = [];
  List<dynamic> notifications = [];
  DateTime? lastUpdated;

  static const statusLabels = <String, String>{
    'assigned': 'Assigned',
    'picked_up': 'Picked up',
    'out_for_delivery': 'Out for delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };

  int get unread => notifications.where((n) => n['read_at'] == null).length;

  @override
  void initState() {
    super.initState();
    notificationMark =
        (n) => markNotifications(n == null ? null : (n['id'] as num).toInt());
    restore();
    timer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (token != null &&
          !busy &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        poll();
      }
    });
    search.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    mobile.dispose();
    password.dispose();
    search.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> call(
    String action, {
    Map<String, Object?>? body,
  }) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 10);
    try {
      final request = await client
          .openUrl(
            body == null ? 'GET' : 'POST',
            Uri.parse('$endpoint?action=$action'),
          )
          .timeout(const Duration(seconds: 12));
      if (token != null) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response =
          await request.close().timeout(const Duration(seconds: 15));
      final raw = await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 15));
      Map<String, dynamic> data;
      try {
        data = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        throw Exception('Unexpected server response. Please retry.');
      }
      if (response.statusCode == 401 && token != null) {
        await storage.delete(key: 'partner_token');
        token = null;
        notificationFeed.value = [];
        if (mounted) {
          setState(() {
            jobs = [];
            notifications = [];
          });
        }
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(data['error'] ?? 'Request failed');
      }
      return data;
    } on SocketException {
      throw Exception('Could not reach the delivery server. Check your connection.');
    } on TimeoutException {
      throw Exception('The delivery server took too long to respond.');
    } finally {
      client.close(force: true);
    }
  }

  Future<void> restore() async {
    token = await storage.read(key: 'partner_token');
    if (token != null) {
      await refresh();
    } else if (mounted) {
      setState(() {});
    }
  }

  Future<void> run(
    Future<void> Function() task, {
    String? success,
  }) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await task();
      if (success != null && mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(success)));
      }
    } catch (e) {
      if (mounted) {
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(error ?? 'Request failed'),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> login() => run(() async {
        final enteredMobile = mobile.text.trim();
        if (!RegExp(r'^[6-9][0-9]{9}$').hasMatch(enteredMobile)) {
          throw Exception('Enter a valid 10-digit Indian mobile number.');
        }
        if (password.text.isEmpty) throw Exception('Enter your password.');
        final result = await call(
          'partner-login',
          body: {'mobile': enteredMobile, 'password': password.text},
        );
        token = result['token'] as String;
        await storage.write(key: 'partner_token', value: token);
        password.clear();
        await fetchJobs();
      }, success: 'Signed in successfully.');

  Future<void> fetchJobs() async {
    final result = await call('partner');
    final incoming = result['notifications'] as List<dynamic>? ?? [];
    if (mounted) {
      final fresh = incoming
          .where((n) =>
              n['read_at'] == null &&
              !shownNotifications.contains(n['id'].toString()))
          .toList();
      for (final n in incoming) {
        shownNotifications.add(n['id'].toString());
      }
      if (fresh.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 12),
            content: Text(
              '${fresh.length} new notification(s): ${fresh.first['message']}',
            ),
          ),
        );
      }
      notificationFeed.value = incoming
          .map((n) => Map<String, dynamic>.from(n as Map))
          .toList();
      setState(() {
        jobs = result['orders'] as List<dynamic>? ?? [];
        notifications = incoming;
        lastUpdated = DateTime.now();
      });
    }
  }

  Future<void> poll() async {
    if (polling) return;
    polling = true;
    try {
      await fetchJobs();
    } catch (_) {
      // Background refresh retries automatically.
    } finally {
      polling = false;
    }
  }

  Future<void> markNotifications([int? id]) => run(() async {
        await call(
          'partner',
          body: {'operation': 'read-notifications', 'id': id},
        );
        await fetchJobs();
      });

  Future<void> refresh() => run(fetchJobs);

  Future<void> change(
    int id,
    String operation, {
    String? status,
    String? code,
    required String success,
  }) =>
      run(() async {
        await call(
          'partner',
          body: {
            'operation': operation,
            'id': id,
            if (status != null) 'status': status,
            if (code != null) 'code': code,
          },
        );
        await fetchJobs();
      }, success: success);

  Future<void> logout() async {
    await storage.delete(key: 'partner_token');
    if (!mounted) return;
    setState(() {
      token = null;
      notificationFeed.value = [];
      jobs = [];
      notifications = [];
      shownNotifications.clear();
      search.clear();
      filter = 'active';
      error = null;
    });
  }

  bool isFinished(String status) =>
      status == 'delivered' || status == 'cancelled';

  Color stageColor(String status) {
    switch (status) {
      case 'assigned':
        return const Color(0xFF1565C0);
      case 'picked_up':
        return const Color(0xFF6A1B9A);
      case 'out_for_delivery':
        return const Color(0xFFEF6C00);
      case 'delivered':
        return const Color(0xFF2E7D32);
      case 'cancelled':
        return const Color(0xFFC62828);
      default:
        return const Color(0xFF546E7A);
    }
  }

  String stageLabel(String status) =>
      statusLabels[status] ?? status.replaceAll('_', ' ');

  List<Map<String, dynamic>> itemsFor(Map<String, dynamic> order) {
    final raw = order['items_json'];
    if (raw is! String || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  List<Map<String, dynamic>> get visibleJobs {
    final q = search.text.trim().toLowerCase();
    return jobs
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((o) {
      final status = '${o['status'] ?? ''}';
      final matchesFilter = filter == 'all' ||
          (filter == 'active' && !isFinished(status)) ||
          filter == status;
      if (!matchesFilter) return false;
      if (q.isEmpty) return true;
      return [
        o['external_order_id'],
        o['customer_name'],
        o['customer_mobile'],
        o['address_text'],
        o['source_app'],
      ].join(' ').toLowerCase().contains(q);
    }).toList();
  }

  Map<String, int> get counts {
    final result = <String, int>{
      'active': 0,
      for (final key in statusLabels.keys) key: 0,
    };
    for (final raw in jobs.whereType<Map>()) {
      final status = '${raw['status'] ?? ''}';
      result[status] = (result[status] ?? 0) + 1;
      if (!isFinished(status)) result['active'] = result['active']! + 1;
    }
    return result;
  }

  Future<void> callCustomer(Map<String, dynamic> order) async {
    final mobileNumber = '${order['customer_mobile'] ?? ''}';
    if (!RegExp(r'^[6-9][0-9]{9}$').hasMatch(mobileNumber)) {
      throw Exception('Customer mobile number is unavailable.');
    }
    final opened = await launchUrl(Uri(scheme: 'tel', path: '+91$mobileNumber'));
    if (!opened) throw Exception('Could not open the phone dialer.');
  }

  Future<void> navigate(Map<String, dynamic> order) async {
    final lat = order['location_lat'];
    final lng = order['location_lng'];
    if (lat == null || lng == null) {
      throw Exception('No customer map pin is available.');
    }
    final uri = Uri.https(
      'www.google.com',
      '/maps/search/',
      {'api': '1', 'query': '$lat,$lng'},
    );
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) throw Exception('Could not open maps.');
  }

  Future<void> confirmHandoff(Map<String, dynamic> order) async {
    final controller = TextEditingController();
    try {
      final code = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Complete ${order['external_order_id']}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Ask the customer for the six-digit handoff code only after the order is physically handed over.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                decoration:
                    const InputDecoration(labelText: 'Six-digit customer code'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final value = controller.text.trim();
                if (RegExp(r'^[0-9]{6}$').hasMatch(value)) {
                  Navigator.pop(dialogContext, value);
                }
              },
              child: const Text('Confirm delivery'),
            ),
          ],
        ),
      );
      if (code == null) return;
      await change(
        (order['id'] as num).toInt(),
        'confirm',
        code: code,
        success: order['payment_method'] == 'cod'
            ? 'Delivery confirmed. COD marked paid and notifications sent.'
            : 'Delivery confirmed. Notifications sent.',
      );
    } finally {
      controller.dispose();
    }
  }

  void showHelp() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('How to use Delivery Partner'),
        content: const SingleChildScrollView(
          child: Text(
            '1. Open an Assigned job and review customer, address, basket and payment status.\n\n'
            '2. Use Call customer or Navigate while the delivery is still active.\n\n'
            '3. Mark Picked up after collecting the parcel.\n\n'
            '4. Mark Out for delivery when leaving for the customer.\n\n'
            '5. For UPI orders, handoff is blocked until admin verifies payment. For COD, collect the displayed amount at handoff.\n\n'
            '6. After physically handing over the order, enter the customer\'s six-digit code. A correct code completes the delivery; COD is marked paid automatically.\n\n'
            '7. Calling is disabled after delivery or cancellation. Pull down or use Refresh to update the jobs list.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget statusPill(String status) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: stageColor(status).withValues(alpha: .12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: stageColor(status).withValues(alpha: .35)),
        ),
        child: Text(
          stageLabel(status),
          style: TextStyle(
            color: stageColor(status),
            fontWeight: FontWeight.w800,
          ),
        ),
      );

  Widget legend() => Wrap(
        spacing: 8,
        runSpacing: 6,
        children: [
          for (final entry in statusLabels.entries)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: stageColor(entry.key),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(entry.value),
              ],
            ),
        ],
      );

  Widget paymentPanel(Map<String, dynamic> order) {
    final method = order['payment_method']?.toString();
    final status = order['payment_status']?.toString() ?? 'pending';
    final total = order['payment_total'];
    if (method == null) {
      return const Card(
        color: Color(0xFFF3F4F6),
        child: Padding(
          padding: EdgeInsets.all(12),
          child: Text(
            'Manual delivery record · no payment amount is managed by the delivery platform.',
          ),
        ),
      );
    }
    final upiBlocked = method == 'upi' && status != 'verified';
    final paid = method == 'upi' ? status == 'verified' : status == 'paid';
    final color = upiBlocked
        ? const Color(0xFFEF6C00)
        : paid
            ? const Color(0xFF2E7D32)
            : const Color(0xFF1565C0);
    final amount = total == null ? '' : ' · ₹${NumberFormatHelper.two(total)}';
    String note;
    if (method == 'upi') {
      note = status == 'verified'
          ? 'UPI payment verified by admin. Handoff may proceed.'
          : 'UPI is not verified. Do not hand over the order yet.';
    } else {
      note = status == 'paid'
          ? 'Cash on Delivery has been marked paid.'
          : 'Collect the COD amount at handoff. A correct customer code will mark it paid.';
    }
    return Card(
      color: color.withValues(alpha: .08),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Payment: ${method.toUpperCase()} · ${status.replaceAll('_', ' ')}$amount',
              style: TextStyle(fontWeight: FontWeight.w800, color: color),
            ),
            const SizedBox(height: 4),
            Text(note),
          ],
        ),
      ),
    );
  }

  Widget jobCard(Map<String, dynamic> order) {
    final id = (order['id'] as num).toInt();
    final status = '${order['status'] ?? ''}';
    final finished = isFinished(status);
    final next = const {
      'assigned': 'picked_up',
      'picked_up': 'out_for_delivery',
    }[status];
    final upiBlocked =
        order['payment_method'] == 'upi' && order['payment_status'] != 'verified';
    final items = itemsFor(order);
    final canCall = !finished &&
        RegExp(r'^[6-9][0-9]{9}$')
            .hasMatch('${order['customer_mobile'] ?? ''}');
    final hasLocation =
        order['location_lat'] != null && order['location_lng'] != null;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: stageColor(status).withValues(alpha: .45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: stageColor(status).withValues(alpha: .06),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order ${order['external_order_id']}',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        order['source_app'] == 'manual'
                            ? 'Manual delivery'
                            : 'Easy Mandi order',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                statusPill(status),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${order['customer_name'] ?? 'Customer'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text('${order['address_text'] ?? ''}'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: canCall
                          ? () => run(() => callCustomer(order))
                          : null,
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Call customer'),
                    ),
                    OutlinedButton.icon(
                      onPressed: hasLocation
                          ? () => run(() => navigate(order))
                          : null,
                      icon: const Icon(Icons.navigation_outlined),
                      label: const Text('Navigate'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(
                            text:
                                '${order['customer_name']}\n${order['address_text']}\n+91 ${order['customer_mobile']}',
                          ),
                        );
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Customer address copied.'),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy_outlined),
                      label: const Text('Copy address'),
                    ),
                  ],
                ),
                if (finished)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      status == 'delivered'
                          ? 'Delivery completed. Customer calling and delivery actions are disabled.'
                          : 'Delivery cancelled. Customer calling and delivery actions are disabled.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                const SizedBox(height: 8),
                paymentPanel(order),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: const EdgeInsets.only(bottom: 10),
                  title: Text(
                    'Full order details · ${items.length} item${items.length == 1 ? '' : 's'}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  children: [
                    if (items.isEmpty)
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text('No basket items were stored.'),
                      ),
                    for (final item in items)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.shopping_basket_outlined),
                        title: Text(
                          '${item['name'] ?? item['product_name'] ?? 'Item'}',
                        ),
                        subtitle: Text('${item['unit'] ?? ''}'),
                        trailing: Text('× ${item['quantity'] ?? ''}'),
                      ),
                    const Divider(),
                    _detailLine('Customer mobile',
                        '+91 ${order['customer_mobile'] ?? ''}'),
                    _detailLine('Delivery ID', '$id'),
                    _detailLine('Created', '${order['created_at'] ?? ''}'),
                    if (order['updated_at'] != null)
                      _detailLine('Last server update',
                          '${order['updated_at']}'),
                    if (order['source_status'] != null)
                      _detailLine(
                          'Easy Mandi order status', '${order['source_status']}'),
                    if (order['payment_verified_at'] != null)
                      _detailLine('Payment verified/paid',
                          '${order['payment_verified_at']}'),
                  ],
                ),
                if (next != null)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: busy
                          ? null
                          : () => change(
                                id,
                                'status',
                                status: next,
                                success:
                                    'Order ${order['external_order_id']} marked ${stageLabel(next)}.',
                              ),
                      icon: Icon(next == 'picked_up'
                          ? Icons.inventory_2_outlined
                          : Icons.local_shipping_outlined),
                      label: Text('Mark ${stageLabel(next)}'),
                    ),
                  ),
                if (status == 'out_for_delivery') ...[
                  if (upiBlocked)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Handoff locked: wait for Easy Mandi admin to verify the UPI receipt.',
                        style: TextStyle(
                          color: Color(0xFFEF6C00),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed:
                          busy || upiBlocked ? null : () => confirmHandoff(order),
                      icon: const Icon(Icons.password_outlined),
                      label: Text(
                        upiBlocked
                            ? 'UPI verification required'
                            : 'Enter customer code & complete delivery',
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailLine(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 150,
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );

  Widget dashboard() {
    final data = counts;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _countChip('Active', 'active', data['active'] ?? 0),
            _countChip('Assigned', 'assigned', data['assigned'] ?? 0),
            _countChip('Picked up', 'picked_up', data['picked_up'] ?? 0),
            _countChip('Out for delivery', 'out_for_delivery',
                data['out_for_delivery'] ?? 0),
            _countChip('Delivered', 'delivered', data['delivered'] ?? 0),
          ],
        ),
        const SizedBox(height: 10),
        legend(),
        const SizedBox(height: 12),
        TextField(
          controller: search,
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            labelText: 'Search order, customer, mobile or address',
          ),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          key: ValueKey(filter),
          initialValue: filter,
          decoration: const InputDecoration(labelText: 'Filter deliveries'),
          items: const [
            DropdownMenuItem(value: 'active', child: Text('Active deliveries')),
            DropdownMenuItem(value: 'all', child: Text('All deliveries')),
            DropdownMenuItem(value: 'assigned', child: Text('Assigned')),
            DropdownMenuItem(value: 'picked_up', child: Text('Picked up')),
            DropdownMenuItem(
                value: 'out_for_delivery', child: Text('Out for delivery')),
            DropdownMenuItem(value: 'delivered', child: Text('Delivered')),
            DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
          ],
          onChanged: (value) => setState(() => filter = value ?? 'active'),
        ),
        const SizedBox(height: 8),
        Text(
          '${visibleJobs.length} of ${jobs.length} jobs shown'
          '${lastUpdated == null ? '' : ' · refreshed ${TimeOfDay.fromDateTime(lastUpdated!).format(context)}'}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _countChip(String label, String value, int count) => ActionChip(
        avatar: CircleAvatar(
          radius: 12,
          child: Text('$count', style: const TextStyle(fontSize: 11)),
        ),
        label: Text(label),
        onPressed: () => setState(() => filter = value),
      );

  Widget loginView() => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 28),
          Icon(
            Icons.local_shipping_outlined,
            size: 72,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 12),
          Text(
            'Delivery Partner',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: mobile,
            keyboardType: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10),
            ],
            decoration: const InputDecoration(
              labelText: 'Mobile number',
              prefixText: '+91 ',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: password,
            obscureText: true,
            onSubmitted: (_) => login(),
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: busy ? null : login,
            icon: const Icon(Icons.login),
            label: const Text('Sign in'),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: showHelp,
            icon: const Icon(Icons.help_outline),
            label: const Text('How to use the delivery app'),
          ),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final shown = visibleJobs;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          token == null ? 'Delivery Partner' : 'Delivery Partner · $unread unread',
        ),
        actions: [
          IconButton(
            tooltip: 'How to use',
            onPressed: showHelp,
            icon: const Icon(Icons.help_outline),
          ),
          if (token != null)
            IconButton(
              tooltip: 'Refresh jobs',
              onPressed: busy ? null : refresh,
              icon: const Icon(Icons.refresh),
            ),
          if (token != null)
            IconButton(
              tooltip: 'Sign out',
              onPressed: busy ? null : logout,
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: token == null
          ? loginView()
          : Column(
              children: [
                if (busy) const LinearProgressIndicator(minHeight: 2),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: refresh,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 130),
                      children: [
                        dashboard(),
                        if (error != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            error!,
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error),
                          ),
                        ],
                        const SizedBox(height: 14),
                        if (shown.isEmpty)
                          const Card(
                            child: Padding(
                              padding: EdgeInsets.all(24),
                              child: Text(
                                'No deliveries match this filter. Pull down or choose Refresh to check for new assignments.',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        for (final order in shown) jobCard(order),
                        if (notifications.isNotEmpty) ...[
                          const Divider(),
                          Text(
                            'Recent notifications',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          TextButton.icon(
                            onPressed: busy ? null : () => markNotifications(),
                            icon: const Icon(Icons.done_all),
                            label: const Text('Mark all as read'),
                          ),
                          for (final raw in notifications.take(10))
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                raw['read_at'] == null
                                    ? Icons.notifications_active
                                    : Icons.notifications_none,
                              ),
                              onTap: raw['read_at'] == null
                                  ? () => markNotifications(
                                      (raw['id'] as num).toInt())
                                  : null,
                              title:
                                  Text(raw['message'] as String? ?? 'Update'),
                              subtitle:
                                  Text(raw['created_at'] as String? ?? ''),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class NumberFormatHelper {
  static String two(Object? value) {
    if (value is num) return value.toStringAsFixed(2);
    return (num.tryParse('${value ?? ''}') ?? 0).toStringAsFixed(2);
  }
}
