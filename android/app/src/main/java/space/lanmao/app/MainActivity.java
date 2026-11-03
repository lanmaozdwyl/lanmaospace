package space.lanmao.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.ArrayList;
import org.json.JSONObject;

public class MainActivity extends Activity {
 private static final String HOME="https://lanmaospace.pages.dev/";
 private static final int PICK_FILE=41,SAVE_FILE=42;
 private WebView webView;
 private ValueCallback<Uri[]> fileCallback;
 private OutputStream output;
 private String saveId;
 private long expected,received;
 private JavaScriptReplyProxy reply;
 private boolean bridgeReady;
 private void note(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
 private boolean trusted(Uri u){return u!=null&&"https".equals(u.getScheme())&&"lanmaospace.pages.dev".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443);}
 private void external(Uri uri){
  String scheme=uri.getScheme();
  if(!"https".equals(scheme)&&!"mailto".equals(scheme)&&!"mqqwpa".equals(scheme)&&!"mqq".equals(scheme)){note("此链接不受支持。");return;}
  try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){note("没有可打开此链接的应用。");}
 }
 private boolean navigate(Uri uri){if(trusted(uri))return false;external(uri);return true;}
 @Override @SuppressLint("SetJavaScriptEnabled") protected void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setStatusBarColor(Color.rgb(251,251,253));
  getWindow().setNavigationBarColor(Color.rgb(251,251,253));
  // 保留系统状态栏与手势区，由系统处理真实边缘间距，避免 WebView 内容被遮挡。
  webView=new WebView(this);setContentView(webView);
  WebSettings settings=webView.getSettings();
  settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setMediaPlaybackRequiresUserGesture(true);
  settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);
  settings.setSupportZoom(false);
  bridgeReady=WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
  if(bridgeReady)WebViewCompat.addWebMessageListener(webView,"LanmaoFiles",Collections.singleton("https://lanmaospace.pages.dev"),(view,message,origin,mainFrame,proxy)->{
   if(!mainFrame||!trusted(origin)||!trusted(Uri.parse(view.getUrl()==null?"":view.getUrl())))return;
   receive(message.getData(),proxy);
  });
  webView.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return navigate(request.getUrl());}
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return navigate(Uri.parse(url));}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){if(saveId!=null)abortSave("页面已切换，保存已停止；请检查是否留下未完整文件。");}
   @Override public void onPageFinished(WebView view,String url){
    if(!bridgeReady||!trusted(Uri.parse(url)))return;
    try(InputStream in=getAssets().open("download.js");ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
     byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)bytes.write(b,0,n);
     view.evaluateJavascript(bytes.toString("UTF-8"),null);
    }catch(Exception e){note("导出组件加载失败，请使用系统浏览器。");}
   }
  });
  webView.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(!trusted(Uri.parse(view.getUrl()==null?"":view.getUrl()))){callback.onReceiveValue(null);return true;}
    if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
    try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_FILE);}
    catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;note("无法选择文件，请使用系统浏览器。");}
    return true;
   }
  });
  webView.setDownloadListener((url,agent,disposition,mime,length)->{
   if(url.startsWith("blob:")){
    if(bridgeReady&&trusted(Uri.parse(webView.getUrl()==null?"":webView.getUrl()))&&url.startsWith("blob:https://lanmaospace.pages.dev/"))
     webView.evaluateJavascript("window.LanmaoExport&&window.LanmaoExport.start("+JSONObject.quote(url)+")",null);
    else note("当前系统 WebView 不支持文件导出，请更新 WebView 或使用系统浏览器。");
   }else external(Uri.parse(url));
  });
  webView.loadUrl(HOME);
 }
 private void respond(String type){
  if(reply==null||saveId==null)return;
  try{JSONObject m=new JSONObject();m.put("type",type);m.put("id",saveId);reply.postMessage(m.toString());}catch(Exception ignored){}
 }
 private void receive(String raw,JavaScriptReplyProxy proxy){
  if(raw==null||raw.length()>100000)return;
  try{
   JSONObject m=new JSONObject(raw);String type=m.getString("type"),id=m.getString("id");
   if("begin".equals(type)){
    if(saveId!=null)return;
    long size=m.getLong("size");if(size<0||size>64L*1024*1024)return;
    saveId=id;expected=size;received=0;reply=proxy;
    String name=m.optString("name","lanmao-export.bin").replaceAll("[\\\\/\\p{Cntrl}]","_");
    if(name.length()>160)name=name.substring(0,160);
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("application/octet-stream");intent.putExtra(Intent.EXTRA_TITLE,name);
    startActivityForResult(intent,SAVE_FILE);return;
   }
   if(!id.equals(saveId))return;
   if("chunk".equals(type)){
    if(output==null||m.getLong("offset")!=received)throw new Exception();
    byte[] bytes=Base64.decode(m.getString("data"),Base64.NO_WRAP);
    if(bytes.length>65536||received+bytes.length>expected)throw new Exception();
    output.write(bytes);received+=bytes.length;respond("ack");
   }else if("end".equals(type)){
    if(output==null||received!=expected)throw new Exception();
    output.close();output=null;respond("done");clearSave();note("文件已保存到所选位置。");
   }else if("abort".equals(type))abortSave("保存已停止，请检查是否留下未完整文件。");
  }catch(Exception e){abortSave("保存失败，请检查是否留下未完整文件，并重新导出。");}
 }
 private void clearSave(){saveId=null;reply=null;expected=0;received=0;}
 private void abortSave(String message){try{if(output!=null)output.close();}catch(Exception ignored){}output=null;respond("error");clearSave();note(message);}
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK_FILE&&fileCallback!=null){
   Uri[] values=WebChromeClient.FileChooserParams.parseResult(result,data);
   ArrayList<Uri> safe=new ArrayList<>();if(values!=null)for(Uri u:values)if("content".equals(u.getScheme()))safe.add(u);
   fileCallback.onReceiveValue(safe.isEmpty()?null:safe.toArray(new Uri[0]));fileCallback=null;
  }else if(request==SAVE_FILE&&saveId!=null){
   if(result!=RESULT_OK||data==null||data.getData()==null){respond("cancel");clearSave();return;}
   try{output=getContentResolver().openOutputStream(data.getData());if(output==null)throw new Exception();respond("ready");}
   catch(Exception e){abortSave("无法写入所选位置，请重新选择。");}
  }
 }
 @Override public void onBackPressed(){
  webView.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}var p=document.getElementById('pomodoro-panel');if(p&&!p.hidden){document.getElementById('pomodoro-close').click();return true;}return false;})()",value->{if(!"true".equals(value)){if(webView.canGoBack())webView.goBack();else finish();}});
 }
 @Override protected void onDestroy(){
  if(fileCallback!=null)fileCallback.onReceiveValue(null);
  try{if(output!=null)output.close();}catch(Exception ignored){}
  if(webView!=null)webView.destroy();super.onDestroy();
 }
}
