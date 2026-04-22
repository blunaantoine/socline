import sharp from 'sharp';

async function removeWhiteBackground() {
  const inputPath = 'public/android-chrome-192x192.png';
  const outputPath = 'public/android-chrome-192x192.png';
  
  // Get image metadata
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  // Get raw pixel data
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Make white pixels transparent
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // If pixel is white or near-white, make it transparent
    if (r > 250 && g > 250 && b > 250) {
      data[i + 3] = 0; // Set alpha to 0 (transparent)
    }
  }
  
  // Save the result
  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
  .png()
  .toFile(outputPath);
  
  console.log('White background removed successfully!');
}

removeWhiteBackground().catch(console.error);
