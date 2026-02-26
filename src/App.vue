<template>
  <div class="flex h-screen bg-[#F7F7F7] text-[#333] font-sans overflow-hidden">
    <!-- Sidebar -->
    <div 
      class="bg-[#F7F7F7] flex flex-col border-r border-[#E5E5E5] overflow-hidden transition-all duration-300 ease-in-out"
      :style="{ width: isSidebarOpen ? '300px' : '0px', opacity: isSidebarOpen ? 1 : 0 }"
    >
      <div class="p-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Bot class="w-5 h-5 text-white" />
          </div>
          <span class="font-bold text-lg tracking-tight">职教百问</span>
        </div>
        <button 
          @click="isSidebarOpen = false"
          class="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
        >
          <LayoutPanelLeft class="w-5 h-5" />
        </button>
      </div>
      
      <div class="px-4 mb-6">
        <button 
          @click="createNewSession"
          class="w-full flex items-center justify-center gap-2 bg-white border border-[#E5E5E5] py-4 rounded-full shadow-sm hover:shadow-md transition-all font-medium text-sm"
        >
          <Plus class="w-5 h-5" />
          开启新对话
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-4 space-y-3 pb-6 custom-scrollbar">
        <div
          v-for="session in sessions"
          :key="session.id"
          @click="loadSession(session)"
          :class="[
            'group flex flex-col p-4 rounded-2xl cursor-pointer transition-all',
            currentSessionId === session.id 
              ? 'bg-white shadow-sm border border-blue-100' 
              : 'hover:bg-white/60 text-slate-600'
          ]"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm font-semibold line-clamp-2 leading-relaxed">{{ session.title }}</span>
            <button 
              @click.stop="deleteSession(session.id)"
              class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all flex-shrink-0"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <span class="text-[11px] text-slate-400 mt-2">{{ formatDate(session.timestamp) }}</span>
        </div>
      </div>
    </div>

    <!-- Toggle Sidebar Button (When closed) -->
    <button 
      v-if="!isSidebarOpen"
      @click="isSidebarOpen = true"
      class="absolute left-4 top-6 z-50 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
    >
      <LayoutPanelLeft class="w-5 h-5 text-slate-500" />
    </button>

    <!-- Main Content -->
    <div class="flex flex-col flex-1 bg-white relative overflow-hidden">
      <!-- Top Header -->
      <header class="px-8 py-6 flex items-center gap-4 relative z-40">
        <div class="relative">
          <button 
            @click="isDomainDropdownOpen = !isDomainDropdownOpen"
            class="flex items-center gap-3 px-6 py-2.5 bg-white rounded-full border border-[#E5E5E5] hover:bg-slate-50 transition-all shadow-sm group"
          >
            <span class="text-base font-medium text-slate-700">{{ selectedDomain }}</span>
            <ChevronRight :class="['w-4 h-4 text-slate-400 transition-transform duration-300', isDomainDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90']" />
          </button>

          <div v-if="isDomainDropdownOpen">
            <div 
              class="fixed inset-0 z-10" 
              @click="isDomainDropdownOpen = false" 
            ></div>
            <div
              class="absolute top-full left-0 mt-3 w-72 bg-white rounded-[24px] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] py-3 z-20 overflow-hidden"
            >
              <div class="px-5 py-2 mb-1">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">选择专业领域</span>
              </div>
              <button
                v-for="domain in DOMAINS"
                :key="domain"
                @click="selectDomain(domain)"
                :class="[
                  'w-full text-left px-6 py-3.5 text-[15px] transition-all flex items-center justify-between group',
                  selectedDomain === domain 
                    ? 'bg-blue-50/50 text-blue-600 font-bold' 
                    : 'text-slate-600 hover:bg-slate-50'
                ]"
              >
                <span class="group-hover:translate-x-1 transition-transform">{{ domain }}</span>
                <div v-if="selectedDomain === domain" class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-8 pb-48 custom-scrollbar" ref="messagesContainerRef">
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center mt-20 space-y-8">
          <h2 class="text-3xl font-bold text-slate-800">{{ selectedDomain }}</h2>
          <div class="w-full max-w-2xl space-y-4">
            <div class="bg-[#F7F7F7] p-6 rounded-3xl rounded-tl-none inline-block max-w-[80%]">
              <p class="text-slate-700">你好呀，我是职教百问，你想了解什么呢？</p>
            </div>
            <div class="space-y-3">
              <button 
                v-for="(q, i) in (DOMAIN_QUESTIONS[selectedDomain] || []).slice(0, 3)"
                :key="i"
                @click="input = q"
                class="block w-full text-left p-4 border border-[#E5E5E5] rounded-2xl hover:bg-slate-50 transition-colors text-slate-600 text-sm leading-relaxed"
              >
                {{ q }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="max-w-3xl mx-auto space-y-8 pt-10">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['flex flex-col', message.role === 'user' ? 'items-end' : 'items-start']"
          >
            <div :class="[
              'max-w-[90%] rounded-3xl px-6 py-4',
              message.role === 'user' 
                ? 'bg-blue-500 text-white rounded-tr-none shadow-sm' 
                : 'bg-[#F7F7F7] text-slate-800 rounded-tl-none'
            ]">
              <div v-if="message.attachments && message.attachments.length > 0" class="flex flex-wrap gap-2 mb-3">
                <img 
                  v-for="(url, i) in message.attachments"
                  :key="i" 
                  :src="url" 
                  alt="attachment" 
                  class="w-20 h-20 object-cover rounded-lg border border-white/20 cursor-zoom-in hover:opacity-90 transition-opacity" 
                  @click="previewImage = url"
                />
              </div>

              <div v-if="message.thinking && message.role === 'assistant'" class="mb-4 border-l-2 border-slate-300 pl-4 py-1">
                <button 
                  @click="toggleThinking(index)"
                  class="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors"
                >
                  <Bot class="w-3 h-3" />
                  {{ expandedThinking[index] ? '隐藏思考过程' : '查看思考过程' }}
                </button>
                <div v-if="expandedThinking[index]" class="overflow-hidden">
                  <div class="mt-2 text-xs text-slate-500 italic leading-relaxed bg-white/50 p-3 rounded-xl border border-slate-200">
                    {{ message.thinking }}
                  </div>
                </div>
              </div>

              <div class="prose prose-sm max-w-none prose-slate" v-html="renderMarkdown(message.content)"></div>
              
              <button 
                v-if="message.graph"
                @click="activeGraph = message.graph"
                :class="[
                  'mt-4 flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-full transition-all',
                  message.role === 'user'
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                ]"
              >
                <Network class="w-4 h-4" />
                查看关联图谱
              </button>
            </div>
          </div>
          <div v-if="isLoading" class="flex flex-col items-start">
            <div class="bg-[#F7F7F7] rounded-3xl rounded-tl-none px-6 py-4 flex items-center gap-3">
              <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
              <span class="text-sm text-slate-500 font-medium">正在思考并构建图谱...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-8 flex flex-col items-center">
        <div class="w-full max-w-4xl relative">
          <div class="bg-white border-2 border-blue-100 rounded-3xl shadow-xl shadow-blue-500/5 p-4 min-h-[120px] flex flex-col">
            <!-- Attachment Previews -->
            <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 mb-3 px-2">
              <div v-for="(att, i) in attachments" :key="i" class="relative group">
                <img 
                  :src="att.preview" 
                  alt="preview" 
                  class="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity" 
                  @click="previewImage = att.preview"
                />
                <button 
                  @click="removeAttachment(i)"
                  class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <textarea
              v-model="input"
              @keydown.enter.prevent="handleEnter"
              :placeholder="isRecording ? '正在倾听...' : '通过提问，探索世界...'"
              :class="['w-full flex-1 bg-transparent border-none focus:ring-0 resize-none text-slate-700 placeholder:text-slate-400 text-lg p-2', isRecording ? 'animate-pulse' : '']"
            ></textarea>
            
            <div class="flex items-center justify-between mt-2 px-2">
              <div class="flex items-center gap-4">
                <div class="relative">
                  <button 
                    @click="isModelDropdownOpen = !isModelDropdownOpen"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    <Sparkles class="w-3 h-3 text-blue-500" />
                    {{ MODELS.find(m => m.id === selectedModel)?.name }}
                    <ChevronDown :class="['w-3 h-3 transition-transform', isModelDropdownOpen ? 'rotate-180' : '']" />
                  </button>
                  
                  <div v-if="isModelDropdownOpen">
                    <div class="fixed inset-0 z-40" @click="isModelDropdownOpen = false"></div>
                    <div
                      class="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden p-2"
                    >
                      <button
                        v-for="model in MODELS"
                        :key="model.id"
                        @click="selectModel(model.id)"
                        :class="[
                          'w-full text-left p-3 rounded-xl transition-all group',
                          selectedModel === model.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                        ]"
                      >
                        <div class="flex items-center justify-between mb-1">
                          <span :class="['text-xs font-bold', selectedModel === model.id ? 'text-blue-600' : 'text-slate-700']">
                            {{ model.name }}
                          </span>
                          <div v-if="selectedModel === model.id" class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <p class="text-[10px] text-slate-400 leading-relaxed">
                          {{ model.desc }}
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  @click="fileInputRef?.click()"
                  class="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                  title="上传附件"
                >
                  <Paperclip class="w-6 h-6" />
                </button>
                <input 
                  type="file" 
                  ref="fileInputRef" 
                  @change="handleFileUpload" 
                  class="hidden" 
                  multiple 
                  accept="image/*"
                />
                <button 
                  @click="toggleRecording"
                  :class="['p-2 transition-colors', isRecording ? 'text-red-500' : 'text-slate-400 hover:text-blue-500']"
                  :title="isRecording ? '停止录音' : '语音输入'"
                >
                  <MicOff v-if="isRecording" class="w-6 h-6" />
                  <Mic v-else class="w-6 h-6" />
                </button>
              </div>
              
              <button
                @click="handleSubmit"
                :disabled="(!input.trim() && attachments.length === 0) || isLoading"
                class="w-10 h-10 bg-[#A0AEC0] text-white rounded-full flex items-center justify-center hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-[#A0AEC0] transition-all shadow-sm"
              >
                <ArrowUp class="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
        <p class="mt-4 text-xs text-slate-400 font-medium tracking-wide">
          内容均由AI生成，请注意辨别
        </p>
      </div>
    </div>

    <!-- Graph Panel Overlay -->
    <div 
      v-if="activeGraph"
      class="fixed inset-y-0 right-0 bg-white shadow-2xl z-[100] border-l border-slate-200 flex flex-col transition-all duration-300 ease-in-out"
      :style="{ width: isGraphFullScreen ? '100%' : '45%' }"
    >
      <header class="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-50 rounded-lg">
            <Network class="w-5 h-5 text-blue-500" />
          </div>
          <h2 class="text-lg font-bold text-slate-800">知识图谱可视化</h2>
        </div>
        <div class="flex items-center gap-2">
          <button 
            @click="isGraphFullScreen = !isGraphFullScreen"
            class="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            :title="isGraphFullScreen ? '退出全屏' : '全屏预览'"
          >
            <Minimize2 v-if="isGraphFullScreen" class="w-5 h-5" />
            <Maximize2 v-else class="w-5 h-5" />
          </button>
          <button 
            @click="closeGraph"
            class="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <ChevronRight class="w-6 h-6" />
          </button>
        </div>
      </header>
      
      <div class="flex-1 p-8 bg-[#F9FAFB] relative overflow-hidden">
        <KnowledgeGraph :data="activeGraph" @nodeClick="setSelectedNode" />
        
        <!-- Node Details Sub-panel -->
        <div
          v-if="selectedNode"
          class="absolute top-8 right-8 w-80 bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden flex flex-col z-10"
        >
          <header class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-blue-500"></div>
              节点详情
            </h3>
            <button 
              @click="selectedNode = null"
              class="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
            >
              <X class="w-4 h-4" />
            </button>
          </header>
          <div class="p-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">名称</label>
              <p class="text-lg font-bold text-slate-800">{{ selectedNode.label }}</p>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">分类</label>
              <span class="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                {{ selectedNode.category || '默认' }}
              </span>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">关联节点</label>
              <div class="flex flex-wrap gap-2">
                <template v-if="getNeighbors(selectedNode.id).length > 0">
                  <span 
                    v-for="(label, i) in getNeighbors(selectedNode.id)" 
                    :key="i" 
                    class="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200"
                  >
                    {{ label }}
                  </span>
                </template>
                <p v-else class="text-xs text-slate-400 italic">暂无关联节点</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="p-6 bg-white border-t border-slate-100 flex items-center justify-between px-8">
        <div class="flex gap-6">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">{{ activeGraph.nodes.length }} 节点</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">{{ activeGraph.links.length }} 关系</span>
          </div>
        </div>
        <p class="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
          Interactive KG Engine
        </p>
      </footer>
    </div>

    <!-- Image Preview Modal -->
    <div
      v-if="previewImage"
      class="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 md:p-12"
      @click="previewImage = null"
    >
      <button 
        class="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors"
        @click="previewImage = null"
      >
        <X class="w-8 h-8" />
      </button>
      <img
        :src="previewImage"
        alt="Full preview"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { 
  Send, Bot, User, Loader2, Trash2, Network, History, Plus, 
  ChevronLeft, ChevronRight, LayoutPanelLeft, ArrowUp, Mic, MicOff, 
  Paperclip, X, FileText, Image as ImageIcon, Maximize2, Minimize2, 
  Sparkles, ChevronDown 
} from 'lucide-vue-next';
import { marked } from 'marked';
import { askQuestion, type ChatResponse, type GraphData, type Node as KGNode, type Link as KGLink } from './services/geminiService';
import KnowledgeGraph from './components/KnowledgeGraph.vue';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  deltaGraph?: GraphData;
  graph?: GraphData;
  attachments?: string[];
}

