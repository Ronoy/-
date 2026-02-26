import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Node {
  id: string;
  label: string;
  category?: string;
}

export interface Link {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface ChatResponse {
  thinking: string;
  answer: string;
  graph: GraphData;
}

export async function askQuestion(
  question: string, 
  history: { role: string; parts: { text: string }[] }[] = [],
  currentGraph?: GraphData,
  domain: string = "通用领域",
  model: string = "gemini-3-flash-preview"
): Promise<ChatResponse> {
  const graphContext = currentGraph 
    ? `当前已有的知识图谱节点: ${currentGraph.nodes.map(n => `${n.label}(ID:${n.id})`).join(', ')}。
       
       【重要指令】：
       1. 语义融合：如果新提取的实体与已有实体在语义上相同（即使名称略有差异），请务必复用已有的 ID。
       2. 建立关联：主动寻找新提取的实体与已有实体之间的逻辑联系，并在 links 中体现这些跨轮次的关联。
       3. 保持一致：确保新生成的节点分类与已有同类节点的分类保持一致。`
    : "";

  const response = await ai.models.generateContent({
    model: model,
    contents: [
      ...history,
      { role: "user", parts: [{ text: question }] }
    ],
    config: {
      systemInstruction: `你是一个${domain}领域的知识图谱专家。你的任务是回答用户的问题，并从回答中提取出实体和它们之间的关系，以构建一个知识图谱。
      
      当前领域：${domain}
      
      ${graphContext}

      请以 JSON 格式返回结果，包含以下字段：
      1. thinking: 详细的思考过程。描述你如何分析问题、提取实体以及构建关系的逻辑。
      2. answer: 对用户问题的详细文本回答（支持 Markdown）。
      3. graph: 包含 nodes 和 links 的对象。
         - nodes: 数组，每个对象包含 id (唯一标识), label (显示名称) 和 category (分类名称，如“人物”、“技术”、“课程”等)。
         - links: 数组，每个对象包含 source (源节点 id), target (目标节点 id) 和 label (关系名称)。
      
      确保图谱准确反映了回答中的核心知识点，并为节点分配合理的分类。`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          thinking: { type: Type.STRING, description: "详细的思考过程" },
          answer: { type: Type.STRING },
          graph: {
            type: Type.OBJECT,
            properties: {
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    category: { type: Type.STRING, description: "节点的分类名称" }
                  },
                  required: ["id", "label", "category"]
                }
              },
              links: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                    label: { type: Type.STRING }
                  },
                  required: ["source", "target", "label"]
                }
              }
            },
            required: ["nodes", "links"]
          }
        },
        required: ["thinking", "answer", "graph"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return result as ChatResponse;
}
