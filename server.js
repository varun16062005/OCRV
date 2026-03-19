import express from 'express';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// OpenRouter API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// OCR + Summarize route
app.post('/extract-and-summarize', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const ocrResult = await Tesseract.recognize(req.file.path, 'eng');
    const extractedText = ocrResult.data.text;

    const prompt = `Summarize this text:\n${extractedText}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const summaryData = await response.json();

    // Error handling for unexpected API response
    if (!summaryData.choices || !summaryData.choices[0] || !summaryData.choices[0].message) {
      console.error('OpenRouter response error:', summaryData);
      return res.status(500).json({ error: 'Invalid response from OpenRouter API' });
    }

    const summaryText = summaryData.choices[0].message.content;

    res.json({ text: extractedText, summary: summaryText });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error processing image or contacting OpenRouter API' });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