interface HistorySession {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
  activeGraph: GraphData | null;
}

const DOMAINS = [
  "现代通信技术",
  "智能制造",
  "机械制造及自动化",
  "智能焊接技术",
  "汽车制造与试验技术",
  "信息安全技术应用",
  "园林技术",
  "食品智能加工技术",
  "公共艺术设计"
];

const DOMAIN_QUESTIONS: Record<string, string[]> = {
  "现代通信技术": [
    "《5G基站建设与维护》课程覆盖了通信网络优化工程师岗位的哪些技能要求？",
    "《5G基站建设与维护》课程对应哪些国家职业技能标准及技能模块？",
    "6G技术相比5G有哪些核心突破点？"
  ],
  "智能制造": [
    "工业4.0背景下，智能工厂的核心架构包含哪些层级？",
    "工业机器人在自动化生产线中的路径规划算法有哪些？",
    "数字化孪生技术如何提升制造企业的生产效率？"
  ],
  "机械制造及自动化": [
    "现代数控加工中心（CNC）的五轴联动技术有哪些优势？",
    "机械设计中，如何平衡零件的强度与轻量化需求？",
    "自动化生产线中的传感器选型标准是什么？"
  ],
  "智能焊接技术": [
    "激光焊接与传统电弧焊在汽车制造中的应用差异？",
    "焊接机器人的视觉识别系统如何实现焊缝自动跟踪？",
    "智能焊接云平台如何实现焊接质量的远程监控？"
  ],
  "汽车制造与试验技术": [
    "新能源汽车电池管理系统（BMS）的关键技术指标有哪些？",
    "自动驾驶L3级别对车载传感器融合方案的要求是什么？",
    "汽车碰撞试验中，如何通过仿真模拟优化车身结构？"
  ],
  "信息安全技术应用": [
    "零信任架构（Zero Trust）在企业内网安全中的实施步骤？",
    "等级保护2.0标准对云计算平台有哪些特定的安全要求？",
    "常见的勒索病毒防御策略及应急响应流程？"
  ],
  "园林技术": [
    "海绵城市建设中，园林景观如何实现雨水的收集与再利用？",
    "现代智慧园林系统如何利用物联网技术进行植物养护？",
    "岭南园林与江南园林在造园艺术风格上的主要区别？"
  ],
  "食品智能加工技术": [
    "食品冷链物流中，智能温控系统如何确保食品安全？",
    "超高压灭菌技术（HPP）在果汁加工中的应用优势？",
    "食品包装自动化生产线中的视觉检测剔除系统原理？"
  ],
  "公共艺术设计": [
    "城市公共艺术装置如何与周围建筑环境实现和谐共生？",
    "沉浸式新媒体艺术在商业空间设计中的应用案例？",
    "社区微更新项目中，公共艺术如何提升居民的归属感？"
  ]
};

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Flash 3.0', desc: '极速版 - 响应迅速，适合快速问答和基础图谱构建。' },
  { id: 'gemini-3.1-pro-preview', name: 'Pro 3.1', desc: '增强版 - 逻辑推理更强，适合复杂知识点分析和深度图谱生成。' },
  { id: 'gemini-flash-lite-latest', name: 'Flash Lite', desc: '轻量版 - 极致轻盈，适合简单咨询。' },
];

