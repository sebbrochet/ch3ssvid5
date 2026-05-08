const sharp = require('sharp');

async function generate() {
  const sizes = [180, 192, 512];
  for (const s of sizes) {
    await sharp('public/Ch3ssVid5.svg')
      .resize(s, s)
      .png()
      .toFile('public/icon-' + s + '.png');
    console.log('Generated icon-' + s + '.png');
  }
}

generate().catch(console.error);
