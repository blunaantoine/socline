import sharp from 'sharp';
import fs from 'fs';

const files = [
  'public/android-chrome-512x512.png',
  'public/apple-touch-icon.png'
];

async function removeWhiteBackground(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.log(`File not found: ${inputPath}`);
    return;
  }
  
  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    if (r > 250 && g > 250 && b > 250) {
      data[i + 3] = 0;
    }
  }
  
  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
  .png()
  .toFile(inputPath);
  
  console.log(`Processed: ${inputPath}`);
}

for (const file of files) {
  await removeWhiteBackground(file);
}

console.log('All done!');
