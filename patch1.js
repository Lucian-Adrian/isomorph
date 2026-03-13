
const fs = require('fs');
const path = 'src/components/DiagramView.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = '    if (entityGroup && canMoveEntity) {';
const replacement = \    if (entityGroup && activeTool === 'add-edge') {
      const entityName = entityGroup.getAttribute('data-entity-name') ?? undefined;
      if (!entityName) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = zoom / 100;
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      dragRef.current = {
        mode: 'add-edge',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        entityName,
        entityOrigX: x,
        entityOrigY: y,
      };
      setDrawingEdge({ x1: x, y1: y, x2: x, y2: y });
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

\ + target;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);