const sessions = ref<HistorySession[]>([]);
const currentSessionId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const input = ref('');
const isLoading = ref(false);
const activeGraph = ref<GraphData | null>(null);
const isSidebarOpen = ref(true);
const isRecording = ref(false);
const attachments = ref<{ file: File, preview: string }[]>([]);
const expandedThinking = ref<Record<number, boolean>>({});
const isGraphFullScreen = ref(false);
const selectedNode = ref<KGNode | null>(null);
const previewImage = ref<string | null>(null);
const selectedDomain = ref(DOMAINS[0]);
const isDomainDropdownOpen = ref(false);
const selectedModel = ref('gemini-3-flash-preview');
const isModelDropdownOpen = ref(false);

const messagesContainerRef = ref<HTMLDivElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
let recognition: any = null;

onMounted(() => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      input.value += transcript;
      isRecording.value = false;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      isRecording.value = false;
    };

    recognition.onend = () => {
      isRecording.value = false;
    };
  }

  const saved = localStorage.getItem('kg_sessions');
  if (saved) {
    try {
      sessions.value = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse sessions', e);
    }
  }
});

watch(sessions, (newSessions) => {
  localStorage.setItem('kg_sessions', JSON.stringify(newSessions));
}, { deep: true });

watch(messages, () => {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  });
}, { deep: true });

