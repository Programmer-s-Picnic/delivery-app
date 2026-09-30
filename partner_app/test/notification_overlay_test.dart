import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:delivery_partner/notification_overlay.dart';
void main() {
 testWidgets('Persistent notification preview opens history and marks selected record', (tester) async {
  Map<String,dynamic>? selected;
  notificationFeed.value=[{'id':42,'order_id':7,'message':'Delivery update','read_at':null}];
  notificationMark=(record) async {selected=record;};
  await tester.pumpWidget(MaterialApp(navigatorKey:notificationNavigator,builder:notificationOverlay,home:const Scaffold(body:Text('Original screen'))));
  expect(find.text('Original screen'),findsOneWidget);
  expect(find.text('Notifications · 1 unread'),findsOneWidget);
  await tester.tap(find.text('View all'));await tester.pumpAndSettle();
  await tester.tap(find.byTooltip('Mark as read'));await tester.pumpAndSettle();
  expect(selected?['id'],42);expect(selected?['order_id'],7);
  await tester.tap(find.text('Close'));await tester.pumpAndSettle();
  notificationFeed.value=[];notificationMark=null;
 });
}
