"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Star } from "lucide-react";
import { type Person, SentimentBadge } from "../components/shared";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Custom Node ─── */
function PersonNode({ data }: { data: any }) {
  const person: Person = data.person;
  const isSelected = data.isLinkTarget;

  return (
    <div
      className={`bg-white rounded-xl border-2 px-4 py-3 shadow-sm min-w-[180px] transition-all ${
        isSelected ? "border-indigo-500 shadow-md" : "border-gray-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-full text-white text-[11px] font-semibold shrink-0 ${
            person.is_champion
              ? "bg-gradient-to-br from-amber-400 to-orange-500"
              : "bg-gray-400"
          }`}
        >
          {getInitials(person.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-medium text-gray-900 truncate">{person.name}</span>
            {person.is_champion && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-gray-500 truncate">{person.role || "No role"}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <SentimentBadge sentiment={person.sentiment} />
        {person.group_name && (
          <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{person.group_name}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

/* ─── Auto-layout with dagre ─── */
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 200, height: 90 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 100, y: pos.y - 45 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ─── Main Component ─── */
interface OrgChartProps {
  people: Person[];
  onPersonClick?: (person: Person) => void;
  onLinkPersons?: (personId: string, managerId: string) => void;
  linkMode?: boolean;
}

export default function OrgChart({
  people,
  onPersonClick,
  onLinkPersons,
  linkMode = false,
}: OrgChartProps) {
  const [linkSource, setLinkSource] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const rawNodes: Node[] = people.map((p) => ({
      id: p.id,
      type: "person",
      data: { person: p, isLinkTarget: linkMode && linkSource === p.id },
      position: { x: 0, y: 0 },
    }));

    const rawEdges: Edge[] = people
      .filter((p) => p.reports_to && people.some((m) => m.id === p.reports_to))
      .map((p) => ({
        id: `e-${p.reports_to}-${p.id}`,
        source: p.reports_to!,
        target: p.id,
        type: "smoothstep",
        style: { stroke: "#d1d5db", strokeWidth: 2 },
      }));

    return getLayoutedElements(rawNodes, rawEdges);
  }, [people, linkMode, linkSource]);

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      const person = people.find((p) => p.id === node.id);
      if (!person) return;

      if (linkMode && onLinkPersons) {
        if (!linkSource) {
          setLinkSource(person.id);
        } else {
          if (linkSource !== person.id) {
            onLinkPersons(linkSource, person.id);
          }
          setLinkSource(null);
        }
      } else if (onPersonClick) {
        onPersonClick(person);
      }
    },
    [people, linkMode, linkSource, onPersonClick, onLinkPersons]
  );

  if (people.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No people to display in org chart.
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      {linkMode && (
        <div className="absolute top-2 left-2 z-10 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 text-[12px] text-indigo-700">
          {linkSource
            ? "Now click the manager to set the reporting relationship"
            : "Click a person to set their manager"}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