const createNewSession = () => {
  messages.value = [];
  activeGraph.value = null;
  currentSessionId.value = null;
  attachments.value = [];
  selectedNode.value = null;
};

const saveToHistory = (newMessages: Message[], graph: GraphData | null) => {
  const title = newMessages.find(m => m.role === 'user')?.content.slice(0, 30) || '新对话';
  
  if (currentSessionId.value) {
    sessions.value = sessions.value.map(s => s.id === currentSessionId.value ? {
      ...s,
      messages: newMessages,
      activeGraph: graph,
      timestamp: Date.now()
    } : s);
  } else {
    const newId = Date.now().toString();
    currentSessionId.value = newId;
    sessions.value = [{
      id: newId,
      title,
      timestamp: Date.now(),
      messages: newMessages,
      activeGraph: graph
    }, ...sessions.value].slice(0, 100);
  }
};

const loadSession = (session: HistorySession) => {
  currentSessionId.value = session.id;
  messages.value = session.messages;
  activeGraph.value = session.activeGraph;
  attachments.value = [];
  selectedNode.value = null;
};

const deleteSession = (id: string) => {
  sessions.value = sessions.value.filter(s => s.id !== id);
  if (currentSessionId.value === id) {
    createNewSession();
  }
};

const toggleRecording = () => {
  if (isRecording.value) {
    recognition?.stop();
  } else {
    try {
      recognition?.start();
      isRecording.value = true;
    } catch (e) {
      console.error('Failed to start recognition', e);
    }
  }
};

const handleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  const newAttachments = files.map(file => ({
    file,
    preview: URL.createObjectURL(file)
  }));
  attachments.value = [...attachments.value, ...newAttachments];
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const removeAttachment = (index: number) => {
  URL.revokeObjectURL(attachments.value[index].preview);
  attachments.value.splice(index, 1);
};

const mergeGraphs = (base: GraphData | null, addition: GraphData): GraphData => {
  if (!base) return addition;
  
  const nodesMap = new Map<string, KGNode>();
  const labelToIdMap = new Map<string, string>();
  const idRedirectMap = new Map<string, string>();

  base.nodes.forEach(n => {
    nodesMap.set(n.id, n);
    labelToIdMap.set(n.label.toLowerCase().trim(), n.id);
  });

  addition.nodes.forEach(n => {
    const normalizedLabel = n.label.toLowerCase().trim();
    if (labelToIdMap.has(normalizedLabel)) {
      const existingId = labelToIdMap.get(normalizedLabel)!;
      idRedirectMap.set(n.id, existingId);
    } else {
      nodesMap.set(n.id, n);
      labelToIdMap.set(normalizedLabel, n.id);
    }
  });

  const linksMap = new Map<string, KGLink>();
  const getLinkKey = (l: any) => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return `${sourceId}-${targetId}-${l.label}`;
  };

  base.links.forEach(l => linksMap.set(getLinkKey(l), l));

  addition.links.forEach(l => {
    if (!l.source || !l.target) return;
    
    const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
    const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
    
    const redirectedSource = idRedirectMap.get(sourceId) || sourceId;
    const redirectedTarget = idRedirectMap.get(targetId) || targetId;

    const newLink: KGLink = {
      ...l,
      source: redirectedSource,
      target: redirectedTarget
    };
    
    linksMap.set(getLinkKey(newLink), newLink);
  });
  
  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values())
  };
};

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    handleSubmit();
  }
};

