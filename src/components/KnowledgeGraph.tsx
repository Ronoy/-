import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { GraphData, Node, Link } from '../services/geminiService';

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (node: Node) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node & d3.SimulationNodeDatum, undefined>>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Color scale for categories
    const categories = Array.from(new Set(data.nodes.map(n => n.category || '默认')));
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(categories);

    const simulation = d3.forceSimulation<Node & d3.SimulationNodeDatum>(data.nodes as any)
      .force('link', d3.forceLink<Node & d3.SimulationNodeDatum, Link & d3.SimulationLinkDatum<any>>(data.links as any).id(d => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(80));

    simulationRef.current = simulation as any;

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

    // Resize Observer to handle full-screen toggle
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (simulationRef.current) {
          simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
          simulationRef.current.alpha(0.3).restart();
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [data]);

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
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
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
