import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, Node, Link } from '../services/geminiService';

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (node: Node) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node & d3.SimulationNodeDatum, undefined>>(null);

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
      .force('link', d3.forceLink<Node & d3.SimulationNodeDatum, Link & d3.SimulationLinkDatum<any>>(data.links as any).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    simulationRef.current = simulation as any;

    // Arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#94a3b8')
      .style('stroke', 'none');

    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    const linkText = svg.append('g')
      .selectAll('text')
      .data(data.links)
      .enter().append('text')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .attr('font-weight', '500')
      .text(d => d.label);

    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onNodeClick) onNodeClick(d as Node);
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
      .attr('class', 'shadow-sm');

    node.append('text')
      .attr('dy', 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1e293b')
      .text(d => d.label);

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
        .attr('font-weight', '500')
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
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

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

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-4 right-4 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
        Interactive Knowledge Graph
      </div>
    </div>
  );
};

export default KnowledgeGraph;