const handleSubmit = async () => {
  if ((!input.value.trim() && attachments.value.length === 0) || isLoading.value) return;

  const userMessage = input.value.trim();
  const currentAttachments = [...attachments.value];
  
  input.value = '';
  attachments.value = [];
  
  const newMessages: Message[] = [...messages.value, { 
    role: 'user', 
    content: userMessage,
    attachments: currentAttachments.map(a => a.preview)
  }];
  messages.value = newMessages;
  isLoading.value = true;

  try {
    const history = messages.value.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const assistantMessagesWithGraphs = messages.value.filter(m => m.role === 'assistant' && m.deltaGraph);
    const recentAssistantMessages = assistantMessagesWithGraphs.slice(-4);
    let contextGraph: GraphData | null = null;
    recentAssistantMessages.forEach(m => {
      if (m.deltaGraph) {
        contextGraph = mergeGraphs(contextGraph, m.deltaGraph);
      }
    });

    let prompt = userMessage;
    if (currentAttachments.length > 0) {
      prompt += `\n\n(用户上传了 ${currentAttachments.length} 个附件，请在回答中提及您已收到并根据这些内容进行回答。)`;
    }

    const response: ChatResponse = await askQuestion(prompt, history as any, contextGraph || undefined, selectedDomain.value, selectedModel.value);
    
    let newWindowedGraph: GraphData | null = contextGraph;
    if (response.graph) {
      newWindowedGraph = mergeGraphs(contextGraph, response.graph);
    }

    const assistantMessage: Message = { 
      role: 'assistant', 
      content: response.answer,
      thinking: response.thinking,
      deltaGraph: response.graph,
      graph: newWindowedGraph || undefined 
    };
    
    const finalMessages = [...newMessages, assistantMessage];
    messages.value = finalMessages;
    
    if (newWindowedGraph) {
      activeGraph.value = newWindowedGraph;
    }
    
    saveToHistory(finalMessages, newWindowedGraph);
  } catch (error) {
    console.error('Error:', error);
    messages.value = [...messages.value, { 
      role: 'assistant', 
      content: '抱歉，处理您的问题时出现了错误。请稍后再试。' 
    }];
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

const toggleThinking = (index: number) => {
  expandedThinking.value = {
    ...expandedThinking.value,
    [index]: !expandedThinking.value[index]
  };
};

const getNeighbors = (nodeId: string) => {
  if (!activeGraph.value) return [];
  const neighbors = new Set<string>();
  activeGraph.value.links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    
    if (sourceId === nodeId) {
      const targetNode = activeGraph.value!.nodes.find(n => n.id === targetId);
      if (targetNode) neighbors.add(targetNode.label);
    } else if (targetId === nodeId) {
      const sourceNode = activeGraph.value!.nodes.find(n => n.id === sourceId);
      if (sourceNode) neighbors.add(sourceNode.label);
    }
  });
  return Array.from(neighbors);
};

const selectDomain = (domain: string) => {
  if (domain !== selectedDomain.value) {
    selectedDomain.value = domain;
    createNewSession();
  }
  isDomainDropdownOpen.value = false;
};

const selectModel = (modelId: string) => {
  selectedModel.value = modelId;
  isModelDropdownOpen.value = false;
};

const closeGraph = () => {
  activeGraph.value = null;
  isGraphFullScreen.value = false;
  selectedNode.value = null;
};

const setSelectedNode = (node: KGNode | null) => {
  selectedNode.value = node;
};

const renderMarkdown = (text: string) => {
  return marked(text);
};
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
