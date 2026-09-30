import 'package:flutter/material.dart';

final notificationNavigator = GlobalKey<NavigatorState>();
final notificationFeed = ValueNotifier<List<Map<String,dynamic>>>([]);
Future<void> Function(Map<String,dynamic>?)? notificationMark;
Widget notificationOverlay(BuildContext context, Widget? child) => Stack(children:[
  if(child!=null)child,
  Positioned(left:12,right:12,bottom:82,child:SafeArea(child:Material(
    elevation:8,borderRadius:BorderRadius.circular(14),color:const Color(0xFFE8F2FC),
    child:ValueListenableBuilder<List<Map<String,dynamic>>>(valueListenable:notificationFeed,builder:(context,items,_) {
      final unread=items.where((n)=>n['read_at']==null).length;
      final latest=items.isEmpty?'No notifications yet.':(items.first['message'] as String? ?? 'Update');
      return Padding(padding:const EdgeInsets.all(12),child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
        Row(children:[Expanded(child:Text('Notifications · $unread unread',style:const TextStyle(fontWeight:FontWeight.bold))),
          TextButton(onPressed:showNotificationModal,child:const Text('View all'))]),
        Text(latest,maxLines:2,overflow:TextOverflow.ellipsis)
      ]));
    }))))
]);
Future<void> showNotificationModal() async {
  final context=notificationNavigator.currentContext;
  if(context==null)return;
  await showDialog<void>(context:context,builder:(dialogContext)=>AlertDialog(
    title:const Text('Notifications'),
    content:SizedBox(width:520,height:350,child:ValueListenableBuilder<List<Map<String,dynamic>>>(
      valueListenable:notificationFeed,builder:(context,items,_)=>items.isEmpty?const Center(child:Text('No notifications yet.')):
        ListView(children:[for(final n in items)ListTile(
          leading:Icon(n['read_at']==null?Icons.notifications_active:Icons.notifications_none),
          title:Text(n['message'] as String? ?? 'Update'),subtitle:Text(n['created_at'] as String? ?? ''),
          trailing:n['read_at']==null?IconButton(tooltip:'Mark as read',icon:const Icon(Icons.done),onPressed:()async{
            try{await notificationMark?.call(n);}catch(_){if(dialogContext.mounted)ScaffoldMessenger.of(dialogContext).showSnackBar(const SnackBar(content:Text('Could not mark as read. Please retry.')));}
          }):null
        )])
    )),
    actions:[TextButton(onPressed:()async{try{await notificationMark?.call(null);}catch(_){if(dialogContext.mounted)ScaffoldMessenger.of(dialogContext).showSnackBar(const SnackBar(content:Text('Could not mark as read. Please retry.')));}},child:const Text('Mark all as read')),
      TextButton(onPressed:()=>Navigator.pop(dialogContext),child:const Text('Close'))]
  ));
}

