import fs from 'fs';

const filePath = './_mapdata/world_save.json';
if (fs.existsSync(filePath)) {
  const objects = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log('Before cleanup:', objects.length);

  const map = new Map();
  objects.forEach((obj) => {
    const mapId = obj.mapId || 'world_1';
    const depth = obj.depthLayer || 'below';
    const rx = Math.round(obj.x);
    const ry = Math.round(obj.y);
    const key = `${mapId}:${depth}:${rx}:${ry}`;
    map.set(key, obj);
  });

  const cleaned = Array.from(map.values());
  console.log('After cleanup:', cleaned.length);

  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
  if (fs.existsSync('./map_save.json')) {
    fs.writeFileSync('./map_save.json', JSON.stringify(cleaned, null, 2), 'utf8');
  }
}
