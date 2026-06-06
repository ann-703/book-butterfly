const fs = require('fs');

const config = `const CONFIG = {
  GOOGLE_API_KEY: '${process.env.GOOGLE_API_KEY || ''}',
  EMAILJS_SERVICE_ID: '${process.env.EMAILJS_SERVICE_ID || 'YOUR_EMAILJS_SERVICE_ID'}',
  EMAILJS_TEMPLATE_ID: '${process.env.EMAILJS_TEMPLATE_ID || 'YOUR_EMAILJS_TEMPLATE_ID'}',
  EMAILJS_PUBLIC_KEY: '${process.env.EMAILJS_PUBLIC_KEY || 'YOUR_EMAILJS_PUBLIC_KEY'}',
  PARENT_EMAIL: 'ankita.sayal@gmail.com'
};`;

fs.writeFileSync('config.js', config);
console.log('config.js generated from environment variables');
