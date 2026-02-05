"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, PencilBrush, FabricObject } from "fabric";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  Square, 
  Circle, 
  Type, 
  ArrowRight,
  Eraser,
  Trash2,
  Save,
  Undo,
  MousePointer
} from "lucide-react";

export type DrawingTool = "select" | "pen" | "arrow" | "rectangle" | "circle" | "text" | "eraser";

interface AnnotationCanvasProps {
  width: number;
  height: number;
  className?: string;
  onSave?: (data: string) => void;
  initialData?: string;
  readOnly?: boolean;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ffffff", // white
];

export function AnnotationCanvas({
  width,
  height,
  className,
  onSave,
  initialData,
  readOnly = false,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("pen");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "transparent",
      selection: !readOnly,
      isDrawingMode: !readOnly && activeTool === "pen",
    });

    // Configure pen brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = 3;

    fabricRef.current = canvas;

    // Load initial data if provided
    if (initialData) {
      canvas.loadFromJSON(JSON.parse(initialData)).then(() => {
        canvas.renderAll();
      });
    }

    // Save state on changes
    const saveState = () => {
      if (readOnly) return;
      const json = JSON.stringify(canvas.toJSON());
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, json];
      });
      setHistoryIndex(prev => prev + 1);
    };

    canvas.on("object:added", saveState);
    canvas.on("object:modified", saveState);
    canvas.on("object:removed", saveState);

    return () => {
      canvas.dispose();
    };
  }, [width, height]);

  // Update drawing mode when tool changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "pen";
    canvas.selection = activeTool === "select";

    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor;
    }
  }, [activeTool, activeColor]);

  // Update brush color
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = activeColor;
  }, [activeColor]);

  // Handle shape drawing
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "rectangle") {
      import("fabric").then(({ Rect }) => {
        const shape = new Rect({
          left: x - 25,
          top: y - 25,
          width: 50,
          height: 50,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 3,
        });
        canvas.add(shape);
        canvas.setActiveObject(shape);
      });
    } else if (activeTool === "circle") {
      import("fabric").then(({ Circle }) => {
        const shape = new Circle({
          left: x - 25,
          top: y - 25,
          radius: 25,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 3,
        });
        canvas.add(shape);
        canvas.setActiveObject(shape);
      });
    } else if (activeTool === "arrow") {
      import("fabric").then(({ Line, Triangle, Group }) => {
        const line = new Line([x, y, x + 80, y], {
          stroke: activeColor,
          strokeWidth: 3,
        });
        const arrowHead = new Triangle({
          left: x + 80,
          top: y,
          width: 15,
          height: 20,
          fill: activeColor,
          angle: 90,
          originX: "center",
          originY: "center",
        });
        const arrow = new Group([line, arrowHead], {
          left: x,
          top: y - 10,
        });
        canvas.add(arrow);
        canvas.setActiveObject(arrow);
      });
    } else if (activeTool === "text") {
      import("fabric").then(({ IText }) => {
        const text = new IText("Note", {
          left: x,
          top: y,
          fontSize: 20,
          fill: activeColor,
          fontFamily: "sans-serif",
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
      });
    }
  }, [activeTool, activeColor, readOnly]);

  // Undo
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const prevState = history[historyIndex - 1];
    canvas.loadFromJSON(JSON.parse(prevState)).then(() => {
      canvas.renderAll();
      setHistoryIndex(prev => prev - 1);
    });
  };

  // Clear canvas
  const handleClear = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "transparent";
    canvas.renderAll();
  };

  // Delete selected
  const handleDelete = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const selected = canvas.getActiveObjects();
    selected.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  };

  // Save annotation
  const handleSave = () => {
    const canvas = fabricRef.current;
    if (!canvas || !onSave) return;
    const json = JSON.stringify(canvas.toJSON());
    onSave(json);
  };

  // Get canvas data
  const getCanvasData = () => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return JSON.stringify(canvas.toJSON());
  };

  const tools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: "select", icon: <MousePointer className="h-4 w-4" />, label: "Select" },
    { tool: "pen", icon: <Pencil className="h-4 w-4" />, label: "Pen" },
    { tool: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
    { tool: "rectangle", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { tool: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { tool: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
  ];

  if (readOnly) {
    return (
      <div className={cn("relative", className)}>
        <canvas ref={canvasRef} className="pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2 bg-zinc-900/90 rounded-lg p-2 backdrop-blur">
        {/* Tools */}
        <div className="flex flex-col gap-1">
          {tools.map(({ tool, icon, label }) => (
            <Button
              key={tool}
              variant={activeTool === tool ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool(tool)}
              title={label}
            >
              {icon}
            </Button>
          ))}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-zinc-700" />
        
        {/* Colors */}
        <div className="flex flex-col gap-1">
          {COLORS.map(color => (
            <button
              key={color}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform",
                activeColor === color ? "border-white scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
            />
          ))}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-zinc-700" />
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDelete}
            title="Delete Selected"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-400"
            onClick={handleClear}
            title="Clear All"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Save button */}
      {onSave && (
        <Button
          className="absolute top-2 right-2 z-10"
          size="sm"
          onClick={handleSave}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Note
        </Button>
      )}

      {/* Canvas */}
      <div onClick={handleCanvasClick}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export default AnnotationCanvas;
