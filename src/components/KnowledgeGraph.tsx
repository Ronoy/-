import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw, Network, GitBranch, LayoutGrid } from 'lucide-react';
import { GraphData, Node, Link } from '../services/geminiService';

type LayoutType = 'force' | 'tree' | 'treemap';

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (node: Node) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node & d3.SimulationNodeDatum, undefined>>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [layout, setLayout] = useState<LayoutType>('force');

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Color scale for categories
    const categories = Array.from(new Set(data.nodes.map(n => n.category || '默认')));
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(categories);

    // Create a container group for zooming
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    (zoomRef as any).current = zoom;

    // Arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#94a3b8')
      .style('stroke', 'none');

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const labelGroup = g.append('g').attr('class', 'labels');

    if (layout === 'force') {
      const simulation = d3.forceSimulation<Node & d3.SimulationNodeDatum>(data.nodes as any)
        .force('link', d3.forceLink<Node & d3.SimulationNodeDatum, Link & d3.SimulationLinkDatum<any>>(data.links as any).id(d => d.id).distance(180))
        .force('charge', d3.forceManyBody().strength(-800))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(80));

      simulationRef.current = simulation as any;

      const link = linkGroup
        .selectAll('line')
        .data(data.links)
        .enter().append('line')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('marker-end', 'url(#arrowhead)');

      const linkText = labelGroup
        .selectAll('g')
        .data(data.links)
        .enter().append('g');

      linkText.append('rect')
        .attr('fill', '#f8fafc')
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('opacity', 0.9);

      linkText.append('text')
        .attr('font-size', '10px')
        .attr('fill', '#64748b')
        .attr('text-anchor', 'middle')
        .attr('font-weight', '600')
        .text(d => d.label)
        .each(function() {
          const bbox = (this as SVGTextElement).getBBox();
          const padding = 4;
          d3.select((this as any).parentNode).select('rect')
            .attr('x', bbox.x - padding)
            .attr('y', bbox.y - padding)
            .attr('width', bbox.width + padding * 2)
            .attr('height', bbox.height + padding * 2);
        });

      const node = nodeGroup
        .selectAll('g')
        .data(data.nodes)
        .enter().append('g')
        .attr('cursor', 'pointer')
        .on('click', (event, d) => {
          if (onNodeClick) onNodeClick(d as Node);
        })
        .on('mouseover', function(event, d) {
          const connectedNodeIds = new Set<string>();
          connectedNodeIds.add(d.id);
          
          data.links.forEach(l => {
            const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
            if (sId === d.id) connectedNodeIds.add(tId);
            if (tId === d.id) connectedNodeIds.add(sId);
          });

          node.style('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.1);
          link.style('opacity', (l: any) => {
            const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return (sId === d.id || tId === d.id) ? 1 : 0.1;
          });
          linkText.style('opacity', (l: any) => {
            const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return (sId === d.id || tId === d.id) ? 1 : 0.1;
          });
          
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 28)
            .attr('stroke-width', 5);
        })
        .on('mouseout', function() {
          node.style('opacity', 1);
          link.style('opacity', 1);
          linkText.style('opacity', 1);
          
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 22)
            .attr('stroke-width', 3);
        })
        .call(d3.drag<any, any>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('circle')
        .attr('r', 22)
        .attr('fill', d => colorScale(d.category || '默认'))
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

      node.append('text')
        .attr('dy', 42)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('fill', '#1e293b')
        .text(d => d.label)
        .style('paint-order', 'stroke')
        .style('stroke', '#fff')
        .style('stroke-width', '3px')
        .style('stroke-linecap', 'round')
        .style('stroke-linejoin', 'round');

      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        linkText
          .attr('transform', (d: any) => `translate(${(d.source.x + d.target.x) / 2}, ${(d.source.y + d.target.y) / 2})`);

        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
    } else if (layout === 'tree') {
      // Tree Layout
      // 1. Build hierarchy from flat data with a virtual root to ensure all nodes are included
      const nodeMap = new Map(data.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
      
      // Find nodes that are not targets of any link (potential roots)
      const targetIds = new Set(data.links.map(l => typeof l.target === 'object' ? (l.target as any).id : l.target));
      const potentialRoots = data.nodes.filter(n => !targetIds.has(n.id));
      
      // If everything is in a cycle, use the first node as a fallback root
      const roots = potentialRoots.length > 0 ? potentialRoots : [data.nodes[0]];
      
      const virtualRoot = { id: 'virtual-root', label: '知识体系', children: [] as any[] };
      const visited = new Set<string>();

      const buildTree = (currentId: string, parentNode: any) => {
        if (visited.has(currentId)) return;
        visited.add(currentId);
        
        const nodeData = nodeMap.get(currentId)!;
        parentNode.children.push(nodeData);

        data.links.forEach(link => {
          const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
          const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
          if (sId === currentId && !visited.has(tId)) {
            buildTree(tId, nodeData);
          }
        });
      };

      roots.forEach(root => buildTree(root.id, virtualRoot));
      
      // Add any remaining unvisited nodes
      data.nodes.forEach(node => {
        if (!visited.has(node.id)) {
          buildTree(node.id, virtualRoot);
        }
      });

      const hierarchy = d3.hierarchy(virtualRoot);
      // Use nodeSize for consistent, wider spacing regardless of node count
      // [vertical spacing, horizontal spacing]
      const treeLayout = d3.tree<any>().nodeSize([120, 350]);
      const treeData = treeLayout(hierarchy);

      // Filter out virtual root for rendering links
      const links = treeData.links().filter(d => d.source.data.id !== 'virtual-root');

      const link = linkGroup
        .selectAll('path')
        .data(links)
        .enter().append('path')
        .attr('d', d3.linkHorizontal()
          .x((d: any) => d.y)
          .y((d: any) => d.x) as any)
        .attr('fill', 'none')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6);

      // Filter out virtual root for rendering nodes
      const nodes = treeData.descendants().filter(d => d.data.id !== 'virtual-root');

      const node = nodeGroup
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('transform', (d: any) => `translate(${d.y},${d.x})`)
        .attr('cursor', 'pointer')
        .on('click', (event, d) => {
          if (onNodeClick) onNodeClick(d.data as Node);
        });

      // Center the tree initially if it's the first render or layout change
      if (zoomRef.current && svgRef.current) {
        const t = d3.zoomIdentity.translate(width / 4, height / 2).scale(0.8);
        d3.select(svgRef.current).call(zoomRef.current.transform, t);
      }

      node.append('circle')
        .attr('r', 22)
        .attr('fill', (d: any) => colorScale(d.data.category || '默认'))
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

      node.append('text')
        .attr('dy', 42)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('fill', '#1e293b')
        .text((d: any) => d.data.label)
        .style('paint-order', 'stroke')
        .style('stroke', '#fff')
        .style('stroke-width', '3px');
    } else if (layout === 'treemap') {
      // Treemap Layout
      // 1. Build hierarchy with virtual root
      const nodeMap = new Map(data.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
      const virtualRoot = { id: 'virtual-root', label: 'Root', children: [] as any[] };
      
      // For treemap, we can just group by category as a simple hierarchy if it's not a strict tree
      const categoryMap = new Map<string, any>();
      data.nodes.forEach(node => {
        const cat = node.category || '其他';
        if (!categoryMap.has(cat)) {
          const catNode = { id: `cat-${cat}`, label: cat, children: [] as any[] };
          categoryMap.set(cat, catNode);
          virtualRoot.children.push(catNode);
        }
        categoryMap.get(cat).children.push({ ...node, value: 1 });
      });

      const hierarchy = d3.hierarchy(virtualRoot)
        .sum((d: any) => d.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const treemapLayout = d3.treemap<any>()
        .size([width - 40, height - 40])
        .paddingOuter(10)
        .paddingTop(25)
        .paddingInner(4)
        .round(true);

      const treemapData = treemapLayout(hierarchy);

      const cell = nodeGroup
        .selectAll('g')
        .data(treemapData.leaves())
        .enter().append('g')
        .attr('transform', (d: any) => `translate(${d.x0 + 20},${d.y0 + 20})`)
        .attr('cursor', 'pointer')
        .on('click', (event, d) => {
          if (onNodeClick) onNodeClick(d.data as Node);
        });

      cell.append('rect')
        .attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
        .attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
        .attr('fill', (d: any) => colorScale(d.data.category || '默认'))
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('opacity', 0.8)
        .on('mouseover', function() {
          d3.select(this).transition().duration(200).style('opacity', 1);
        })
        .on('mouseout', function() {
          d3.select(this).transition().duration(200).style('opacity', 0.8);
        });

      cell.append('text')
        .attr('x', 8)
        .attr('y', 20)
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('fill', '#fff')
        .text((d: any) => d.data.label)
        .each(function(d: any) {
          const self = d3.select(this);
          const rectWidth = d.x1 - d.x0;
          const rectHeight = d.y1 - d.y0;
          if (rectWidth < 50 || rectHeight < 25) self.style('display', 'none');
        });
    }

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(20, 20)`);

    categories.forEach((cat, i) => {
      const g = legend.append('g')
        .attr('transform', `translate(0, ${i * 25})`);
      
      g.append('circle')
        .attr('r', 6)
        .attr('fill', colorScale(cat));
      
      g.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#64748b')
        .text(cat);
    });

    // Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (layout === 'force' && simulationRef.current) {
          simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
          simulationRef.current.alpha(0.3).restart();
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      resizeObserver.disconnect();
    };
  }, [data, layout]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.75);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Layout & Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm p-1 mb-2">
          <button 
            onClick={() => setLayout('force')}
            className={`p-1.5 rounded-md transition-all ${layout === 'force' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="力导向图 (Force-Directed)"
          >
            <Network className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setLayout('tree')}
            className={`p-1.5 rounded-md transition-all ${layout === 'tree' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="树状图 (Tree Diagram)"
          >
            <GitBranch className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setLayout('treemap')}
            className={`p-1.5 rounded-md transition-all ${layout === 'treemap' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="矩形树图 (Treemap)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <button 
          onClick={handleZoomIn}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-slate-500"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-slate-500"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={handleReset}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-slate-500"
          title="重置视图"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-4 right-4 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
        Interactive Knowledge Graph
      </div>
    </div>
  );
};

export default KnowledgeGraph;
