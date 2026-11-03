# 伴读声音来源与修改说明

2026-11-03。发布的文件在 `audio/`；作者署名、作品链接、许可证链接也显示在首页“声音来源与许可”。这些声音为独立音频作品，许可不改变网站其他代码的许可。

| 本站声音 | 原作 / 作者 | 原作许可 | 下载版本与处理 |
| --- | --- | --- | --- |
| 山间溪流 | [stream2.wav — gluckose](https://freesound.org/people/gluckose/sounds/333987/) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Blanket stream.ogg，选段、柔化、软压缩、循环衔接 |
| 檐下小雨 / 窗外中雨 / 绵密大雨 | [rain ambience — alex36917](https://freesound.org/people/alex36917/sounds/524605/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Porrumentzio / Blanket 中间编辑；同一实录不同选段、滤波及响度，大雨叠加两段；未添加雷声 |
| 寺院远钟 | [Zen Buddhist Temple Bell — Mike Koenig](https://soundbible.com/1491-Zen-Buddhist-Temple-Bell.html) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | SoundBible WAV，柔化起音、滤波、响度调整，每 24 秒一次 |
| 缓缓海浪 | [Waves of Hawaii — florianreichelt](https://freesound.org/people/florianreichelt/sounds/450755/) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | noixer 分发版，选段、柔化、软压缩、循环衔接 |
| 林间鸟鸣（鸟） | [WoodThrushinMorningShawneeForestMay272012.wav — kvgarlic](https://freesound.org/people/kvgarlic/sounds/156826/) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Porrumentzio / Blanket 中间编辑；选段、柔化，混入轻风 |
| 林间鸟鸣（风） | [Wind blowing in a field in Texas, USA — felix.blume](https://freesound.org/people/felix.blume/sounds/217506/) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Porrumentzio / Blanket 中间编辑；选段、降低响度和高频，与林间鸟鸣混合；不是同一场地的同步录音 |
| 慢敲木鱼 | Lanmao Space 自制衰减共振合成音 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 非寺庙现场录音；每 2.4 秒一次；生成代码在 scripts/generate-ambient.py |

本次选段、混音和音频处理：Lanmao Space。修改版保留原作许可与署名；自制木鱼录音文件以 CC0 发布。不暗示原作者认可或支持本站。

下载版本的许可记录：[Blanket SOUNDS_LICENSING.md](https://github.com/rafaelmardojai/blanket/blob/master/SOUNDS_LICENSING.md)、[noixer README](https://github.com/abetusk/noixer/blob/main/README.md)。使用其合法再分发音频，不复制应用代码。原始音频不进入发布目录。

## 复现

`scripts/generate-ambient.py` 仅用于离线制作，需要 Python、NumPy、SciPy 和 ffmpeg；网站运行和 Cloudflare 构建无这些依赖。提供 `--originals` 和 `--ffmpeg` 参数，原文件名为 stream.ogg、rain.ogg、birds.ogg、wind.ogg、waves.mp3、bell.wav。实际下载链接可从上方项目的音频目录和 SoundBible 原作页取得。

输出：32 kHz 双声道 MP3、96 kbps，每段 46 或 48 秒；自然声约 3 秒衔接；`audio/manifest.json` 记录最终解码时长、峰值、均方根响度、接缝采样差、字节数及 SHA-256。编码后重新解码检查非有限值、削波和长度。听感仍需在用户耳机/手机上试听调整，数值检查不能替代主观判断。

## 播放边界

首次点击才下载选择的声音，未点击不下载音频。默认音量 40%，同时保留最多两段已解码缓存；页面离开时释放。定时使用真实截止时间，浏览器从后台恢复会再次核对。Android 系统可能暂停网页后台播放；不承诺锁屏持续播放，也不提供医疗或脑波功效。
