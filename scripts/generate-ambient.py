"""离线制作伴读音频；不参与网站构建。依赖 numpy、scipy 和 ffmpeg。
用法：python scripts/generate-ambient.py --originals <原始录音目录> --ffmpeg <ffmpeg路径>
原录音来源及许可见 AUDIO-SOURCES.md。不要把原始大文件提交到仓库。
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import numpy as np
from scipy.signal import butter, sosfiltfilt

parser = argparse.ArgumentParser()
parser.add_argument('--originals', type=pathlib.Path, required=True)
parser.add_argument('--ffmpeg', required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'audio'
out.mkdir(exist_ok=True)
rate = 32000
rng = np.random.default_rng(20261103)

def read(name):
    result = subprocess.run([args.ffmpeg, '-v', 'error', '-i', str(args.originals / name),
                             '-f', 'f32le', '-ac', '2', '-ar', str(rate), '-'],
                            capture_output=True, check=True)
    return np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2).astype(np.float64)

def soften(x, cutoff=6000):
    x = sosfiltfilt(butter(2, 65, 'highpass', fs=rate, output='sos'), x, axis=0)
    return sosfiltfilt(butter(3, cutoff, 'lowpass', fs=rate, output='sos'), x, axis=0)

def level(x, rms=.10):
    # 软压缩孤立的响亮水滴/鸟叫，使不同录音切换时响度更接近。
    x = x * rms / max(np.sqrt(np.mean(x*x)), 1e-8)
    return .45*np.tanh(x/.45)

def loop(x, start=0, length=46, overlap=3):
    # 头尾等幅交叉衔接，输出 length 秒；保留相位连续的环形接缝。
    n, k = int(length*rate), int(overlap*rate)
    offset = int(start*rate)
    indices = np.arange(offset, offset+n+k) % len(x)
    y = x[indices].copy()
    w = np.linspace(0, 1, k, endpoint=False)[:, None]
    y[:k] = y[-k:]*(1-w) + y[:k]*w
    return y[:n]

rain = read('rain.ogg')
tracks = {
    'stream': level(loop(soften(read('stream.ogg'), 6200), 18), .085),
    'rain-light': level(loop(soften(rain, 4200), 4), .065),
    'rain-medium': level(loop(soften(rain, 6000), 34), .09),
}
# 同一实录的不同片段叠加形成更密集的雨幕，不含合成雷声。
tracks['rain-heavy'] = level(loop(soften(rain, 5200), 8) +
                              .65*loop(soften(rain, 4200), 63), .115)
birds = level(loop(soften(read('birds.ogg'), 5800), 15), .055)
wind = level(loop(soften(read('wind.ogg'), 3500)), .035)
tracks['forest'] = level(birds + wind, .075)
tracks['waves'] = level(loop(soften(read('waves.mp3'), 5200), 16), .095)

# 自制木鱼：非整数倍衰减共振模态，柔化敲击起音；不是寺庙现场录音。
wood = np.zeros((48*rate, 2))
t = np.arange(int(.95*rate))/rate
for i, at in enumerate(np.arange(.2, 48, 2.4)):
    hit = sum(a*np.sin(2*np.pi*f*t)*np.exp(-t/tau) for f,a,tau in
              [(370, 1, .19), (589, .42, .105), (943, .15, .065), (1391, .035, .035)])
    hit *= (1-np.exp(-t/.004)) * (1+.025*rng.standard_normal())
    pos = int(at*rate)
    size = min(len(hit), len(wood)-pos)
    wood[pos:pos+size] += hit[:size, None] * np.array([1, .97])
tracks['wooden-fish'] = level(soften(wood, 2700), .045)

bell = soften(read('bell.wav'), 3000)
bell[:int(.025*rate)] *= np.linspace(0, 1, int(.025*rate))[:, None]
bell[-int(.5*rate):] *= np.linspace(1, 0, int(.5*rate))[:, None]
# 每 24 秒一次，保留空白，不把短钟声连续密集重复。
remote = np.zeros((48*rate, 2))
for at in [1, 25]:
    pos = at*rate
    remote[pos:pos+len(bell)] += bell
tracks['temple-bell'] = level(remote, .04)

report = []
for name, x in tracks.items():
    path = out/(name+'.mp3')
    subprocess.run([args.ffmpeg, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate),
                    '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k',
                    '-write_xing', '1', '-metadata', 'comment=Credits: AUDIO-SOURCES.md; softened loop by Lanmao Space',
                    str(path)], input=x.astype('<f4').tobytes(), check=True)
    decoded = subprocess.run([args.ffmpeg, '-v', 'error', '-i', str(path), '-f', 'f32le',
                              '-ac', '2', '-ar', str(rate), '-'], capture_output=True, check=True)
    y = np.frombuffer(decoded.stdout, dtype='<f4').reshape(-1, 2)
    assert np.isfinite(y).all() and np.max(np.abs(y)) < .85
    assert abs(len(y)/rate-len(x)/rate) < .02
    report.append(dict(id=name, file='audio/'+path.name, bytes=path.stat().st_size,
                       seconds=len(y)/rate, sampleRate=rate, channels=2,
                       peak=round(float(np.max(np.abs(y))), 6),
                       rms=round(float(np.sqrt(np.mean(y*y))), 6),
                       seamDelta=round(float(np.max(np.abs(y[0]-y[-1]))), 6),
                       sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
(out/'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, indent=2))
