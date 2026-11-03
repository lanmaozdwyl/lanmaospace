/**
 * Lanmao Space — WeChat Read Style Immersive E-Reader System
 * 蓝昴空间 · 微信读书风格在线伴读器
 * 
 * 核心特性：
 * 1. 纯前端内存解析（FileReader & CSS Multi-column），0 字节上传云端，完全不消耗服务器或数据库配额。
 * 2. 微信读书同款排版美学与交互：左右分页平滑滑动、横向手势、三区点击感应、自适应列高。
 * 3. 基础个性化设置：四色主题（羊皮纸/护眼绿/纯白/极夜黑）、无级字号缩放（A-/A+）、三大字体、翻页/连续滚动切换。
 * 4. 内置经典伴读名著（《小王子》、《百年孤独》、《心流与学术生产力指南》）与本地书籍秒级导入（TXT/MD/EPUB）。
 * 5. 沉浸伴读伴侣：自托管自然录音及柔和木鱼与 25 分钟学术专注番茄钟。
 */

(function () {
    'use strict';

    // ===== 1. 内置伴读著作典藏 (零网络请求，无额度消耗) =====
    const BUILTIN_BOOKS = {
        prince: {
            id: 'prince',
            title: '小王子 (The Little Prince)',
            author: '安托万·德·圣-埃克苏佩里',
            coverEmoji: '📙',
            description: '圣埃克苏佩里 · 治愈灵魂的经典哲理名著',
            chapters: [
                {
                    title: '献给莱昂·韦尔特',
                    content: [
                        '请孩子们原谅我把这本书献给一个大人。我有一条正当的理由：这个大人是我在世界上最好的朋友。',
                        '我还有另一个理由：这个大人什么都懂，即使是写给孩子们的书他也懂。我的第三个理由是：这个大人住在法国，他在那里又挨饿又受冻。他真需要得到安慰。',
                        '如果这些理由还不够，那么我就把这本书献给曾经做过孩子的那个大人。所有的大人都曾经是孩子（可惜只有很少的大人记得这一点）。',
                        '因此，我把我的献词修改为：献给小时候的莱昂·韦尔特。'
                    ]
                },
                {
                    title: '第一章：蟒蛇吞大象与六岁时的画',
                    content: [
                        '当我还是六岁的时候，在一本书中看到了一副精彩的插画，那本书是关于原始森林的，名字叫《真实的故事》。',
                        '画里画的是一条巨蟒正在吞食一只野兽。书里写道：“巨蟒把猎物不嚼就整个儿吞下去。之后，它们就动弹不得了，要沉睡整整六个月来进行消化。”',
                        '于是我开动脑筋，思考丛林里的神奇奇遇。接着，我用彩色铅笔成功画出了我的第一号作品。它不是一顶帽子，而是一条大蟒蛇正在消化一头大象。',
                        '我把我的杰作拿给大人们看，问他们我的画是不是让他们感到害怕。他们却回答说：“一顶帽子有什么好怕的？”',
                        '大人们总是需要解释。于是我画了第二号作品：我把大象画在蟒蛇的肚子里，以便大人能看懂。他们总是需要解释。',
                        '大人们劝我把这些大蟒蛇的画放在一边，不管是从外部看还是从内部看，不如把心思放在地理、历史、算术和语法上。就这样，我在六岁那年放弃了成为画家的伟大前途。',
                        '大人们自己从来都不懂任何事情，而总是要孩子们一遍又一遍地给他们解释，这真叫人厌烦。'
                    ]
                },
                {
                    title: '第二章：撒哈拉沙漠的相遇',
                    content: [
                        '就这样，我孤独地生活着，没有一个真正谈得来的人，直到六年前我的飞机在撒哈拉沙漠出了故障。发动机里有什么东西摔碎了。',
                        '因为我既没有机械师，也没有乘客，我只好一个人试着去完成这项十分困难的修理工作。这对我来说是生死关头：我带的水勉强只够喝八天。',
                        '第一天晚上，我在远离人间烟火一千英里的沙漠上睡着了。我比大海中遇难漂流在木筏上的人还要孤单。',
                        '黎明时分，当一个奇怪的小声音唤醒我时，你们可以想象我是多么惊讶。那声音说：',
                        '“请……请给我画一只羊！”',
                        '“啊？”',
                        '“请给我画一只羊……”',
                        '我一下子跳了起来，就像被雷打中了一样。我使劲揉了揉眼睛，仔细看了又看。我看见一个小小的、极不寻常的人，正用严肃的目光审视着我。',
                        '他既不像迷了路的孩子，也不像因为饥饿、干渴或恐惧而快要死去的孩子。在茫茫沙漠的深处，他看起来没有一点迷路孩子的慌乱。',
                        '当我在震惊中终于找回说话的能力时，我问他：“你在……你在这里干什么？”',
                        '他只是轻轻地、极认真地重复道：“请给我画一只羊……”'
                    ]
                },
                {
                    title: '第三章：另一个星球与金色头发的少年',
                    content: [
                        '我花了很长时间才明白他是从哪里来的。小王子向我提了许多问题，却似乎从不听我的问题。是他偶然吐露的只言片语，才一点一点把一切揭示给我。',
                        '比如，当他第一次看见我的飞机时，他问我：“这个东西是什么？”',
                        '“这不是个东西，它会飞。这是一架飞机，是我的飞机。”我很自豪地告诉他我能在天上飞。',
                        '这时他惊呼起来：“什么！你是从天上掉下来的？”',
                        '“是的，”我谦虚地说。',
                        '“啊！真有趣……”小王子发出清脆的笑声，这使我非常恼火。我希望别人严肃地对待我的不幸。',
                        '接着他又说：“这么说，你也是从另一个星球来的？你是哪个星球的？”',
                        '他低头端详着我画给他的木箱子，沉思了很久。然后从口袋里掏出我的小羊，全神贯注地看着他的宝贝。'
                    ]
                },
                {
                    title: '第四章：B-612小行星与大人们的数字',
                    content: [
                        '我有充分的理由相信，小王子来自的那个星球就是小行星 B-612。',
                        '这颗小行星只在1909年被一位土耳其天文学家用望远镜看见过一次。当时他在国际天文学大会上做了一次精彩的证实报告，但因为他穿的是土耳其传统服装，没有一个人相信他。大人们就是这个样子。',
                        '幸运的是，土耳其后来出了一位独裁者，下令国民一律改穿欧式西服，违者处以死刑。1920年，那位天文学家穿上一套极其讲究的西装，重新做了报告，这一次所有人都同意他的看法。',
                        '我向你们讲关于 B-612 的细节，把它的编号告诉你们，完全是因为大人们的缘故。大人们喜欢数字。',
                        '当你对大人们谈起一个新朋友时，他们从来不问最本质的问题。他们从来不问：“他的声音好听吗？他喜欢玩什么游戏？他收集蝴蝶吗？”',
                        '相反，他们会问：“他多大年纪？有几个兄弟？体重多少？他父亲挣多少钱？”只有通过这些数字，他们才觉得自己了解了他。',
                        '如果你对大人们说：“我看到一幢漂亮的粉红色砖房，窗台上摆着天竺葵，屋顶上有鸽子……”他们根本想象不出这幢房子有多美。',
                        '你必须对他们说：“我看到了一幢价值十万法郎的房子。”这时他们才会惊叹：“哇，多漂亮啊！”'
                    ]
                },
                {
                    title: '第五章：猴面包树的危险与每日清晨的梳理',
                    content: [
                        '每天我都会了解一些关于他的星球、关于离开和旅程的事。这些都是在思索中一点一滴流露出来的。',
                        '第三天，我明白了猴面包树的悲剧。',
                        '这一次也是多亏了小羊。小王子突然关切地问我：“羊真的吃灌木吗？”',
                        '“是的，这很常见。”',
                        '“啊！我真高兴！”小王子接着说，“那它们也吃猴面包树吧？”',
                        '我向小王子指出，猴面包树可不是灌木，而是像教堂一样高大的大树；即使他带去一群大象，也吃不下一棵猴面包树。',
                        '小王子笑着说：“那得把大象一头一头叠起来放！”',
                        '但他聪明地补充道：“猴面包树在长大之前，也是从小小的一棵开始生长的呀！”',
                        '“确实如此。但你为什么想让你的羊去吃小猴面包树呢？”',
                        '他回答道：“哎呀！那还用说吗！”好像这是显而易见的事。事实上，小王子的星球上既有好植物，也有坏植物。好种子长出好草，坏种子长出坏草。',
                        '如果是一颗萝卜或者玫瑰的幼苗，你可以任它自由生长；但如果是一棵猴面包树，一旦认出它来，就必须立刻把它拔掉。',
                        '“这是纪律问题，”小王子后来对我说，“每天清晨梳洗完毕之后，就必须仔细地梳理你的星球。哪怕是一丝怠慢，猴面包树就会把整颗星球撑裂。”'
                    ]
                },
                {
                    title: '第六章：四十四次日落与忧伤',
                    content: [
                        '啊，小王子！我就是这样一点一点明白了你那小小的、忧郁的生命。在很长一段时间里，你唯一的乐趣就是静静地看日落的温柔霞光。',
                        '第四天清晨，我知道了这个新的细节，当时你对我说：',
                        '“我喜欢日落。我们去看日落吧……”',
                        '“可是我们得等一等……”',
                        '“等什么？”',
                        '“等太阳下山啊。”',
                        '你先是显得很惊奇，接着笑起自己来。你对我说：“我总觉得自己还在家呢！”',
                        '确实，人人都知道，当美国是正午时，法国正值日落。如果你能一分钟飞到法国，就能赶上看日落。可惜法国太远了。',
                        '但在你那颗小小的星球上，你只需要把椅子挪动几步。任何时候你想看，都能看到黄昏的余晖。',
                        '“有一天，”你说，“我看了四十四次日落！”',
                        '过了片刻，你又补充说：',
                        '“你知道……当一个人感到非常忧伤的时候，他总是喜欢看日落的……”',
                        '“那么，看了四十四次日落的那天，你很忧伤吗？”我问。',
                        '但小王子没有回答。'
                    ]
                },
                {
                    title: '第二十一章：小狐狸与“驯服”的秘密',
                    content: [
                        '正是在这个时候，狐狸出现了。',
                        '“你好。”狐狸说。',
                        '“你好。”小王子很有礼貌地回答，转过身来却什么也没看见。',
                        '“我在这儿呢，”那个声音说，“在苹果树下。”',
                        '“你是谁？”小王子说，“你真漂亮……”',
                        '“我是一只狐狸。”狐狸说。',
                        '“来跟我玩吧，”小王子提议道，“我正难过得很呢……”',
                        '“我不能跟你玩，”狐狸说，“我还没有被驯服呢。”',
                        '“啊！请原谅，”小王子说。但经过一番思考，他又问：“‘驯服’是什么意思？”',
                        '“这是早就被人遗忘的事情，”狐狸说，“它的意思是‘建立纽带’。”',
                        '“建立纽带？”',
                        '“对我来说，你还只是一个小男孩，就像其他成千上万个小男孩一样。我不需要你，你也不需要我。对你来说，我也只是一只狐狸，就像其他成千上万只狐狸一样。',
                        '但是，如果你驯服了我，我们就会互相需要。对我来说，你将是世界上独一无二的；对你来说，我也将是世界上独一无二的……”',
                        '小王子开始明白了。“有一朵花……我想她已经驯服了我……”',
                        '临别时，狐狸送给小王子一个秘密：“这是我的秘密，它很简单：只有用心灵才能看得清事物的本质；真正重要的东西，是用眼睛看不见的。”',
                        '“真正重要的东西，是用眼睛看不见的。”小王子重复着，为了牢牢记住。',
                        '“正因为你在你的玫瑰花身上耗费了时间，才使你的玫瑰花变得如此重要。”',
                        '“正因为我把时间耗费在我的玫瑰花上……”小王子重复着。',
                        '“大人们已经忘记了这个真理，”狐狸说，“但你绝不能忘记它。你永远要对你驯服的一切负责。你要对你的玫瑰花负责。”'
                    ]
                }
            ]
        },
        solitude: {
            id: 'solitude',
            title: '百年孤独 (One Hundred Years of Solitude)',
            author: '加西亚·马尔克斯',
            coverEmoji: '📘',
            description: '加西亚·马尔克斯 · 魔幻现实主义巅峰之作',
            chapters: [
                {
                    title: '卷一：遥远的下午与冰块的记忆',
                    content: [
                        '多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起，父亲带他去见识冰块的那个遥远的下午。',
                        '那时的马孔多是一个二十户人家的村落，泥巴和芦苇盖成的房屋沿河岸排开，湍急的河水清澈见底，河床里卵石洁白光滑宛如史前巨蛋。',
                        '世界阿创未久，许多事情都还没有名字，提起它们时还须用手指指点点。',
                        '每年三月前后，衣衫褴褛的吉普赛人都会在村边搭起帐篷，在笛鼓的喧嚣中向村人引介新近的发明。',
                        '最初他们带来了磁铁。一个名叫梅尔基亚德斯的粗壮吉普赛人，胡子拉碴，双手如鸟爪，自称掌握了炼金术士的秘诀。',
                        '他挨家挨户拖着两块铁锭，引得所有人惊骇不已：铁锅、铁盆、火钳、小铁炉纷纷从原地滚落，木板因铁钉受拔而咯咯作响。',
                        '“万物皆有灵，”吉普赛人用粗哑的嗓音高喊，“只要唤醒它们的灵魂就行。”'
                    ]
                },
                {
                    title: '卷二：放大镜、地图与寻找大洋之路',
                    content: [
                        '次年三月，吉普赛人又带来了放大镜。梅尔基亚德斯在村中广场做了一场震撼的演示：他把阳光聚集在干草堆上，瞬间燃起熊熊烈火。',
                        '何塞·阿尔卡蒂奥·布恩迪亚还没来得及为磁铁的失败叹息，又萌生出将放大镜用作军事武器的奇思妙想。',
                        '乌尔苏拉极力劝阻，但他用两块磁铁和三枚殖民时期的金币换下了放大镜。他为此甚至烧焦了自己的皮肤，却坚信发现了无往不胜的战术。',
                        '为了验证这一设想，他绘制了极其详尽的战略要图，并附上操作规程，历经千难万险将手稿送往遥远的当局。',
                        '信件杳无音信。但何塞·阿尔卡蒂奥·布恩迪亚毫不气馁，他又将目光投向了寻找通向文明大洋的出路。',
                        '他带领一行青壮年穿越长满巨型羊齿植物的热带沼泽，空气沉闷如窒息的温室。最终，在一片毫无生机的泥滩尽头，他们赫然发现了一艘挂满青苔、倾斜在林间的西班牙大帆船。'
                    ]
                },
                {
                    title: '卷三：失眠症候群与文字标记万物',
                    content: [
                        '当印第安孤女丽贝卡来到马孔多时，她带来了一种隐秘而可怕的疫病：失眠症。',
                        '起初，村民们为不用睡觉而欣喜若狂，因为白昼变得无限漫长，有做不完的活计。但不久之后，失眠症最可怕的后果显现了：遗忘。',
                        '先是童年的记忆消失，接着是事物的名称和用法，最后连亲人的面容和自我意识都化为乌有。',
                        '何塞·阿尔卡蒂奥·布恩迪亚为了对抗遗忘，发明了一套奇特的标记系统。他用毛刷蘸着墨水，在所有物品上写下名字：桌子、椅子、时钟、门。',
                        '随后他意识到光标名字还不够，又写下用途：“这是一头牛，每天早晨挤奶，牛奶可以煮咖啡。”',
                        '在村口的大道上，他们立起了一块巨大的木牌，上面赫然写着两行大字：“上帝是存在的。”',
                        '马孔多的人们就这样在虚幻的文字迷宫中生活着，直到梅尔基亚德斯带着神奇的解药回到村庄，用一剂苦涩的草药水唤醒了整个小镇的记忆。'
                    ]
                },
                {
                    title: '卷四：羊皮卷手稿的宿命预言',
                    content: [
                        '梅尔基亚德斯在布恩迪亚家的小屋深处留下一间永远不落灰尘的房间，以及一卷用梵文写就的羊皮纸手稿。',
                        '手稿被封存在坚固的玻璃匣中，预言着这个家族从始至终一百年的命运。',
                        '奥雷里亚诺·布恩迪亚在工坊里熔铸小金鱼，一代又一代的布恩迪亚人在这个充满奇迹与孤寂的房间里破译手稿。',
                        '时光不是在流逝，而是在原地打转。家族的每一个生命都在重蹈先人的覆辙，孤独如同热带暴雨后的水汽，笼罩在马孔多的每一寸瓦砾之上。',
                        '直到百年之后的最后一人，在飓风将整个城镇从地面抹去的那一刻，终于读懂了羊皮纸最后的一句话：',
                        '“遭受百年孤独的家族，注定不会在大地上第二次出现。”'
                    ]
                }
            ]
        },
        flow: {
            id: 'flow',
            title: '心流与学术生产力指南 (Flow & Focus Companion)',
            author: '蓝昴空间精选',
            coverEmoji: '📗',
            description: '蓝昴精选 · 沉浸式阅读与知识管理方法论',
            chapters: [
                {
                    title: '第一讲：深度工作假说与注意力资本',
                    content: [
                        '在注意力被算法和短视频疯狂收割的数字时代，深度工作的能力正变得日益稀缺，同时它在现代经济中的价值也正呈指数级攀升。',
                        '卡尔·纽波特在《深度工作》中提出：在无干扰的心智高度集中状态下开展的职业活动，能够将你的认知能力推向极限，创造出具有稀缺性的新价值。',
                        '与深度工作相对的是浮浅工作：那些在注意力高度碎片化、频繁切换标签页或消息弹窗状态下完成的事务。它无法产生认知沉淀。',
                        '高质量的产出 = 投入的时间 × 专注的强度。',
                        '通过建立明确的阅读仪式感（例如使用羊皮纸阅读器、开启雨落窗台的伴读白噪声、设置 25 分钟番茄专注周期），你可以快速为大脑营造无杂音的心智结界。'
                    ]
                },
                {
                    title: '第二讲：微信读书排版美学与认知工效学',
                    content: [
                        '为什么微信读书的排版能让人连续阅读数小时而不感到视觉疲劳？这背后有着深刻的认知心理学与人机工程学逻辑。',
                        '第一，多栏左右分页（Horizontal Multi-column Paging）。人眼对水平移动的追踪远远优于竖向无尽瀑布流的疲惫拖拽。一页一页的确定感为大脑提供了即时完成的心理正反馈。',
                        '第二，莫兰迪与羊皮纸护眼色温。高色温冷光纯白屏幕会抑制褪黑素并引发眼干；而米黄（#f7f1e5）与淡青绿（#edf5ee）柔和光谱能够降低视网膜对比刺激。',
                        '第三，呼吸感字距与行高。1.85倍黄金行高与两端对齐排版，消除了文字堆叠的压迫感，使长程学术精读成为一种视觉享受。'
                    ]
                },
                {
                    title: '第三讲：卢曼卡片盒与个人第二大脑',
                    content: [
                        '德国社会学家尼克拉斯·卢曼（Niklas Luhmann）一生出版了 70 多部专著和 400 多篇学术论文，其核心秘密就是卡片盒笔记法（Zettelkasten）。',
                        '阅读不是被动的眼球扫描，而是与伟大思想家的主动对话。',
                        '卡片盒的精髓在于三类笔记：',
                        '1. 闪念笔记（Fleeting Notes）：阅读途中灵光一现的直觉，随时记在便签或备忘录中；',
                        '2. 文献笔记（Literature Notes）：用自己的话复述作者的核心观点，拒绝机械摘抄；',
                        '3. 永久笔记（Permanent Notes）：将文献笔记与已有的知识卡片建立双向链接，形成网状互联的知识星丛。',
                        '当你的卡片盒积累到一定量级，写作不再是从空白文档开始痛苦构思，而是将卡片串联成篇的自然涌现。'
                    ]
                },
                {
                    title: '第四讲：番茄工作法与白噪声掩蔽声学原理',
                    content: [
                        '弗朗切斯科·西里洛创立的番茄工作法（Pomodoro Technique）不仅是一个计时工具，更是一种与时间化敌为友的心理机制。',
                        '将任务拆解为不可分割的 25 分钟“专注冲刺”，期间杜绝任何多任务切换。当计时钟滴答流逝时，大脑会进入一种纯粹的目标锁定状态。',
                        '而伴读白噪声（White & Brown Noise）的声学原理在于“听觉掩蔽效应”：',
                        '人耳之所以容易被办公室交谈声或邻居家关门声打断，是因为这些声音具有突发的高峰值动态对比。',
                        '你可以按个人喜好选择溪流、三档雨声、木鱼、远钟、海浪或林间鸟鸣。建议从低音量开始；环境音的舒适度因人而异，不作专注或健康效果保证。'
                    ]
                },
                {
                    title: '第五讲：零额度消耗哲学与个人数据主权',
                    content: [
                        '在一切都在走向中心化云端订阅的今天，人们往往忽视了现代 Web 浏览器的强大算力。',
                        '一台普通的智能手机或笔记本电脑，其 CPU 和现代 JavaScript 引擎完全足以在几毫秒内解析数十万字的文本，进行平滑的分页与排版。',
                        '本阅读器坚持“零额度消耗”设计哲学：',
                        '所有书籍文本通过浏览器的本地内存和 FileReader 接口实时处理，绝不向任何云端服务器发送或存储你的私人阅读文件。',
                        '你的读书进度、个性化主题、字号喜好全部保存在本地 localStorage 中。',
                        '数据完全属于你自己，既没有隐私泄露的顾虑，也没有服务器带宽与存储配额的开销。这是个人数字主权的最佳实践。'
                    ]
                }
            ]
        }
    };

    // ===== 2. 状态管理 =====
    const state = {
        books: Object.assign({}, BUILTIN_BOOKS),
        currentBookId: 'prince',
        currentBook: BUILTIN_BOOKS.prince,
        currentChapterIndex: 0,
        currentPage: 1,
        totalPages: 1,
        menuVisible: false,
        activeView: 'bookshelf',
        settings: {
            theme: 'parchment', // parchment | green | white | dark
            fontSize: 18,        // 14 ~ 28
            fontFamily: 'system',// system | serif | kaiti
            mode: 'flip',        // flip | scroll
            animMode: 'curl',    // curl | slide | cover | scroll
            soundEnabled: true   // 拟真纸张沙沙声
        }
    };

    // 存储键名
    const STORAGE_KEY_SETTINGS = 'lanmao_reader_settings_v1';
    const STORAGE_KEY_PROGRESS = 'lanmao_reader_progress_v1';

    // ===== 3. 工具函数 =====
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message, duration = 2200) {
        const toast = document.getElementById('reader-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.hidden = false;
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });
        if (toast._timer) clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.hidden = true;
            }, 250);
        }, duration);
    }

    // ===== 4. 本地设置与进度存取 =====
    function loadSavedSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (['parchment', 'green', 'white', 'dark'].includes(parsed.theme)) {
                        state.settings.theme = parsed.theme;
                    }
                    if (typeof parsed.fontSize === 'number' && parsed.fontSize >= 14 && parsed.fontSize <= 28) {
                        state.settings.fontSize = parsed.fontSize;
                    }
                    if (['system', 'serif', 'kaiti'].includes(parsed.fontFamily)) {
                        state.settings.fontFamily = parsed.fontFamily;
                    }
                    if (['flip', 'scroll'].includes(parsed.mode)) {
                        state.settings.mode = parsed.mode;
                    }
                    if (['curl', 'slide', 'cover', 'scroll'].includes(parsed.animMode)) {
                        state.settings.animMode = parsed.animMode;
                        state.settings.mode = parsed.animMode === 'scroll' ? 'scroll' : 'flip';
                    }
                    if (typeof parsed.soundEnabled === 'boolean') {
                        state.settings.soundEnabled = parsed.soundEnabled;
                    }
                }
            }
        } catch (_) {}
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(state.settings));
        } catch (_) {}
    }

    function loadSavedProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    function saveProgress() {
        try {
            const data = {
                bookId: state.currentBookId,
                chapterIndex: state.currentChapterIndex,
                page: state.currentPage,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
        } catch (_) {}
    }

    // ===== 5. UI 应用与主题切换 =====
    function applySettings() {
        // 主题设置
        document.documentElement.dataset.readerTheme = state.settings.theme;
        document.querySelectorAll('.theme-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.theme === state.settings.theme);
        });

        // 字号设置
        document.documentElement.style.setProperty('--r-font-size', state.settings.fontSize + 'px');
        const valFont = document.getElementById('val-font-size');
        if (valFont) valFont.textContent = state.settings.fontSize + ' px';

        // 字体风格
        const content = document.getElementById('reader-content');
        if (content) {
            content.classList.remove('font-system', 'font-serif', 'font-kaiti');
            content.classList.add('font-' + state.settings.fontFamily);
        }
        document.querySelectorAll('.font-family-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.font === state.settings.fontFamily);
        });

        // 翻页模式与 3D 书卷动效
        const stage = document.getElementById('reader-stage');
        if (stage) {
            stage.classList.toggle('mode-scroll', state.settings.mode === 'scroll');
        }
        document.querySelectorAll('.flip-anim-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.anim === state.settings.animMode);
        });

        // 翻页纸张音效状态
        const btnSound = document.getElementById('btn-toggle-sound');
        const soundText = document.getElementById('sound-status-text');
        if (btnSound && soundText) {
            btnSound.classList.toggle('active', state.settings.soundEnabled);
            btnSound.setAttribute('aria-pressed', String(state.settings.soundEnabled));
            soundText.textContent = state.settings.soundEnabled ? '已开启' : '已静音';
        }

        // 重新计算分页
        requestAnimationFrame(() => {
            updatePaginationMetrics();
        });
    }

    // ===== 6. 菜单与抽屉控制 =====
    function toggleMenu() {
        setMenuVisibility(!state.menuVisible);
    }

    function showMenu() {
        setMenuVisibility(true);
    }

    function hideMenu() {
        setMenuVisibility(false);
    }

    function setMenuVisibility(visible) {
        state.menuVisible = visible;
        const topbar = document.getElementById('reader-topbar');
        const bottombar = document.getElementById('reader-bottombar');
        if (topbar) topbar.classList.toggle('menu-hidden', !visible);
        if (bottombar) bottombar.classList.toggle('menu-hidden', !visible);
    }

    function openDrawer(drawerId) {
        closeAllDrawers();
        const drawer = document.getElementById(drawerId);
        const backdrop = document.getElementById('reader-backdrop');
        if (drawer) drawer.hidden = false;
        if (backdrop) backdrop.hidden = false;
    }

    function closeAllDrawers() {
        const drawers = ['drawer-toc', 'drawer-settings', 'drawer-bookshelf'];
        drawers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        const backdrop = document.getElementById('reader-backdrop');
        if (backdrop) backdrop.hidden = true;
    }

    
    // ===== 6.5 双视图切换与书架大厅管理 =====
    function switchView(viewName, bookId, chapterIndex, page) {
        const shelfView = document.getElementById('view-bookshelf');
        const readerView = document.getElementById('view-reader');
        if (!shelfView || !readerView) return;

        if (viewName === 'reader') {
            shelfView.hidden = true;
            readerView.hidden = false;
            state.activeView = 'reader';

            const targetBookId = bookId || state.currentBookId || 'prince';
            const targetChapter = typeof chapterIndex === 'number' ? chapterIndex : (state.currentChapterIndex || 0);
            const targetPage = typeof page === 'number' ? page : (state.currentPage || 1);

            loadBook(targetBookId, targetChapter, targetPage);
            hideMenu();

            try {
                const url = new URL(window.location.href);
                url.searchParams.set('book', targetBookId);
                window.history.replaceState({ view: 'reader', book: targetBookId }, '', url.toString());
            } catch (_) {}
        } else {
            readerView.hidden = true;
            shelfView.hidden = false;
            state.activeView = 'bookshelf';

            closeAllDrawers();
            updateBookshelfHero();

            try {
                const url = new URL(window.location.href);
                url.searchParams.delete('book');
                window.history.replaceState({ view: 'bookshelf' }, '', url.toString());
            } catch (_) {}
        }
    }

    function updateBookshelfHero() {
        const heroCard = document.getElementById('shelf-hero-card');
        if (!heroCard) return;

        const saved = loadSavedProgress();
        let bookId = 'prince';
        let chapterIndex = 0;
        let page = 1;

        if (saved && saved.bookId && state.books[saved.bookId]) {
            bookId = saved.bookId;
            chapterIndex = saved.chapterIndex || 0;
            page = saved.page || 1;
        }

        const book = state.books[bookId] || BUILTIN_BOOKS.prince;
        const heroEmoji = document.getElementById('shelf-hero-emoji');
        const heroTitle = document.getElementById('shelf-hero-title');
        const heroAuthor = document.getElementById('shelf-hero-author');
        const heroChapter = document.getElementById('shelf-hero-chapter');
        const heroBar = document.getElementById('shelf-hero-bar');
        const heroPct = document.getElementById('shelf-hero-pct');
        const heroCover = document.getElementById('shelf-hero-cover');

        if (heroEmoji) heroEmoji.textContent = book.coverEmoji || '📖';
        if (heroTitle) heroTitle.textContent = book.title;
        if (heroAuthor) heroAuthor.textContent = book.author || '经典著作';

        const chapter = (book.chapters && book.chapters[chapterIndex]) ? book.chapters[chapterIndex] : null;
        if (heroChapter) {
            heroChapter.textContent = chapter ? chapter.title : '第一章';
        }

        const totalChapters = (book.chapters && book.chapters.length) || 1;
        const pct = Math.min(100, Math.max(5, Math.round(((chapterIndex + (page > 1 ? 0.5 : 0)) / totalChapters) * 100)));
        if (heroBar) heroBar.style.width = pct + '%';
        if (heroPct) heroPct.textContent = `已读 ${pct}%`;

        if (heroCover) {
            if (bookId === 'prince') {
                heroCover.style.background = 'linear-gradient(135deg, #f4a261, #e76f51)';
            } else if (bookId === 'solitude') {
                heroCover.style.background = 'linear-gradient(135deg, #457b9d, #1d3557)';
            } else if (bookId === 'flow') {
                heroCover.style.background = 'linear-gradient(135deg, #2a9d8f, #264653)';
            } else {
                heroCover.style.background = 'linear-gradient(135deg, #9d4edd, #5a189a)';
            }
        }

        const continueBtn = document.getElementById('shelf-hero-continue-btn');
        if (continueBtn) {
            continueBtn.onclick = () => {
                switchView('reader', bookId, chapterIndex, page);
            };
        }
    }

    function renderBookshelfGrid() {
        const grid = document.getElementById('shelf-books-grid');
        if (!grid) return;

        const bookKeys = Object.keys(state.books);
        const customKeys = bookKeys.filter(k => !BUILTIN_BOOKS[k]);

        grid.querySelectorAll('.book-card-item.custom-card').forEach(el => el.remove());

        customKeys.forEach(k => {
            const b = state.books[k];
            const card = document.createElement('div');
            card.className = 'book-card-item custom-card';
            card.dataset.book = b.id;
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.innerHTML = `
                <div class="card-cover-wrap cover-custom">
                    <span class="card-cover-emoji">${escapeHtml(b.coverEmoji || '📄')}</span>
                    <div class="card-cover-spine"></div>
                </div>
                <div class="card-meta">
                    <h4 class="card-title">${escapeHtml(b.title)}</h4>
                    <p class="card-author">${escapeHtml(b.author || '本地导入')}</p>
                    <span class="card-tag">本地书籍</span>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // ===== 7. 书籍与章节加载 =====
    function loadBook(bookId, chapterIndex = 0, page = 1) {
        const book = state.books[bookId];
        if (!book) return;

        state.currentBookId = bookId;
        state.currentBook = book;
        state.currentChapterIndex = Math.max(0, Math.min(book.chapters.length - 1, chapterIndex));

        // 更新书籍标题
        const headerTitle = document.getElementById('reader-header-title');
        if (headerTitle) {
            headerTitle.textContent = book.title;
        }

        // 更新书架激活状态
        document.querySelectorAll('.shelf-book-item').forEach(item => {
            item.classList.toggle('active', item.dataset.book === bookId);
        });

        renderChapter(state.currentChapterIndex, page);
        renderToc();
    }

    function renderChapter(chapterIndex, pageTarget = 1) {
        const book = state.currentBook;
        if (!book || !book.chapters[chapterIndex]) return;

        state.currentChapterIndex = chapterIndex;
        const chapter = book.chapters[chapterIndex];

        // 更新页眉章节名称
        const headerChapter = document.getElementById('reader-header-chapter');
        if (headerChapter) {
            headerChapter.textContent = chapter.title;
        }

        // 渲染正文内容
        const content = document.getElementById('reader-content');
        if (!content) return;

        const htmlParts = [];
        htmlParts.push(`<h2>${escapeHtml(chapter.title)}</h2>`);

        if (Array.isArray(chapter.content)) {
            chapter.content.forEach(p => {
                const trimmed = p.trim();
                if (trimmed) {
                    htmlParts.push(`<p>${escapeHtml(trimmed)}</p>`);
                }
            });
        } else if (typeof chapter.content === 'string') {
            const paragraphs = chapter.content.split(/\r?\n+/);
            paragraphs.forEach(p => {
                const trimmed = p.trim();
                if (trimmed) {
                    htmlParts.push(`<p>${escapeHtml(trimmed)}</p>`);
                }
            });
        }

        content.innerHTML = htmlParts.join('\n');

        // 重置滚动位置
        const viewport = document.getElementById('reader-viewport');
        if (viewport) viewport.scrollTop = 0;

        // 重新排版计算分页
        requestAnimationFrame(() => {
            updatePaginationMetrics();
            if (pageTarget === 'last') {
                goToPage(state.totalPages);
            } else {
                goToPage(Number(pageTarget) || 1);
            }
            updateChapterNavButtons();
            highlightActiveToc();
        });
    }

    function renderToc() {
        const tocList = document.getElementById('reader-toc-list');
        if (!tocList || !state.currentBook) return;

        tocList.innerHTML = '';
        state.currentBook.chapters.forEach((ch, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toc-item' + (idx === state.currentChapterIndex ? ' active' : '');
            btn.textContent = `${idx + 1}. ${ch.title}`;
            btn.addEventListener('click', () => {
                goToChapter(idx, 1);
                closeAllDrawers();
            });
            tocList.appendChild(btn);
        });
    }

    function highlightActiveToc() {
        const items = document.querySelectorAll('.toc-item');
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === state.currentChapterIndex);
        });
    }

    function updateChapterNavButtons() {
        const prevBtn = document.getElementById('reader-prev-chapter');
        const nextBtn = document.getElementById('reader-next-chapter');
        if (prevBtn) {
            prevBtn.disabled = state.currentChapterIndex <= 0;
            prevBtn.style.opacity = prevBtn.disabled ? '0.45' : '1';
        }
        if (nextBtn && state.currentBook) {
            nextBtn.disabled = state.currentChapterIndex >= state.currentBook.chapters.length - 1;
            nextBtn.style.opacity = nextBtn.disabled ? '0.45' : '1';
        }
    }


    // ===== 拟真纸张翻页声学合成 (Web Audio 程序化合成，0 音频文件) =====
    let paperAudioCtx = null;
    function playPaperRustleSound() {
        if (!state.settings.soundEnabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            paperAudioCtx = paperAudioCtx || new AudioCtx();
            if (paperAudioCtx.state === 'suspended') {
                paperAudioCtx.resume();
            }

            const sampleRate = paperAudioCtx.sampleRate;
            const duration = 0.15;
            const bufferSize = Math.floor(sampleRate * duration);
            const buffer = paperAudioCtx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                const p = i / bufferSize;
                const env = Math.sin(p * Math.PI) * Math.exp(-p * 2.6);
                data[i] = white * env;
            }

            const source = paperAudioCtx.createBufferSource();
            source.buffer = buffer;

            const filter = paperAudioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, paperAudioCtx.currentTime);
            filter.Q.setValueAtTime(1.4, paperAudioCtx.currentTime);

            const gain = paperAudioCtx.createGain();
            gain.gain.setValueAtTime(0.001, paperAudioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.24, paperAudioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, paperAudioCtx.currentTime + duration);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(paperAudioCtx.destination);

            source.start();
        } catch (_) {}
    }

    let isFlipping = false;

    function executePageTurn(targetPage, direction = 'next') {
        if (state.settings.mode === 'scroll') return;
        if (isFlipping) return;

        targetPage = Math.max(1, Math.min(state.totalPages, targetPage));
        if (targetPage === state.currentPage) return;

        const viewport = document.getElementById('reader-viewport');
        const content = document.getElementById('reader-content');
        if (!viewport || !content) {
            state.currentPage = targetPage;
            applyPageTransform();
            updateFooterInfo();
            updateSlider();
            saveProgress();
            return;
        }

        const colWidth = viewport.clientWidth;
        const colGap = window.innerWidth >= 900 ? 60 : 48;
        const step = colWidth + colGap;

        const fromPage = state.currentPage;
        const toPage = targetPage;

        // 1. 拟真书卷翻页 (3D Realistic Page Curl)
        if (state.settings.animMode === 'curl') {
            const curlLayer = document.getElementById('reader-curl-layer');
            const curlSheet = document.getElementById('curl-sheet');
            const curlFront = document.getElementById('curl-front');
            const curlShadow = document.getElementById('curl-shadow');

            if (curlLayer && curlSheet && curlFront && curlShadow) {
                isFlipping = true;

                curlFront.innerHTML = content.innerHTML;
                curlFront.className = 'curl-front ' + content.className;
                curlFront.style.transform = `translateX(-${(fromPage - 1) * step}px)`;

                content.style.transition = 'none';
                content.style.transform = `translateX(-${(toPage - 1) * step}px)`;

                curlLayer.classList.add('active');

                if (direction === 'next') {
                    curlSheet.style.transformOrigin = 'left center';
                    curlSheet.style.transform = 'perspective(2000px) rotateY(0deg)';
                    curlShadow.style.opacity = '0';

                    playPaperRustleSound();

                    requestAnimationFrame(() => {
                        curlSheet.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
                        curlSheet.style.transform = 'perspective(2000px) rotateY(-180deg)';

                        curlShadow.style.transition = 'opacity 0.18s ease';
                        curlShadow.style.opacity = '0.65';
                        setTimeout(() => {
                            curlShadow.style.opacity = '0';
                        }, 180);

                        setTimeout(() => {
                            curlLayer.classList.remove('active');
                            curlSheet.style.transform = 'none';
                            curlSheet.style.transition = 'none';
                            state.currentPage = toPage;
                            updateFooterInfo();
                            updateSlider();
                            saveProgress();
                            isFlipping = false;
                        }, 400);
                    });
                } else {
                    curlSheet.style.transformOrigin = 'left center';
                    curlSheet.style.transform = 'perspective(2000px) rotateY(-180deg)';
                    curlShadow.style.opacity = '0';

                    playPaperRustleSound();

                    requestAnimationFrame(() => {
                        curlSheet.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
                        curlSheet.style.transform = 'perspective(2000px) rotateY(0deg)';

                        curlShadow.style.transition = 'opacity 0.18s ease';
                        curlShadow.style.opacity = '0.65';
                        setTimeout(() => {
                            curlShadow.style.opacity = '0';
                        }, 180);

                        setTimeout(() => {
                            curlLayer.classList.remove('active');
                            curlSheet.style.transform = 'none';
                            curlSheet.style.transition = 'none';
                            state.currentPage = toPage;
                            updateFooterInfo();
                            updateSlider();
                            saveProgress();
                            isFlipping = false;
                        }, 400);
                    });
                }
                return;
            }
        }

        // 2. 仿真覆盖模式 (Cover Overlay)
        if (state.settings.animMode === 'cover') {
            isFlipping = true;
            playPaperRustleSound();
            content.classList.add('anim-cover');
            content.style.transition = 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
            content.style.transform = `translateX(-${(toPage - 1) * step}px)`;

            setTimeout(() => {
                content.classList.remove('anim-cover');
                state.currentPage = toPage;
                updateFooterInfo();
                updateSlider();
                saveProgress();
                isFlipping = false;
            }, 360);
            return;
        }

        // 3. 经典平滑滑动模式 (Smooth Slide)
        isFlipping = true;
        playPaperRustleSound();
        content.style.transition = 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)';
        content.style.transform = `translateX(-${(toPage - 1) * step}px)`;

        setTimeout(() => {
            state.currentPage = toPage;
            updateFooterInfo();
            updateSlider();
            saveProgress();
            isFlipping = false;
        }, 340);
    }

    // ===== 8. 微信读书左右分页核心算法 =====
    function updatePaginationMetrics() {
        if (state.settings.mode === 'scroll') {
            state.totalPages = 1;
            state.currentPage = 1;
            updateFooterInfo();
            return;
        }

        const viewport = document.getElementById('reader-viewport');
        const content = document.getElementById('reader-content');
        if (!viewport || !content) return;

        const colWidth = viewport.clientWidth;
        const colGap = window.innerWidth >= 900 ? 60 : 48;
        const step = colWidth + colGap;

        // 计算当前章节内容在列分流下的总宽度
        const scrollWidth = content.scrollWidth;
        const calculatedPages = Math.max(1, Math.ceil((scrollWidth + colGap / 2) / step));

        state.totalPages = calculatedPages;
        if (state.currentPage > calculatedPages) state.currentPage = calculatedPages;
        if (state.currentPage < 1) state.currentPage = 1;

        applyPageTransform();
        updateFooterInfo();
        updateSlider();
    }

    function applyPageTransform() {
        const content = document.getElementById('reader-content');
        const viewport = document.getElementById('reader-viewport');
        if (!content || !viewport) return;

        if (state.settings.mode === 'scroll') {
            content.style.transform = 'none';
            return;
        }

        const colWidth = viewport.clientWidth;
        const colGap = window.innerWidth >= 900 ? 60 : 48;
        const step = colWidth + colGap;
        const offset = (state.currentPage - 1) * step;

        content.style.transform = `translateX(-${offset}px)`;
    }

    function goToPage(pageNumber) {
        state.currentPage = Math.max(1, Math.min(state.totalPages, pageNumber));
        applyPageTransform();
        updateFooterInfo();
        updateSlider();
        saveProgress();
    }

    function nextPage() {
        if (state.settings.mode === 'scroll') return;
        if (state.currentPage < state.totalPages) {
            executePageTurn(state.currentPage + 1, 'next');
        } else {
            // 当前章节最后一页 -> 翻入下一章第一页
            if (state.currentBook && state.currentChapterIndex < state.currentBook.chapters.length - 1) {
                goToChapter(state.currentChapterIndex + 1, 1);
                showToast('翻入下一章');
            } else {
                showToast('已读到本书最后一页');
            }
        }
    }

    function prevPage() {
        if (state.settings.mode === 'scroll') return;
        if (state.currentPage > 1) {
            executePageTurn(state.currentPage - 1, 'prev');
        } else {
            // 当前章节第一页 -> 翻入上一章最后一页
            if (state.currentChapterIndex > 0) {
                goToChapter(state.currentChapterIndex - 1, 'last');
                showToast('返回上一章');
            } else {
                showToast('已经是第一页了');
            }
        }
    }

    function goToChapter(chapterIndex, pageTarget = 1) {
        if (!state.currentBook) return;
        if (chapterIndex < 0 || chapterIndex >= state.currentBook.chapters.length) return;
        renderChapter(chapterIndex, pageTarget);
        saveProgress();
    }

    function updateFooterInfo() {
        const footerInfo = document.getElementById('reader-footer-info');
        const footerPercent = document.getElementById('reader-footer-percent');
        if (!footerInfo || !footerPercent) return;

        if (state.settings.mode === 'scroll') {
            const viewport = document.getElementById('reader-viewport');
            const totalScroll = viewport ? viewport.scrollHeight - viewport.clientHeight : 1;
            const currentScroll = viewport ? viewport.scrollTop : 0;
            const pct = totalScroll > 0 ? Math.round((currentScroll / totalScroll) * 100) : 0;
            footerInfo.textContent = '连续滚动模式';
            footerPercent.textContent = pct + '%';
        } else {
            footerInfo.textContent = `第 ${state.currentPage} / ${state.totalPages} 页`;
            // 计算整本书的粗略进度
            if (state.currentBook && state.currentBook.chapters.length > 0) {
                const totalCh = state.currentBook.chapters.length;
                const chapterWeight = 100 / totalCh;
                const currentChProgress = ((state.currentPage) / (state.totalPages || 1)) * chapterWeight;
                const overallPct = Math.min(100, Math.round(state.currentChapterIndex * chapterWeight + currentChProgress));
                footerPercent.textContent = overallPct + '%';
            } else {
                footerPercent.textContent = '0%';
            }
        }
    }

    function updateSlider() {
        const slider = document.getElementById('reader-page-slider');
        if (!slider) return;
        slider.min = '1';
        slider.max = String(state.totalPages);
        slider.value = String(state.currentPage);
    }

    // ===== 9. 本地文件解析引擎 (0 字节上传云端，完全本地解析) =====
    function parseUploadedFile(fileName, rawText) {
        const cleanName = fileName.replace(/\.[^/.]+$/, '').trim() || '本地导入书籍';
        const lines = rawText.split(/\r?\n/);
        const chapters = [];
        let currentChapter = null;

        // 常见章节标题正则 (支持第X章/节/回/部/卷、Chapter X、Markdown # 标题)
        const chapterRegex = /^\s*(?:第[0-9一二三四五六七八九十百千]+[章回卷节篇部]|Chapter\s+\d+|#{1,3}\s+)(.*)$/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed) continue;

            const match = trimmed.match(chapterRegex);
            if (match && trimmed.length < 50) {
                // 开启新章节
                if (currentChapter && currentChapter.content.length > 0) {
                    chapters.push(currentChapter);
                }
                const chTitle = trimmed.replace(/^#{1,3}\s*/, '');
                currentChapter = {
                    title: chTitle,
                    content: []
                };
            } else {
                if (!currentChapter) {
                    currentChapter = {
                        title: '前言与开篇',
                        content: []
                    };
                }
                currentChapter.content.push(trimmed);
            }
        }

        if (currentChapter && currentChapter.content.length > 0) {
            chapters.push(currentChapter);
        }

        // 如果未识别出任何章节标记（如纯文本散文），按段落或字数均匀分块
        if (chapters.length === 0 || (chapters.length === 1 && chapters[0].content.length > 80)) {
            const allParas = chapters.length === 1 ? chapters[0].content : lines.filter(l => l.trim());
            const CHUNK_SIZE = 40; // 每40段为一个可读单元
            const chunkedChapters = [];
            for (let i = 0; i < allParas.length; i += CHUNK_SIZE) {
                const chunk = allParas.slice(i, i + CHUNK_SIZE);
                chunkedChapters.push({
                    title: `第 ${Math.floor(i / CHUNK_SIZE) + 1} 部分`,
                    content: chunk
                });
            }
            return {
                id: 'custom_' + Date.now(),
                title: cleanName,
                author: '本地文档',
                coverEmoji: '📄',
                description: '纯前端内存解析，0云端消耗',
                chapters: chunkedChapters.length > 0 ? chunkedChapters : [{ title: '正文', content: ['文件内容为空'] }]
            };
        }

        return {
            id: 'custom_' + Date.now(),
            title: cleanName,
            author: '本地文档',
            coverEmoji: '📄',
            description: '纯前端内存解析，0云端消耗',
            chapters
        };
    }

    function handleLocalFileInput(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const buffer = e.target.result;
            if (!buffer || buffer.byteLength === 0) {
                showToast('文件内容为空，请重新选择');
                return;
            }
            let text = '';
            try {
                // 优先使用严格 UTF-8 解码，遇到非法序列抛错
                const utf8 = new TextDecoder('utf-8', { fatal: true });
                text = utf8.decode(buffer);
            } catch (_) {
                // 兼容中文电子书广泛使用的 GBK / GB2312 / GB18030 编码格式
                try {
                    const gbk = new TextDecoder('gb18030');
                    text = gbk.decode(buffer);
                } catch (err) {
                    const fallback = new TextDecoder('utf-8');
                    text = fallback.decode(buffer);
                }
            }
            if (!text || !text.trim()) {
                showToast('文件解析为空，请重新选择');
                return;
            }
            const bookObj = parseUploadedFile(file.name, text);
            state.books[bookObj.id] = bookObj;
            renderBookshelfGrid();
            switchView('reader', bookObj.id, 0, 1);
            closeAllDrawers();
            showToast(`📖 已载入《${bookObj.title}》，零云端空间消耗！`, 3200);
        };
        reader.onerror = function () {
            showToast('读取文件失败，请检查文件格式');
        };
        reader.readAsArrayBuffer(file);
    }

    // 伴读声音由 reader-audio.js 与全站共用音源管理。

    // ===== 11. 25分钟学术番茄专注钟 =====
    let pomodoroSeconds = 25 * 60;
    let pomodoroInterval = null;
    let isPomodoroActive = false;

    function togglePomodoro() {
        if (isPomodoroActive) {
            pausePomodoro();
        } else {
            startPomodoro();
        }
    }

    function startPomodoro() {
        if (pomodoroSeconds <= 0) pomodoroSeconds = 25 * 60;
        isPomodoroActive = true;
        updatePomodoroBadge();
        showToast('🍅 25分钟深度伴读专注开始');
        pomodoroInterval = setInterval(() => {
            if (pomodoroSeconds > 0) {
                pomodoroSeconds--;
                updatePomodoroBadge();
            } else {
                finishPomodoro();
            }
        }, 1000);
    }

    function pausePomodoro() {
        if (pomodoroInterval) {
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
        }
        isPomodoroActive = false;
        updatePomodoroBadge();
        showToast('专注钟已暂停');
    }

    function finishPomodoro() {
        pausePomodoro();
        pomodoroSeconds = 25 * 60;
        updatePomodoroBadge();
        playPomodoroChime();
        showToast('🎉 本轮专注已圆满完成！小憩一下吧');
    }

    function updatePomodoroBadge() {
        const m = String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0');
        const s = String(pomodoroSeconds % 60).padStart(2, '0');
        const badge = document.getElementById('reader-pomodoro-time');
        if (badge) {
            badge.textContent = `${m}:${s}`;
            badge.style.color = isPomodoroActive ? '#ff3b30' : '';
        }
        const shelfBadge = document.getElementById('shelf-pomodoro-badge');
        if (shelfBadge) {
            shelfBadge.textContent = `${m}:${s}`;
            shelfBadge.style.color = isPomodoroActive ? '#ff3b30' : '';
        }
    }

    function playPomodoroChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;
            [587.33, 880].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.frequency.value = freq;
                g.gain.setValueAtTime(0.18, now + idx * 0.22);
                g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.6);
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(now + idx * 0.22);
                osc.stop(now + idx * 0.22 + 0.6);
            });
        } catch (_) {}
    }

    // ===== 12. 全屏沉浸切换 =====
    function toggleFullscreen() {
        const doc = document;
        const docEl = document.documentElement;
        const isFull = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

        if (!isFull) {
            const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (req) {
                try {
                    const res = req.call(docEl);
                    if (res && res.catch) res.catch(() => showToast('当前环境不支持全屏'));
                } catch (_) {
                    showToast('当前环境不支持全屏');
                }
            } else {
                showToast('当前环境不支持全屏');
            }
        } else {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
            if (exit) {
                try {
                    const res = exit.call(doc);
                    if (res && res.catch) res.catch(() => {});
                } catch (_) {}
            }
        }
    }

    // ===== 13. 事件监听绑定 =====
    function bindEvents() {
        // 触控热区感应 (左25%上一页 / 中50%菜单 / 右25%下一页)
        const zonePrev = document.getElementById('zone-prev');
        const zoneMenu = document.getElementById('zone-menu');
        const zoneNext = document.getElementById('zone-next');

        if (zonePrev) zonePrev.addEventListener('click', prevPage);
        if (zoneMenu) zoneMenu.addEventListener('click', toggleMenu);
        if (zoneNext) zoneNext.addEventListener('click', nextPage);

        // ===== 实时跟手拖拽与 3D 书卷交互引擎 =====
        const viewport = document.getElementById('reader-viewport');
        const content = document.getElementById('reader-content');
        if (viewport && content) {
            let isDown = false;
            let startX = 0;
            let startY = 0;
            let deltaX = 0;
            let deltaY = 0;
            let isHorizontalDrag = false;
            let initialBaseOffset = 0;
            const curlLayer = document.getElementById('reader-curl-layer');
            const curlSheet = document.getElementById('curl-sheet');
            const curlFront = document.getElementById('curl-front');
            const curlShadow = document.getElementById('curl-shadow');

            function onStart(x, y, target) {
                if (state.settings.mode === 'scroll') return;
                if (isFlipping) return;
                if (target && (target.closest('button') || target.closest('a') || target.closest('input'))) return;

                isDown = true;
                startX = x;
                startY = y;
                deltaX = 0;
                deltaY = 0;
                isHorizontalDrag = false;

                const colWidth = viewport.clientWidth;
                const colGap = window.innerWidth >= 900 ? 60 : 48;
                const step = colWidth + colGap;
                initialBaseOffset = (state.currentPage - 1) * step;
            }

            function onMove(x, y, e) {
                if (!isDown) return;
                deltaX = x - startX;
                deltaY = y - startY;

                if (!isHorizontalDrag) {
                    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
                        isHorizontalDrag = true;
                    } else if (Math.abs(deltaY) > 15) {
                        isDown = false;
                        return;
                    }
                }

                if (!isHorizontalDrag) return;
                if (e && e.cancelable) e.preventDefault();

                const colWidth = viewport.clientWidth;
                const colGap = window.innerWidth >= 900 ? 60 : 48;
                const step = colWidth + colGap;

                // 边缘阻尼弹性效果
                let effectiveDelta = deltaX;
                if (state.currentPage === 1 && deltaX > 0 && state.currentChapterIndex === 0) {
                    effectiveDelta = deltaX * 0.3;
                } else if (state.currentPage === state.totalPages && deltaX < 0 && state.currentChapterIndex >= (state.currentBook?.chapters.length || 1) - 1) {
                    effectiveDelta = deltaX * 0.3;
                }

                // 1. 拟真书卷翻页实时跟随角度渲染
                if (state.settings.animMode === 'curl' && curlLayer && curlSheet && curlFront && curlShadow) {
                    if (effectiveDelta < 0) {
                        if (!curlLayer.classList.contains('active')) {
                            curlFront.innerHTML = content.innerHTML;
                            curlFront.className = 'curl-front ' + content.className;
                            curlFront.style.transform = `translateX(-${initialBaseOffset}px)`;
                            curlSheet.style.transformOrigin = 'left center';
                            curlLayer.classList.add('active');

                            content.style.transition = 'none';
                            const nextOffset = Math.min(initialBaseOffset + step, (state.totalPages - 1) * step);
                            content.style.transform = `translateX(-${nextOffset}px)`;
                        }

                        const progress = Math.min(1, Math.max(0, -effectiveDelta / colWidth));
                        const angle = progress * 180;
                        curlSheet.style.transition = 'none';
                        curlSheet.style.transform = `perspective(2000px) rotateY(-${angle}deg)`;
                        curlShadow.style.opacity = String(Math.sin(progress * Math.PI) * 0.7);
                        return;
                    }
                }

                // 2. 平滑滑动与仿真覆盖实时跟手移动
                content.style.transition = 'none';
                content.style.transform = `translateX(-${initialBaseOffset - effectiveDelta}px)`;
                if (state.settings.animMode === 'cover') {
                    content.classList.add('anim-cover');
                }
            }

            function onEnd() {
                if (!isDown) return;
                isDown = false;

                if (!isHorizontalDrag) return;
                isHorizontalDrag = false;

                const colWidth = viewport.clientWidth;
                const threshold = colWidth * 0.16;

                // 1. 拟真书卷释放
                if (state.settings.animMode === 'curl' && curlLayer && curlLayer.classList.contains('active')) {
                    if (deltaX < -threshold) {
                        playPaperRustleSound();
                        curlSheet.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
                        curlSheet.style.transform = 'perspective(2000px) rotateY(-180deg)';
                        curlShadow.style.transition = 'opacity 0.2s ease';
                        curlShadow.style.opacity = '0';

                        setTimeout(() => {
                            curlLayer.classList.remove('active');
                            curlSheet.style.transform = 'none';
                            curlSheet.style.transition = 'none';
                            if (state.currentPage < state.totalPages) {
                                state.currentPage++;
                                updateFooterInfo();
                                updateSlider();
                                saveProgress();
                            } else if (state.currentChapterIndex < (state.currentBook?.chapters.length || 1) - 1) {
                                goToChapter(state.currentChapterIndex + 1, 1);
                            }
                        }, 300);
                    } else {
                        curlSheet.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
                        curlSheet.style.transform = 'perspective(2000px) rotateY(0deg)';
                        curlShadow.style.transition = 'opacity 0.15s ease';
                        curlShadow.style.opacity = '0';

                        setTimeout(() => {
                            curlLayer.classList.remove('active');
                            curlSheet.style.transform = 'none';
                            curlSheet.style.transition = 'none';
                            content.style.transform = `translateX(-${initialBaseOffset}px)`;
                        }, 260);
                    }
                    return;
                }

                // 2. 平滑滑动与覆盖释放
                content.classList.remove('anim-cover');
                content.style.transition = 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)';

                if (deltaX < -threshold) {
                    nextPage();
                } else if (deltaX > threshold) {
                    prevPage();
                } else {
                    content.style.transform = `translateX(-${initialBaseOffset}px)`;
                }
            }

            viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }, { passive: true });

            viewport.addEventListener('touchmove', (e) => {
                if (e.touches.length !== 1) return;
                onMove(e.touches[0].clientX, e.touches[0].clientY, e);
            }, { passive: false });

            viewport.addEventListener('touchend', onEnd, { passive: true });
            viewport.addEventListener('touchcancel', onEnd, { passive: true });

            // 电脑端鼠标拖拽支持
            viewport.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                onStart(e.clientX, e.clientY, e.target);
            });
            window.addEventListener('mousemove', (e) => {
                onMove(e.clientX, e.clientY, e);
            });
            window.addEventListener('mouseup', onEnd);

            viewport.addEventListener('scroll', () => {
                if (state.settings.mode === 'scroll') {
                    updateFooterInfo();
                }
            }, { passive: true });
        }

        // 键盘按键翻页支持
        document.addEventListener('keydown', (e) => {
            if (document.querySelector('dialog[open]')) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                prevPage();
            } else if (e.key === 'Escape') {
                closeAllDrawers();
                hideMenu();
            }
        });

        // 底部进度条拖动
        const slider = document.getElementById('reader-page-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                goToPage(Number(e.target.value));
            });
            slider.addEventListener('change', () => {
                saveProgress();
            });
        }

        // 章节切换按钮
        const prevChapterBtn = document.getElementById('reader-prev-chapter');
        const nextChapterBtn = document.getElementById('reader-next-chapter');
        if (prevChapterBtn) {
            prevChapterBtn.addEventListener('click', () => {
                if (state.currentChapterIndex > 0) {
                    goToChapter(state.currentChapterIndex - 1, 1);
                }
            });
        }
        if (nextChapterBtn) {
            nextChapterBtn.addEventListener('click', () => {
                if (state.currentBook && state.currentChapterIndex < state.currentBook.chapters.length - 1) {
                    goToChapter(state.currentChapterIndex + 1, 1);
                }
            });
        }

        // 顶部工具栏快捷按钮

        const pomodoroBtn = document.getElementById('reader-toggle-pomodoro');
        if (pomodoroBtn) pomodoroBtn.addEventListener('click', togglePomodoro);

        const importTopBtn = document.getElementById('reader-import-btn');
        if (importTopBtn) {
            importTopBtn.addEventListener('click', () => openDrawer('drawer-bookshelf'));
        }

        const settingsTopBtn = document.getElementById('reader-btn-settings');
        if (settingsTopBtn) {
            settingsTopBtn.addEventListener('click', () => openDrawer('drawer-settings'));
        }

        // 底部 Dock 按钮
        const btnToc = document.getElementById('reader-btn-toc');
        if (btnToc) btnToc.addEventListener('click', () => openDrawer('drawer-toc'));

        const btnThemes = document.getElementById('reader-btn-themes');
        if (btnThemes) btnThemes.addEventListener('click', () => openDrawer('drawer-settings'));

        const btnBookshelf = document.getElementById('reader-btn-bookshelf');
        if (btnBookshelf) btnBookshelf.addEventListener('click', () => switchView('bookshelf'));

        // 返回书架主厅按钮
        const btnBackToShelf = document.getElementById('btn-back-to-shelf');
        if (btnBackToShelf) {
            btnBackToShelf.addEventListener('click', () => switchView('bookshelf'));
        }

        // 消除移动端长按选区及触控蓝块
        const readingArea = document.getElementById('reader-stage');
        if (readingArea) {
            readingArea.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        document.querySelectorAll('.touch-zone').forEach(z => {
            z.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        // 我的书架大厅交互逻辑
        const shelfGrid = document.getElementById('shelf-books-grid');
        if (shelfGrid) {
            shelfGrid.addEventListener('click', (e) => {
                const card = e.target.closest('.book-card-item');
                if (card && card.dataset.book) {
                    const bookId = card.dataset.book;
                    const saved = loadSavedProgress();
                    if (saved && saved.bookId === bookId) {
                        switchView('reader', bookId, saved.chapterIndex || 0, saved.page || 1);
                    } else {
                        switchView('reader', bookId, 0, 1);
                    }
                }
            });
            shelfGrid.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const card = e.target.closest('.book-card-item');
                    if (card && card.dataset.book) {
                        e.preventDefault();
                        card.click();
                    }
                }
            });
        }

        // 书架本地文件选择与拖拽导入
        const shelfFileInput = document.getElementById('shelf-file-input');
        if (shelfFileInput) {
            shelfFileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleLocalFileInput(file);
                shelfFileInput.value = '';
            });
        }

        const shelfDropZone = document.getElementById('shelf-drop-zone');
        if (shelfDropZone) {
            ['dragenter', 'dragover'].forEach(name => {
                shelfDropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    shelfDropZone.classList.add('dragover');
                });
            });
            ['dragleave', 'drop'].forEach(name => {
                shelfDropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    shelfDropZone.classList.remove('dragover');
                });
            });
            shelfDropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length > 0) {
                    handleLocalFileInput(files[0]);
                }
            });
        }

        // 书架白噪声联动
        const shelfToggleNoise = document.getElementById('shelf-toggle-noise');
        if (shelfToggleNoise) {
            shelfToggleNoise.addEventListener('click', () => {
                const readerToggleNoise = document.getElementById('reader-toggle-noise');
                if (readerToggleNoise) readerToggleNoise.click();
            });
        }

        // 书架专注番茄钟联动
        const shelfTogglePomodoro = document.getElementById('shelf-toggle-pomodoro');
        if (shelfTogglePomodoro) {
            shelfTogglePomodoro.addEventListener('click', togglePomodoro);
        }

        // 书架主题轮换按钮
        const shelfThemeBtn = document.getElementById('shelf-theme-btn');
        if (shelfThemeBtn) {
            shelfThemeBtn.addEventListener('click', () => {
                const themes = ['parchment', 'green', 'white', 'dark'];
                const currentIndex = themes.indexOf(state.settings.theme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                state.settings.theme = nextTheme;
                saveSettings();
                applySettings();
                showToast(`已切换主题：${nextTheme === 'parchment' ? '羊皮纸' : nextTheme === 'green' ? '护眼绿' : nextTheme === 'white' ? '纯白' : '夜间黑'}`);
            });
        }

        const btnFullscreen = document.getElementById('reader-btn-fullscreen');
        if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

        // 抽屉关闭按钮
        const closeToc = document.getElementById('close-toc');
        if (closeToc) closeToc.addEventListener('click', closeAllDrawers);

        const closeSettings = document.getElementById('close-settings');
        if (closeSettings) closeSettings.addEventListener('click', closeAllDrawers);

        const closeBookshelf = document.getElementById('close-bookshelf');
        if (closeBookshelf) closeBookshelf.addEventListener('click', closeAllDrawers);

        // 背景遮罩点击关闭
        const backdrop = document.getElementById('reader-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeAllDrawers);

        // 背景色主题切换
        document.querySelectorAll('.theme-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const theme = chip.dataset.theme;
                if (theme) {
                    state.settings.theme = theme;
                    applySettings();
                    saveSettings();
                }
            });
        });

        // 字号缩放
        const btnFontDec = document.getElementById('btn-font-dec');
        const btnFontInc = document.getElementById('btn-font-inc');
        if (btnFontDec) {
            btnFontDec.addEventListener('click', () => {
                if (state.settings.fontSize > 14) {
                    state.settings.fontSize -= 1;
                    applySettings();
                    saveSettings();
                }
            });
        }
        if (btnFontInc) {
            btnFontInc.addEventListener('click', () => {
                if (state.settings.fontSize < 28) {
                    state.settings.fontSize += 1;
                    applySettings();
                    saveSettings();
                }
            });
        }

        // 字体风格切换
        document.querySelectorAll('.font-family-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const font = chip.dataset.font;
                if (font) {
                    state.settings.fontFamily = font;
                    applySettings();
                    saveSettings();
                }
            });
        });

        // 翻页动效模式切换
        document.querySelectorAll('.flip-anim-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const anim = chip.dataset.anim;
                if (anim) {
                    state.settings.animMode = anim;
                    state.settings.mode = anim === 'scroll' ? 'scroll' : 'flip';
                    applySettings();
                    saveSettings();
                    const descMap = {
                        curl: '🍃 已开启 3D 拟真书卷翻页',
                        slide: '📱 已开启微信读书平滑滑动',
                        cover: '📖 已开启仿真纸张覆盖滑页',
                        scroll: '📜 已开启连续长卷滚动'
                    };
                    showToast(descMap[anim] || '已更新翻页动效');
                }
            });
        });

        // 翻页纸张音效切换
        const btnSound = document.getElementById('btn-toggle-sound');
        if (btnSound) {
            btnSound.addEventListener('click', () => {
                state.settings.soundEnabled = !state.settings.soundEnabled;
                applySettings();
                saveSettings();
                if (state.settings.soundEnabled) {
                    playPaperRustleSound();
                    showToast('🔊 翻页纸张沙沙声已开启');
                } else {
                    showToast('🔇 翻页音效已静音');
                }
            });
        }

        // 内置书籍选择
        document.querySelectorAll('.shelf-book-item').forEach(item => {
            item.addEventListener('click', () => {
                const bookKey = item.dataset.book;
                if (bookKey && state.books[bookKey]) {
                    loadBook(bookKey, 0, 1);
                    closeAllDrawers();
                    showToast(`已打开《${state.books[bookKey].title}》`);
                }
            });
        });

        // 本地文件导入
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleLocalFileInput(file);
                fileInput.value = '';
            });
        }

        // 文件拖拽导入
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.style.borderColor = 'var(--r-accent)';
                    dropZone.style.background = 'rgba(0, 113, 227, 0.08)';
                });
            });
            ['dragleave', 'drop'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.style.borderColor = '';
                    dropZone.style.background = '';
                });
            });
            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length > 0) {
                    handleLocalFileInput(files[0]);
                }
            });
        }

        // 视口尺寸调整时自适应重新排版
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                updatePaginationMetrics();
            }, 100);
        });
    }

    // ===== 14. 初始化流程 =====
    function init() {
        loadSavedSettings();
        applySettings();
        bindEvents();
        updateBookshelfHero();
        renderBookshelfGrid();

        // 检查 URL 参数是否有直接打开的书籍
        const params = new URLSearchParams(window.location.search);
        const bookParam = params.get('book');
        const viewParam = params.get('view');

        if (bookParam && state.books[bookParam]) {
            switchView('reader', bookParam, 0, 1);
        } else if (viewParam === 'read') {
            const saved = loadSavedProgress();
            if (saved && saved.bookId && state.books[saved.bookId]) {
                switchView('reader', saved.bookId, saved.chapterIndex || 0, saved.page || 1);
            } else {
                switchView('reader', 'prince', 0, 1);
            }
        } else {
            // 默认展现“我的书架”总览大厅，书籍需从书架点击进入
            switchView('bookshelf');
        }

        // 默认将控制栏隐藏，营造微信读书纯净沉浸感
        hideMenu();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
