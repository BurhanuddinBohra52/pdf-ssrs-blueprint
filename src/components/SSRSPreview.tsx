import React, { useRef, useEffect } from 'react';
import { Canvas as FabricCanvas, Rect, Text } from 'fabric';
import { Card } from '@/components/ui/card';

interface SSRSComponent {
  id: string;
  type: 'textbox' | 'table' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  section: 'header' | 'body' | 'footer';
}

interface SSRSPreviewProps {
  components: SSRSComponent[];
  width?: number;
  height?: number;
}

export const SSRSPreview: React.FC<SSRSPreviewProps> = ({ 
  components, 
  width = 600, 
  height = 800 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric.js canvas
    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: false,
    });

    fabricCanvasRef.current = canvas;

    // Clear previous objects
    canvas.clear();

    // Add section backgrounds
    const headerHeight = 100;
    const footerHeight = 60;
    const bodyHeight = height - headerHeight - footerHeight;

    // Header section
    const headerBg = new Rect({
      left: 0,
      top: 0,
      width: width,
      height: headerHeight,
      fill: 'rgba(59, 130, 246, 0.1)',
      stroke: 'rgba(59, 130, 246, 0.3)',
      strokeWidth: 1,
      selectable: false,
    });
    canvas.add(headerBg);

    // Body section
    const bodyBg = new Rect({
      left: 0,
      top: headerHeight,
      width: width,
      height: bodyHeight,
      fill: 'rgba(34, 197, 94, 0.1)',
      stroke: 'rgba(34, 197, 94, 0.3)',
      strokeWidth: 1,
      selectable: false,
    });
    canvas.add(bodyBg);

    // Footer section
    const footerBg = new Rect({
      left: 0,
      top: headerHeight + bodyHeight,
      width: width,
      height: footerHeight,
      fill: 'rgba(168, 85, 247, 0.1)',
      stroke: 'rgba(168, 85, 247, 0.3)',
      strokeWidth: 1,
      selectable: false,
    });
    canvas.add(footerBg);

    // Add section labels
    const headerLabel = new Text('HEADER SECTION', {
      left: 10,
      top: 10,
      fontSize: 12,
      fill: '#3b82f6',
      fontFamily: 'Arial',
      selectable: false,
    });
    canvas.add(headerLabel);

    const bodyLabel = new Text('BODY SECTION', {
      left: 10,
      top: headerHeight + 10,
      fontSize: 12,
      fill: '#22c55e',
      fontFamily: 'Arial',
      selectable: false,
    });
    canvas.add(bodyLabel);

    const footerLabel = new Text('FOOTER SECTION', {
      left: 10,
      top: headerHeight + bodyHeight + 10,
      fontSize: 12,
      fill: '#a855f7',
      fontFamily: 'Arial',
      selectable: false,
    });
    canvas.add(footerLabel);

    // Add components
    components.forEach((component) => {
      let yOffset = 0;
      let sectionColor = '#000000';

      // Adjust Y position based on section
      if (component.section === 'body') {
        yOffset = headerHeight;
        sectionColor = '#059669';
      } else if (component.section === 'footer') {
        yOffset = headerHeight + bodyHeight;
        sectionColor = '#7c3aed';
      } else {
        sectionColor = '#2563eb';
      }

      if (component.type === 'textbox') {
        const textbox = new Rect({
          left: component.x * (width / 600), // Scale to canvas
          top: (component.y + yOffset) * (height / 800),
          width: component.width * (width / 600),
          height: component.height * (height / 800),
          fill: 'rgba(255, 255, 255, 0.8)',
          stroke: sectionColor,
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
        });
        canvas.add(textbox);

        if (component.content) {
          const text = new Text(component.content, {
            left: (component.x + 5) * (width / 600),
            top: (component.y + yOffset + 5) * (height / 800),
            fontSize: Math.max(10, (component.height * (height / 800)) / 3),
            fill: sectionColor,
            fontFamily: 'Arial',
            selectable: false,
          });
          canvas.add(text);
        }
      } else if (component.type === 'table') {
        const table = new Rect({
          left: component.x * (width / 600),
          top: (component.y + yOffset) * (height / 800),
          width: component.width * (width / 600),
          height: component.height * (height / 800),
          fill: 'rgba(255, 255, 255, 0.9)',
          stroke: sectionColor,
          strokeWidth: 2,
          selectable: false,
        });
        canvas.add(table);

        // Add table icon/indicator
        const tableIcon = new Text('📊 TABLE', {
          left: (component.x + 10) * (width / 600),
          top: (component.y + yOffset + 10) * (height / 800),
          fontSize: 12,
          fill: sectionColor,
          fontFamily: 'Arial',
          selectable: false,
        });
        canvas.add(tableIcon);
      }
    });

    canvas.renderAll();

    return () => {
      canvas.dispose();
    };
  }, [components, width, height]);

  return (
    <Card className="p-4 bg-gradient-card shadow-card">
      <h3 className="text-lg font-semibold mb-4">SSRS Layout Preview</h3>
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/50 rounded"></div>
          <span>Header</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500/20 border border-green-500/50 rounded"></div>
          <span>Body</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500/20 border border-purple-500/50 rounded"></div>
          <span>Footer</span>
        </div>
      </div>
    </Card>
  );
};