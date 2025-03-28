const fs = require('fs');
const path = require('path');

// Create the images directory if it doesn't exist
const imagesDir = path.join(process.cwd(), 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Function to save base64 image
function saveBase64Image(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filePath = path.join(imagesDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Saved ${filename}`);
}

// Save the navy logo
const navyLogo = ''; // Add base64 data here

// Save the white logo
const whiteLogo = ''; // Add base64 data here

saveBase64Image(navyLogo, 'logo-navy.png');
saveBase64Image(whiteLogo, 'logo-white.png'); 