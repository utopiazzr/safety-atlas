# 视觉叙事：人类掌舵的未来观测站

首页、海报、回放和投稿属于同一个世界：发现异常信号，理解它跨过了什么边界，再连接防御与人的判断。页面功能保持简单，插画可以丰富。首页 orbital-observatory.webp 保留，案例区与回放承担本次更新。

## 学习来源与设计转译

- [Science Museum：Cosmonauts](https://journal.sciencemuseum.ac.uk/article/the-cosmonauts-challenge/) 与 [展览设计记录](https://journal.sciencemuseum.ac.uk/article/cosmonauts-birth-of-an-exhibition/)：航天视觉中的人、器械和宇宙，以及图文的尺度关系。
- [加加林博物馆：索科洛夫《发射前》](https://museumgagarin.ru/virtualnyy-muzey/virtualnye-vystavki/vystavka-edinstvo-cheloveka-i-vselennoy/a-sokolov-pered-startom/)：馆方强调巨大的火箭与小小的人物之间的尺度差。其展览收录列昂诺夫、索科洛夫等人的作品，讨论 1960—1980 年代艺术家对太空探索和人类未来的表达。项目据此采用分层的航天设施、远处站体、天线、环形结构和行星地平线。
- [NSS：Stanford Torus](https://nss.org/stanford-torus-space-settlement/)：1975 年 NASA/Stanford 空间居住研究，收录轨道建筑绘画，为人类建造的未来设施提供参考。
- [NANZUKA：Hajime Sorayama](https://nanzuka.com/en/artists/hajime-sorayama) 与 [Taguchi Art Collection：《Untitled》(2015)](https://taguchiartcollection.jp/en/artwork/tac330/)：后者标注媒材为 acrylic on illustration board。本项目研究镜面反光、细轮廓与喷绘过渡，采用银白高光、近黑反射带、淡蓝冷影和少量桃粉边缘反光。

以上具体的配色、构图和交互映射是项目设计判断，不代表某个时代只有一套色板。本站插画为新生成作品，没有复制馆藏图片，也不是艺术家原作或授权联名。

## 丰富的插画，清楚的界面

统一依靠共同材质、图文尺度、视线方向和印刷语言。朱红、航天蓝和赭石在插画中有节奏地出现，金属始终以银铬为主体。插画保留站体、桁架、舱体接缝、航行轨迹和远近尺度；暖纸色与硬边几何维持平面漫画感。

页面背景采用深空墨蓝，卡片标题使用暖白印刷条。背景降低存在感，细节集中在作品内部。每张卡保留一个主要机械主体和明确轮廓，标题、类型、图像优先。小字和点击层级不随插画细节增加。

九个主体分别暗示信息出界、记忆、工具链、优化、对话、探测、防护关卡、分类视线和扫描。它们是艺术隐喻，不能作为事件证据。

## 回放如何解释产品逻辑

ScenePlayer 根据 scenes.ts 的每一步决定来源角色、目标角色和信号状态。银铬机器人、终端、记忆片、卫星、工具、镜头、报告和防护拱门来自透明插画图集；轨道、边界、数据包和扫描线由 SVG 和时间轴控制。

- 信息传递：数据包沿轨道从当前来源移动到目标，角色标签始终可读。
- 风险越界：朱红数据包跨过边界，记忆被污染后，在后续读取阶段保留污染标记。
- 反馈与持续影响：返回此前节点的阶段显示回路，体现迭代或跨会话影响。
- 检查：扫描发生在当前目标处，表示配置或评估的介入位置；不伪造拦截成功、准确率或实测结果。

每份档案保留“机制示意 · 非实测”标记，以及来源、条件与局限。用户可暂停、从原位置续播、拖动到阶段内任意位置、跳步和重播。窗口关闭时卸载播放器，页面隐藏时暂停。关闭动效或启用系统减少动态效果时，角色不做入场动画，阶段展示静态结果。

卡片点击打开档案；证据和运行条件放入展开项；投稿只要求一份材料，分类和其他信息可选。
