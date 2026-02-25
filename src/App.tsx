import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Loader2, Trash2, Network, History, Plus, ChevronLeft, ChevronRight, LayoutPanelLeft, ArrowUp, Mic, MicOff, Paperclip, X, FileText, Image as ImageIcon, Maximize2, Minimize2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { askQuestion, ChatResponse, GraphData, Node as KGNode, Link as KGLink } from './services/geminiService';
import KnowledgeGraph from './components/KnowledgeGraph';

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

// Speech Recognition Type Definitions
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
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

export default function App() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeGraph, setActiveGraph] = useState<GraphData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File, preview: string }[]>([]);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS[0]);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kg_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
      } catch (e) {
        console.error('Failed to parse sessions', e);
      }
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem('kg_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewSession = () => {
    setMessages([]);
    setActiveGraph(null);
    setCurrentSessionId(null);
    setAttachments([]);
    setSelectedNode(null);
  };

  const saveToHistory = (newMessages: Message[], graph: GraphData | null) => {
    const title = newMessages.find(m => m.role === 'user')?.content.slice(0, 30) || '新对话';
    
    setSessions(prev => {
      let updated;
      if (currentSessionId) {
        updated = prev.map(s => s.id === currentSessionId ? {
          ...s,
          messages: newMessages,
          activeGraph: graph,
          timestamp: Date.now()
        } : s);
      } else {
        const newId = Date.now().toString();
        setCurrentSessionId(newId);
        updated = [{
          id: newId,
          title,
          timestamp: Date.now(),
          messages: newMessages,
          activeGraph: graph
        }, ...prev];
      }
      return updated.slice(0, 100);
    });
  };

  const loadSession = (session: HistorySession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setActiveGraph(session.activeGraph);
    setAttachments([]);
    setSelectedNode(null);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      createNewSession();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recognition', e);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const mergeGraphs = (base: GraphData | null, addition: GraphData): GraphData => {
    if (!base) return addition;
    
    const nodesMap = new Map<string, KGNode>();
    const labelToIdMap = new Map<string, string>();
    const idRedirectMap = new Map<string, string>();

    // 1. Process base nodes
    base.nodes.forEach(n => {
      nodesMap.set(n.id, n);
      labelToIdMap.set(n.label.toLowerCase().trim(), n.id);
    });

    // 2. Process addition nodes with label-based merging
    addition.nodes.forEach(n => {
      const normalizedLabel = n.label.toLowerCase().trim();
      if (labelToIdMap.has(normalizedLabel)) {
        // Semantic match found, redirect this node's ID to the existing one
        const existingId = labelToIdMap.get(normalizedLabel)!;
        idRedirectMap.set(n.id, existingId);
      } else {
        // New node
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

    // 3. Process base links
    base.links.forEach(l => linksMap.set(getLinkKey(l), l));

    // 4. Process addition links with ID redirection
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    
    const newMessages: Message[] = [...messages, { 
      role: 'user', 
      content: userMessage,
      attachments: currentAttachments.map(a => a.preview)
    }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Calculate context graph from last 4 assistant messages (to make 5 with the new one)
      const assistantMessagesWithGraphs = messages.filter(m => m.role === 'assistant' && m.deltaGraph);
      const recentAssistantMessages = assistantMessagesWithGraphs.slice(-4);
      let contextGraph: GraphData | null = null;
      recentAssistantMessages.forEach(m => {
        if (m.deltaGraph) {
          contextGraph = mergeGraphs(contextGraph, m.deltaGraph);
        }
      });

      // Note: In a real app, we would send the actual file data to Gemini.
      // For this demo, we'll append a note to the prompt if there are attachments.
      let prompt = userMessage;
      if (currentAttachments.length > 0) {
        prompt += `\n\n(用户上传了 ${currentAttachments.length} 个附件，请在回答中提及您已收到并根据这些内容进行回答。)`;
      }

      const response: ChatResponse = await askQuestion(prompt, history as any, contextGraph || undefined, selectedDomain);
      
      // Calculate new windowed graph (last 5 turns including this one)
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
      setMessages(finalMessages);
      
      if (newWindowedGraph) {
        setActiveGraph(newWindowedGraph);
      }
      
      saveToHistory(finalMessages, newWindowedGraph);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '抱歉，处理您的问题时出现了错误。请稍后再试。' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  };

  const toggleThinking = (index: number) => {
    setExpandedThinking(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getNeighbors = (nodeId: string) => {
    if (!activeGraph) return [];
    const neighbors = new Set<string>();
    activeGraph.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      
      if (sourceId === nodeId) {
        const targetNode = activeGraph.nodes.find(n => n.id === targetId);
        if (targetNode) neighbors.add(targetNode.label);
      } else if (targetId === nodeId) {
        const sourceNode = activeGraph.nodes.find(n => n.id === sourceId);
        if (sourceNode) neighbors.add(sourceNode.label);
      }
    });
    return Array.from(neighbors);
  };

  return (
    <div className="flex h-screen bg-[#F7F7F7] text-[#333] font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-[#F7F7F7] flex flex-col border-r border-[#E5E5E5] overflow-hidden"
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">职教百问</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 mb-6">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 bg-white border border-[#E5E5E5] py-4 rounded-full shadow-sm hover:shadow-md transition-all font-medium text-sm"
          >
            <Plus className="w-5 h-5" />
            开启新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6 custom-scrollbar">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => loadSession(session)}
              className={`group flex flex-col p-4 rounded-2xl cursor-pointer transition-all ${
                currentSessionId === session.id 
                  ? 'bg-white shadow-sm border border-blue-100' 
                  : 'hover:bg-white/60 text-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold line-clamp-2 leading-relaxed">{session.title}</span>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-2">{formatDate(session.timestamp)}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Toggle Sidebar Button (When closed) */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-6 z-50 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <LayoutPanelLeft className="w-5 h-5 text-slate-500" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 bg-white relative overflow-hidden">
        {/* Top Header */}
        <header className="px-8 py-6 flex items-center gap-4 relative z-40">
          <div className="relative">
            <button 
              onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
              className="flex items-center gap-3 px-6 py-2.5 bg-white rounded-full border border-[#E5E5E5] hover:bg-slate-50 transition-all shadow-sm group"
            >
              <span className="text-base font-medium text-slate-700">{selectedDomain}</span>
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDomainDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
            </button>

            <AnimatePresence>
              {isDomainDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsDomainDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-3 w-72 bg-white rounded-[24px] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] py-3 z-20 overflow-hidden"
                  >
                    <div className="px-5 py-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">选择专业领域</span>
                    </div>
                    {DOMAINS.map((domain) => (
                      <button
                        key={domain}
                        onClick={() => {
                          setSelectedDomain(domain);
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full text-left px-6 py-3.5 text-[15px] transition-all flex items-center justify-between group ${
                          selectedDomain === domain 
                            ? 'bg-blue-50/50 text-blue-600 font-bold' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="group-hover:translate-x-1 transition-transform">{domain}</span>
                        {selectedDomain === domain && (
                          <motion.div 
                            layoutId="active-dot"
                            className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                          />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-48 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20 space-y-8">
              <h2 className="text-3xl font-bold text-slate-800">{selectedDomain}</h2>
              <div className="w-full max-w-2xl space-y-4">
                <div className="bg-[#F7F7F7] p-6 rounded-3xl rounded-tl-none inline-block max-w-[80%]">
                  <p className="text-slate-700">你好呀，我是职教百问，你想了解什么呢？</p>
                </div>
                <div className="space-y-3">
                  {(DOMAIN_QUESTIONS[selectedDomain] || []).slice(0, 3).map((q, i) => (
                    <button 
                      key={i}
                      onClick={() => { setInput(q); }}
                      className="block w-full text-left p-4 border border-[#E5E5E5] rounded-2xl hover:bg-slate-50 transition-colors text-slate-600 text-sm leading-relaxed"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8 pt-10">
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[90%] rounded-3xl px-6 py-4 ${
                      message.role === 'user' 
                        ? 'bg-blue-500 text-white rounded-tr-none shadow-sm' 
                        : 'bg-[#F7F7F7] text-slate-800 rounded-tl-none'
                    }`}>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {message.attachments.map((url, i) => (
                            <img 
                              key={i} 
                              src={url} 
                              alt="attachment" 
                              className="w-20 h-20 object-cover rounded-lg border border-white/20 cursor-zoom-in hover:opacity-90 transition-opacity" 
                              onClick={() => setPreviewImage(url)}
                            />
                          ))}
                        </div>
                      )}

                      {message.thinking && message.role === 'assistant' && (
                        <div className="mb-4 border-l-2 border-slate-300 pl-4 py-1">
                          <button 
                            onClick={() => toggleThinking(index)}
                            className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors"
                          >
                            <Bot className="w-3 h-3" />
                            {expandedThinking[index] ? '隐藏思考过程' : '查看思考过程'}
                          </button>
                          <AnimatePresence>
                            {expandedThinking[index] && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-2 text-xs text-slate-500 italic leading-relaxed bg-white/50 p-3 rounded-xl border border-slate-200">
                                  {message.thinking}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none prose-slate">
                        <Markdown>{message.content}</Markdown>
                      </div>
                      {message.graph && (
                        <button 
                          onClick={() => setActiveGraph(message.graph!)}
                          className={`mt-4 flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-full transition-all ${
                            message.role === 'user'
                              ? 'bg-white/20 hover:bg-white/30 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          <Network className="w-4 h-4" />
                          查看关联图谱
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="bg-[#F7F7F7] rounded-3xl rounded-tl-none px-6 py-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500 font-medium">正在思考并构建图谱...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-8 flex flex-col items-center">
          <div className="w-full max-w-4xl relative">
            <div className="bg-white border-2 border-blue-100 rounded-3xl shadow-xl shadow-blue-500/5 p-4 min-h-[120px] flex flex-col">
              {/* Attachment Previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 px-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group">
                      <img 
                        src={att.preview} 
                        alt="preview" 
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity" 
                        onClick={() => setPreviewImage(att.preview)}
                      />
                      <button 
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={isRecording ? "正在倾听..." : "通过提问，探索世界..."}
                className={`w-full flex-1 bg-transparent border-none focus:ring-0 resize-none text-slate-700 placeholder:text-slate-400 text-lg p-2 ${isRecording ? 'animate-pulse' : ''}`}
              />
              
              <div className="flex items-center justify-between mt-2 px-2">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    title="上传附件"
                  >
                    <Paperclip className="w-6 h-6" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                  />
                  <button 
                    onClick={toggleRecording}
                    className={`p-2 transition-colors ${isRecording ? 'text-red-500' : 'text-slate-400 hover:text-blue-500'}`}
                    title={isRecording ? "停止录音" : "语音输入"}
                  >
                    {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
                </div>
                
                <button
                  onClick={() => handleSubmit()}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="w-10 h-10 bg-[#A0AEC0] text-white rounded-full flex items-center justify-center hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-[#A0AEC0] transition-all shadow-sm"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400 font-medium tracking-wide">
            内容均由AI生成，请注意辨别
          </p>
        </div>
      </div>

      {/* Graph Panel Overlay */}
      <AnimatePresence>
        {activeGraph && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ 
              x: 0,
              width: isGraphFullScreen ? '100%' : '45%'
            }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 bg-white shadow-2xl z-[100] border-l border-slate-200 flex flex-col"
          >
            <header className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Network className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">知识图谱可视化</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  title={isGraphFullScreen ? "退出全屏" : "全屏预览"}
                >
                  {isGraphFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => {
                    setActiveGraph(null);
                    setIsGraphFullScreen(false);
                    setSelectedNode(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </header>
            
            <div className="flex-1 p-8 bg-[#F9FAFB] relative overflow-hidden">
              <KnowledgeGraph data={activeGraph} onNodeClick={setSelectedNode} />
              
              {/* Node Details Sub-panel */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    className="absolute top-8 right-8 w-80 bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden flex flex-col z-10"
                  >
                    <header className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        节点详情
                      </h3>
                      <button 
                        onClick={() => setSelectedNode(null)}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </header>
                    <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">名称</label>
                        <p className="text-lg font-bold text-slate-800">{selectedNode.label}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">分类</label>
                        <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                          {selectedNode.category || '默认'}
                        </span>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">关联节点</label>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const neighbors = new Set<string>();
                            activeGraph.links.forEach(link => {
                              const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                              const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
                              
                              if (sourceId === selectedNode.id) {
                                const targetNode = activeGraph.nodes.find(n => n.id === targetId);
                                if (targetNode) neighbors.add(targetNode.label);
                              } else if (targetId === selectedNode.id) {
                                const sourceNode = activeGraph.nodes.find(n => n.id === sourceId);
                                if (sourceNode) neighbors.add(sourceNode.label);
                              }
                            });
                            const neighborList = Array.from(neighbors);
                            return neighborList.length > 0 ? neighborList.map((label, i) => (
                              <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200">
                                {label}
                              </span>
                            )) : <p className="text-xs text-slate-400 italic">暂无关联节点</p>;
                          })()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="p-6 bg-white border-t border-slate-100 flex items-center justify-between px-8">
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{activeGraph.nodes.length} 节点</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{activeGraph.links.length} 关系</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
                Interactive KG Engine
              </p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 md:p-12"
            onClick={() => setPreviewImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={previewImage}
              alt="Full preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
