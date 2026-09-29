import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

const endpoint = 'https://cserver.learnwithchampak.live/delivery/api/';
const storage = FlutterSecureStorage();
void main() => runApp(const PartnerApp());

class PartnerApp extends StatelessWidget {
  const PartnerApp({super.key});
  @override Widget build(BuildContext context) => MaterialApp(
    title: 'Delivery Partner',
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0879B7))),
    home: const JobsPage(),
  );
}

class JobsPage extends StatefulWidget {
  const JobsPage({super.key});
  @override State<JobsPage> createState() => _JobsPageState();
}
class _JobsPageState extends State<JobsPage> {
  final mobile=TextEditingController(), password=TextEditingController();
  String? token,error;
  bool busy=false;
  List<dynamic> jobs=[], notifications=[];
  @override void initState(){super.initState();restore();}
  @override void dispose(){mobile.dispose();password.dispose();super.dispose();}
  Future<Map<String,dynamic>> call(String action,{Map<String,Object?>? body}) async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:10);
    try {
      final request=await client.openUrl(body==null?'GET':'POST',Uri.parse('$endpoint?action=$action')).timeout(const Duration(seconds:12));
      if(token!=null)request.headers.set(HttpHeaders.authorizationHeader,'Bearer $token');
      if(body!=null){request.headers.contentType=ContentType.json;request.write(jsonEncode(body));}
      final response=await request.close().timeout(const Duration(seconds:15));
      final data=jsonDecode(await response.transform(utf8.decoder).join()) as Map<String,dynamic>;
      if(response.statusCode<200||response.statusCode>=300)throw Exception(data['error']??'Request failed');
      return data;
    } finally {client.close(force:true);}
  }
  Future<void> restore() async {token=await storage.read(key:'partner_token');if(token!=null)await refresh();else if(mounted)setState((){});}
  Future<void> run(Future<void> Function() task) async {
    setState((){busy=true;error=null;});
    try{await task();}catch(e){if(mounted)setState(()=>error=e.toString().replaceFirst('Exception: ',''));}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> login() => run(() async {
    final result=await call('partner-login',body:{'mobile':mobile.text.trim(),'password':password.text});
    token=result['token'] as String;await storage.write(key:'partner_token',value:token);password.clear();await fetchJobs();
  });
  Future<void> fetchJobs() async {
    final result=await call('partner');
    if(mounted)setState((){jobs=result['orders'] as List<dynamic>? ?? [];notifications=result['notifications'] as List<dynamic>? ?? [];});
  }
  Future<void> refresh()=>run(fetchJobs);
  Future<void> change(int id,String operation,{String? status,String? code})=>run(() async {
    await call('partner',body:{'operation':operation,'id':id,if(status!=null)'status':status,if(code!=null)'code':code});
    await fetchJobs();
  });
  Future<void> logout() async {await storage.delete(key:'partner_token');setState((){token=null;jobs=[];notifications=[];});}
  Future<void> confirm(int id) async {
    final controller=TextEditingController();
    try {
      final code=await showDialog<String>(context:context,builder:(dialogContext)=>AlertDialog(
        title:const Text('Customer handoff code'),
        content:TextField(controller:controller,keyboardType:TextInputType.number,maxLength:6,
          decoration:const InputDecoration(labelText:'Six-digit code')),
        actions:[TextButton(onPressed:()=>Navigator.pop(dialogContext),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(dialogContext,controller.text.trim()),child:const Text('Confirm'))]));
      if(code!=null)await change(id,'confirm',code:code);
    } finally {controller.dispose();}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Delivery Partner'),actions:[
      if(token!=null)IconButton(onPressed:busy?null:refresh,icon:const Icon(Icons.refresh)),
      if(token!=null)IconButton(onPressed:logout,icon:const Icon(Icons.logout))
    ]),
    body:busy?const Center(child:CircularProgressIndicator()):
      token==null?ListView(padding:const EdgeInsets.all(20),children:[
        TextField(controller:mobile,keyboardType:TextInputType.phone,decoration:const InputDecoration(labelText:'Mobile number')),
        TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Password')),
        const SizedBox(height:16),FilledButton(onPressed:login,child:const Text('Sign in')),
        if(error!=null)Text(error!,style:const TextStyle(color:Colors.red))
      ]):RefreshIndicator(onRefresh:refresh,child:ListView(padding:const EdgeInsets.all(16),children:[
        if(error!=null)Text(error!,style:const TextStyle(color:Colors.red)),
        if(jobs.isEmpty)const ListTile(title:Text('No assigned deliveries')),
        for(final raw in jobs) Builder(builder:(context){
          final o=raw as Map<String,dynamic>,id=(o['id'] as num).toInt(),status=o['status'] as String;
          final next={'assigned':'picked_up','picked_up':'out_for_delivery'}[status];
          return Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(
            crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text('Order ${o['external_order_id']}',style:Theme.of(context).textTheme.titleMedium),
              Text('Status: $status'),Text(o['customer_name'] as String),Text(o['address_text'] as String),
              if(o['location_lat']!=null&&o['location_lng']!=null) TextButton.icon(
                onPressed:() async {final uri=Uri.https('www.google.com','/maps/search/',{'api':'1','query':"${o['location_lat']},${o['location_lng']}"});await launchUrl(uri,mode:LaunchMode.externalApplication);},
                icon:const Icon(Icons.navigation_outlined),label:const Text('Navigate to customer')),
              if(next!=null)FilledButton(onPressed:()=>change(id,'status',status:next),
                child:Text('Mark ${next.replaceAll('_',' ')}')),
              if(status=='out_for_delivery')FilledButton(onPressed:()=>confirm(id),
                child:const Text('Enter customer code'))
            ])));
        }),
        if(notifications.isNotEmpty)Text('Updates',style:Theme.of(context).textTheme.titleLarge),
        for(final raw in notifications)ListTile(title:Text((raw as Map<String,dynamic>)['message'] as String? ?? 'Update'))
      ])),
  );
}
