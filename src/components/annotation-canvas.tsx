"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  Canvas, 
  PencilBrush, 
  FabricObject, 
  Rect as FabricRect, 
  Circle as FabricCircle, 
  Line as FabricLine, 
  Triangle as FabricTriangle, 
  Group as FabricGroup, 
  IText as FabricIText 
} from "fabric";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  Square, 
  Circle, 
  Type, 
  ArrowRight,
  Trash,
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
  initialData?: string | object;
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

    if (initialData) {
      try {
        // Legacy rows were double-JSON-encoded; unwrap if so.
        let dataToLoad: any = initialData;
        if (typeof initialData === "string") {
          dataToLoad = JSON.parse(initialData);
          if (typeof dataToLoad === "string") {
            dataToLoad = JSON.parse(dataToLoad);
          }
        }
        if (dataToLoad && typeof dataToLoad === "object" && dataToLoad.objects?.length > 0) {
          const hasOriginalDimensions = dataToLoad.originalWidth && dataToLoad.originalHeight;
          const scaleX = hasOriginalDimensions ? width / dataToLoad.originalWidth : 1;
          const scaleY = hasOriginalDimensions ? height / dataToLoad.originalHeight : 1;
          const needsScaling = hasOriginalDimensions &&
            (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01);

          import("fabric").then(({ util }) => {
            util.enlivenObjects(dataToLoad.objects).then((enlivenedObjects: any[]) => {
              enlivenedObjects.forEach((obj: any) => {
                if (needsScaling) {
                  obj.set({
                    left: (obj.left || 0) * scaleX,
                    top: (obj.top || 0) * scaleY,
                    scaleX: (obj.scaleX || 1) * scaleX,
                    scaleY: (obj.scaleY || 1) * scaleY,
                  });
                  obj.setCoords();
                }
                canvas.add(obj);
              });
              canvas.requestRenderAll();
            }).catch((err: Error) => {
              console.error("Failed to enliven annotation objects:", err);
            });
          });
        }
      } catch (err) {
        console.error("Failed to parse annotation data:", err);
      }
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

  // Drag-to-draw shape handlers (rectangle, circle, arrow, text)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;
    if (activeTool === "select" || activeTool === "pen" || activeTool === "eraser") return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let currentShape: FabricObject | null = null;

    const onMouseDown = (opt: any) => {
      // Clicking an existing object — let Fabric handle it (select mode will pick it up on next tool switch)
      if (opt.target) return;
      const p = canvas.getPointer(opt.e);
      startX = p.x;
      startY = p.y;
      isDown = true;

      if (activeTool === "rectangle") {
        currentShape = new FabricRect({
          left: startX,
          top: startY,
          width: 1,
          height: 1,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 3,
          selectable: false,
        });
        canvas.add(currentShape);
      } else if (activeTool === "circle") {
        currentShape = new FabricCircle({
          left: startX,
          top: startY,
          radius: 1,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 3,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        canvas.add(currentShape);
      } else if (activeTool === "arrow") {
        currentShape = new FabricLine([startX, startY, startX, startY], {
          stroke: activeColor,
          strokeWidth: 3,
          selectable: false,
        });
        canvas.add(currentShape);
      } else if (activeTool === "text") {
        const text = new FabricIText("", {
          left: startX,
          top: startY,
          fontSize: 20,
          fill: activeColor,
          fontFamily: "sans-serif",
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        setActiveTool("select");
        isDown = false;
      }
    };

    const onMouseMove = (opt: any) => {
      if (!isDown || !currentShape) return;
      const p = canvas.getPointer(opt.e);

      if (activeTool === "rectangle") {
        (currentShape as FabricRect).set({
          left: Math.min(startX, p.x),
          top: Math.min(startY, p.y),
          width: Math.abs(p.x - startX),
          height: Math.abs(p.y - startY),
        });
      } else if (activeTool === "circle") {
        const dx = p.x - startX;
        const dy = p.y - startY;
        const radius = Math.sqrt(dx * dx + dy * dy) / 2;
        (currentShape as FabricCircle).set({
          left: (startX + p.x) / 2,
          top: (startY + p.y) / 2,
          radius: Math.max(radius, 1),
        });
      } else if (activeTool === "arrow") {
        (currentShape as FabricLine).set({ x2: p.x, y2: p.y });
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (!isDown || !currentShape) {
        isDown = false;
        currentShape = null;
        return;
      }

      if (activeTool === "arrow") {
        // Replace the bare line with a line+arrowhead group
        const line = currentShape as FabricLine;
        const x1 = line.x1 ?? 0;
        const y1 = line.y1 ?? 0;
        const x2 = line.x2 ?? 0;
        const y2 = line.y2 ?? 0;
        const len = Math.hypot(x2 - x1, y2 - y1);
        canvas.remove(line);
        if (len >= 5) {
          const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
          const arrowLine = new FabricLine([x1, y1, x2, y2], {
            stroke: activeColor,
            strokeWidth: 3,
          });
          const arrowHead = new FabricTriangle({
            left: x2,
            top: y2,
            width: 15,
            height: 20,
            fill: activeColor,
            angle: angleDeg,
            originX: "center",
            originY: "center",
          });
          const group = new FabricGroup([arrowLine, arrowHead]);
          canvas.add(group);
          canvas.setActiveObject(group);
        }
      } else if (activeTool === "rectangle") {
        const rect = currentShape as FabricRect;
        if ((rect.width ?? 0) < 5 || (rect.height ?? 0) < 5) {
          canvas.remove(rect);
        } else {
          rect.set({ selectable: true });
          canvas.setActiveObject(rect);
        }
      } else if (activeTool === "circle") {
        const circle = currentShape as FabricCircle;
        if ((circle.radius ?? 0) < 3) {
          canvas.remove(circle);
        } else {
          circle.set({ selectable: true });
          canvas.setActiveObject(circle);
        }
      }

      canvas.requestRenderAll();
      setActiveTool("select");
      isDown = false;
      currentShape = null;
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
    };
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
  const handleDelete = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const selected = canvas.getActiveObjects();
    if (selected.length === 0) return;
    selected.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete if we're editing text in canvas
        const canvas = fabricRef.current;
        if (canvas) {
          const activeObj = canvas.getActiveObject();
          // @ts-ignore - isEditing exists on IText objects
          if (activeObj && activeObj.isEditing) return;
        }
        e.preventDefault();
        handleDelete();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDelete, readOnly]);

  // Save annotation (include canvas dimensions for scaling on load)
  const handleSave = () => {
    const canvas = fabricRef.current;
    if (!canvas || !onSave) return;
    const canvasData = canvas.toJSON();
    // Store original dimensions for scaling when loading at different sizes
    canvasData.originalWidth = width;
    canvasData.originalHeight = height;
    const json = JSON.stringify(canvasData);
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
            title="Delete Selected (Del)"
          >
            <Trash className="h-4 w-4" />
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
      <div>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export default AnnotationCanvas;
