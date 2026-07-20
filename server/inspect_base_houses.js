const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('C:\\Users\\o0lca\\OneDrive\\Desktop\\Oyun\\house\\Base houses.png');
const png = PNG.sync.read(data);

console.log(`Image Size: ${png.width}x${png.height}`);

// We want to scan the image for connected components (pixel islands) of non-transparent pixels.
// Let's implement a simple Breadth-First Search (BFS) or Depth-First Search (DFS) to find islands.
const visited = new Uint8Array(png.width * png.height);
const islands = [];

for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const idx = (png.width * y + x) << 2;
    const alpha = png.data[idx + 3];
    const visitIdx = png.width * y + x;

    if (alpha > 0 && !visited[visitIdx]) {
      // Found a new island! Start BFS
      let minX = x, maxX = x, minY = y, maxY = y;
      const queue = [[x, y]];
      visited[visitIdx] = 1;
      let pixelCount = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        pixelCount++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Check 4 neighbors
        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < png.width && ny >= 0 && ny < png.height) {
            const nIdx = (png.width * ny + nx) << 2;
            const nVisitIdx = png.width * ny + nx;
            if (png.data[nIdx + 3] > 0 && !visited[nVisitIdx]) {
              visited[nVisitIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }

      // Ignore very small noise islands (e.g. less than 20 pixels)
      if (pixelCount > 20) {
        islands.push({ minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1, pixels: pixelCount });
      }
    }
  }
}

console.log(`Found ${islands.length} house islands:`);
islands.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
islands.forEach((island, idx) => {
  console.log(`House ${idx + 1}: bounding box: (${island.minX}, ${island.minY}) to (${island.maxX}, ${island.maxY}), size: ${island.width}x${island.height}, pixels: ${island.pixels}`);
});
