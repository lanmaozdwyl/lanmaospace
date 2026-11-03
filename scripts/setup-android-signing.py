# Windows 本机生成稳定签名，只上传到当前仓库的 GitHub Secrets，不打印密码/私钥。
import os,sys,base64,secrets,subprocess,ctypes,datetime,time
from pathlib import Path
from ctypes import wintypes
def run(args,**kwargs):
 for attempt in range(3):
  p=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,**kwargs)
  if p.returncode==0:return
  detail=p.stderr.decode('utf-8',errors='replace')[:350]
  if args[0]!='gh' or not any(x in detail.lower() for x in ['timeout','eof','connection','502','503']):break
  time.sleep(2)
 raise RuntimeError('步骤失败：'+' '.join(args[:3])+'；'+detail)
def main():
 if os.name!='nt':raise RuntimeError('此脚本使用 Windows 用户级加密，仅限 Windows。')
 run(['gh','auth','status'])
 from cryptography import x509
 from cryptography.x509.oid import NameOID
 from cryptography.hazmat.primitives import hashes,serialization
 from cryptography.hazmat.primitives.asymmetric import rsa
 from cryptography.hazmat.primitives.serialization import pkcs12
 root=Path(os.environ['LOCALAPPDATA'])/'LanmaoSpace'/'signing'
 repo=Path(__file__).resolve().parents[1]
 if root.resolve().is_relative_to(repo):raise RuntimeError('签名目录不能位于仓库内。')
 root.mkdir(parents=True,exist_ok=True)
 user=os.environ['USERNAME']
 run(['icacls',str(root),'/inheritance:r','/grant:r',user+':(OI)(CI)F','SYSTEM:(OI)(CI)F'])
 class Blob(ctypes.Structure):_fields_=[('size',wintypes.DWORD),('data',ctypes.POINTER(ctypes.c_ubyte))]
 def crypt(data,protect):
  buf=ctypes.create_string_buffer(data);src=Blob(len(data),ctypes.cast(buf,ctypes.POINTER(ctypes.c_ubyte)));dst=Blob()
  lib=ctypes.windll.crypt32
  ok=lib.CryptProtectData(ctypes.byref(src),None,None,None,None,0,ctypes.byref(dst)) if protect else lib.CryptUnprotectData(ctypes.byref(src),None,None,None,None,0,ctypes.byref(dst))
  if not ok:raise RuntimeError('Windows 加密操作失败。')
  try:return ctypes.string_at(dst.data,dst.size)
  finally:ctypes.windll.kernel32.LocalFree(dst.data)
 keyfile=root/'release-signing.p12';passfile=root/'password.dpapi'
 if keyfile.exists()!=passfile.exists():raise RuntimeError('签名备份不完整。请保留已有文件，不自动覆盖。')
 if not keyfile.exists():
  password=secrets.token_urlsafe(48).encode()
  key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
  subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Lanmao Space Android')])
  now=datetime.datetime.now(datetime.timezone.utc)
  cert=x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(days=1)).not_valid_after(now+datetime.timedelta(days=10000)).sign(key,hashes.SHA256())
  encrypted=pkcs12.serialize_key_and_certificates(b'lanmao',key,cert,None,serialization.BestAvailableEncryption(password))
  # 先准备两个临时文件，只有两者齐全才成为正式备份。
  (root/'new-password.dpapi').write_bytes(crypt(password,True));(root/'new-signing.p12').write_bytes(encrypted)
  (root/'new-password.dpapi').rename(passfile);(root/'new-signing.p12').rename(keyfile)
 password=crypt(passfile.read_bytes(),False)
 pkcs12.load_key_and_certificates(keyfile.read_bytes(),password)
 values={'ANDROID_KEYSTORE_BASE64':base64.b64encode(keyfile.read_bytes()),'ANDROID_STORE_PASSWORD':password,'ANDROID_KEY_PASSWORD':password,'ANDROID_KEY_ALIAS':b'lanmao'}
 for name,value in values.items():run(['gh','secret','set',name,'--repo','lanmaozdwyl/lanmaospace'],input=value)
 print('稳定签名已保存到本机受限目录，并上传到此仓库的 GitHub Secrets。')
 print('本机备份目录：'+str(root))
 print('DPAPI 密码备份绑定当前 Windows 用户；跨电脑迁移需先安全导出，不要删除此目录。')
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e));sys.exit(1)
